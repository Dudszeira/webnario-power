import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const commentId = String(body?.commentId || '').trim();
  const reply = String(body?.reply || '').trim();

  if (!commentId || !reply || reply.length > 500) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const db = getDb();
  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
  if (!comment) return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });

  db.prepare(
    'UPDATE comments SET reply = ?, reply_author = ? WHERE id = ?'
  ).run(reply, staff.name, commentId);

  return NextResponse.json({ ok: true });
}
