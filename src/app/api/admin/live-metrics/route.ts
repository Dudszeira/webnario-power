import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';
import { getAllRegistrations, getLiveEventsForEdition, getLiveCommentCountsPerUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const THREE_MIN_AGO = Date.now() - 3 * 60 * 1000;

  const [registrations, events, commentRows] = await Promise.all([
    getAllRegistrations(editionId),
    getLiveEventsForEdition(editionId),
    getLiveCommentCountsPerUser(editionId),
  ]);

  // Build per-registration maps
  const enterMap = new Map<string, string>();
  const ctaSet = new Set<string>();
  const heartbeatMap = new Map<string, number>();
  const lastSeenMap = new Map<string, string>();

  for (const e of events) {
    const rid = e.registration_id;
    if (!rid) continue;
    const prev = lastSeenMap.get(rid);
    if (!prev || e.created_at > prev) lastSeenMap.set(rid, e.created_at);
    if (e.type === 'enter_live' && !enterMap.has(rid)) enterMap.set(rid, e.created_at);
    else if (e.type === 'cta_click') ctaSet.add(rid);
    else if (e.type === 'heartbeat') heartbeatMap.set(rid, (heartbeatMap.get(rid) || 0) + 1);
  }

  const commentMap = new Map<string, number>(
    commentRows
      .filter(c => c.registration_id)
      .map(c => [c.registration_id!, c.count])
  );

  const users = registrations
    .filter(r => enterMap.has(r.id))
    .map(r => {
      const lastSeen = lastSeenMap.get(r.id) ?? null;
      const heartbeats = heartbeatMap.get(r.id) ?? 0;
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        enteredAt: enterMap.get(r.id) ?? null,
        watchSeconds: heartbeats * 60,
        ctaClicked: ctaSet.has(r.id),
        commented: (commentMap.get(r.id) ?? 0) > 0,
        commentCount: commentMap.get(r.id) ?? 0,
        lastSeenAt: lastSeen,
        online: lastSeen ? new Date(lastSeen).getTime() > THREE_MIN_AGO : false,
      };
    })
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (b.lastSeenAt ?? '') > (a.lastSeenAt ?? '') ? -1 : 1;
    });

  // 5-minute buckets: distinct viewers active (entered or sent a heartbeat) in each
  // window — a retention/drop-off curve, not just when people joined. Keyed by the
  // bucket's real epoch ms (not an "HH:MM" string) so stragglers past midnight sort
  // after 23:55 instead of wrapping around to look like activity before the live.
  const bucketMap = new Map<number, Set<string>>();
  const FIVE_MIN_MS = 5 * 60 * 1000;
  for (const e of events) {
    if (e.type !== 'enter_live' && e.type !== 'heartbeat') continue;
    if (!e.registration_id) continue;
    const bucketMs = Math.floor(new Date(e.created_at).getTime() / FIVE_MIN_MS) * FIVE_MIN_MS;
    if (!bucketMap.has(bucketMs)) bucketMap.set(bucketMs, new Set());
    bucketMap.get(bucketMs)!.add(e.registration_id);
  }
  const timeline = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ms, set]) => {
      const d = new Date(ms);
      const bucket = `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
      return { bucket, count: set.size };
    });

  const totalEntered = users.length;
  const avgWatchSeconds = totalEntered > 0
    ? Math.round(users.reduce((s, u) => s + u.watchSeconds, 0) / totalEntered)
    : 0;

  return NextResponse.json({
    summary: {
      online: users.filter(u => u.online).length,
      totalEntered,
      ctaClicks: ctaSet.size,
      avgWatchSeconds,
    },
    users,
    timeline,
  });
}
