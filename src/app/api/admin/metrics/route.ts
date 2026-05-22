import { NextRequest, NextResponse } from 'next/server';
import { 
  getEdition, 
  getEditionsList, 
  getEditionMetrics, 
  getRecentRegistrations, 
  getRecentRealComments 
} from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId, getLiveStartMs, isLiveActive, isLiveOver } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetEdition = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();

  // All editions for perpetual view
  const editions = await getEditionsList();

  const currentMetrics = await getEditionMetrics(targetEdition);

  // Recent registrations
  const recentRegs = await getRecentRegistrations(targetEdition, 50);

  // Recent real comments
  const recentComments = await getRecentRealComments(targetEdition, 50);

  // Perpetual series
  const allEditionsMetrics = await Promise.all(
    editions.map(async (e) => ({
      ...(await getEditionMetrics(e.id)),
      edition: e,
    }))
  );

  // Current edition live status
  const currentEditionRow = await getEdition(targetEdition);
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
