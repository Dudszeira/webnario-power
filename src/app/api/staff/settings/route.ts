import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getCurrentEditionId } from '@/lib/edition';

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const editionId = getCurrentEditionId();
  const db = getDb();

  if (body?.chat_mode !== undefined && body?.cta_enabled !== undefined) {
    const mode = body.chat_mode === 'isolated' ? 'isolated' : 'general';
    db.prepare('UPDATE editions SET chat_mode = ?, cta_enabled = ? WHERE id = ?')
      .run(mode, body.cta_enabled ? 1 : 0, editionId);
  } else if (body?.chat_mode !== undefined) {
    const mode = body.chat_mode === 'isolated' ? 'isolated' : 'general';
    db.prepare('UPDATE editions SET chat_mode = ? WHERE id = ?').run(mode, editionId);
  } else if (body?.cta_enabled !== undefined) {
    db.prepare('UPDATE editions SET cta_enabled = ? WHERE id = ?')
      .run(body.cta_enabled ? 1 : 0, editionId);
  } else {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
