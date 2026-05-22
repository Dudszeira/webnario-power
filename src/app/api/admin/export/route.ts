import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const db = getDb();

  const regs = db
    .prepare('SELECT * FROM registrations WHERE edition_id = ? ORDER BY created_at ASC')
    .all(editionId) as any[];

  const events = db
    .prepare('SELECT * FROM events WHERE edition_id = ? ORDER BY created_at ASC')
    .all(editionId) as any[];

  const realComments = db
    .prepare(`SELECT * FROM comments WHERE edition_id = ? AND type IN ('real_user','real_staff') ORDER BY created_at ASC`)
    .all(editionId) as any[];

  // Build CSV
  const toCSV = (rows: any[], columns: string[]) => {
    const header = columns.join(';');
    const body = rows.map((r) => columns.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'));
    return [header, ...body].join('\n');
  };

  const regsCsv = toCSV(regs, ['id', 'edition_id', 'name', 'email', 'ip', 'consumed', 'consumed_at', 'created_at']);
  const eventsCsv = toCSV(events, ['id', 'edition_id', 'registration_id', 'type', 'metadata', 'created_at']);
  const commentsCsv = toCSV(realComments, ['id', 'edition_id', 'type', 'author_name', 'text', 'created_at']);

  const combined = `=== REGISTROS (${editionId}) ===\n${regsCsv}\n\n=== EVENTOS ===\n${eventsCsv}\n\n=== COMENTARIOS REAIS ===\n${commentsCsv}`;

  return new NextResponse(combined, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="webnario-${editionId}.csv"`,
    },
  });
}
