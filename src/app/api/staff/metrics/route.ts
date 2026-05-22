import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const editionId = getCurrentEditionId();
  const db = getDb();

  const online = (db.prepare(
    `SELECT COUNT(*) as c FROM registrations WHERE edition_id = ? AND consumed = 1`
  ).get(editionId) as any).c ?? 0;

  const ctaClicks = (db.prepare(
    `SELECT COUNT(*) as c FROM events WHERE edition_id = ? AND type = 'cta_click'`
  ).get(editionId) as any).c ?? 0;

  const edition = db.prepare(
    `SELECT chat_mode, cta_enabled FROM editions WHERE id = ?`
  ).get(editionId) as any;

  return NextResponse.json({
    online,
    cta_clicks: ctaClicks,
    chat_mode: edition?.chat_mode || 'general',
    cta_enabled: edition?.cta_enabled ?? 1,
  });
}
