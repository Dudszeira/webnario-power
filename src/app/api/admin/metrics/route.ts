import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId, getLiveStartMs, isLiveActive, isLiveOver } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const targetEdition = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();

  // All editions for perpetual view
  const editions = db.prepare('SELECT * FROM editions ORDER BY id DESC').all() as any[];

  const buildMetrics = (editionId: string) => {
    const regs = db.prepare('SELECT COUNT(*) as c FROM registrations WHERE edition_id = ?').get(editionId) as any;
    const consumed = db.prepare('SELECT COUNT(*) as c FROM registrations WHERE edition_id = ? AND consumed = 1').get(editionId) as any;
    const realComments = db.prepare(`SELECT COUNT(*) as c FROM comments WHERE edition_id = ? AND type IN ('real_user','real_staff')`).get(editionId) as any;
    const ctaClicks = db.prepare(`SELECT COUNT(*) as c FROM events WHERE edition_id = ? AND type = 'cta_click'`).get(editionId) as any;
    const enterLive = db.prepare(`SELECT COUNT(*) as c FROM events WHERE edition_id = ? AND type = 'enter_live'`).get(editionId) as any;
    const simComments = db.prepare(`SELECT COUNT(*) as c FROM comments WHERE edition_id = ? AND type IN ('simulated_user','simulated_staff','simulated_purchase')`).get(editionId) as any;

    return {
      editionId,
      registrations: regs?.c || 0,
      consumed: consumed?.c || 0,
      enterLive: enterLive?.c || 0,
      realComments: realComments?.c || 0,
      ctaClicks: ctaClicks?.c || 0,
      simulatedComments: simComments?.c || 0,
    };
  };

  const currentMetrics = buildMetrics(targetEdition);

  // Recent registrations
  const recentRegs = db
    .prepare(
      'SELECT id, name, email, ip, consumed, created_at FROM registrations WHERE edition_id = ? ORDER BY created_at DESC LIMIT 50'
    )
    .all(targetEdition);

  // Recent real comments
  const recentComments = db
    .prepare(
      `SELECT id, type, author_name, text, created_at FROM comments WHERE edition_id = ? AND type IN ('real_user','real_staff') ORDER BY created_at DESC LIMIT 50`
    )
    .all(targetEdition);

  // Perpetual series
  const allEditionsMetrics = editions.map((e) => ({
    ...buildMetrics(e.id),
    edition: e,
  }));

  // Current edition live status
  const currentEditionRow = db.prepare('SELECT * FROM editions WHERE id = ?').get(targetEdition) as any;
  const videoDuration = currentEditionRow?.video_duration ?? 7200;
  const liveStartMs = getLiveStartMs(targetEdition);
  const liveActive = isLiveActive(targetEdition, videoDuration);
  const liveOver = isLiveOver(targetEdition, videoDuration);
  const liveStatus = liveActive ? 'live' : liveOver ? 'over' : 'waiting';

  const editionConfig = currentEditionRow || {};

  return NextResponse.json({
    currentEdition: targetEdition,
    currentMetrics,
    recentRegs,
    recentComments,
    allEditions: allEditionsMetrics,
    liveStatus,
    liveStartMs,
    editionConfig,
  });
}
