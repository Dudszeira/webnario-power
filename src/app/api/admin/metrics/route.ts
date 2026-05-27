import { NextRequest, NextResponse } from 'next/server';
import {
  getEdition,
  getEditionsList,
  getEditionMetrics,
  getRecentRegistrations,
} from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId, getLiveStartMs, isLiveActive, isLiveOver, getSimulatedNow } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetEdition = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();

  // All editions for perpetual view
  const editions = await getEditionsList();

  // Run all independent queries in parallel
  const [currentMetrics, recentRegs, allEditionsMetrics, currentEditionRow] = await Promise.all([
    getEditionMetrics(targetEdition),
    getRecentRegistrations(targetEdition, 50),
    Promise.all(editions.map(async (e) => ({ ...(await getEditionMetrics(e.id)), edition: e }))),
    getEdition(targetEdition),
  ]);
  const simulatedNow = getSimulatedNow(currentEditionRow);
  const videoDuration = currentEditionRow?.video_duration ?? 7200;
  const liveStartMs = getLiveStartMs(targetEdition);
  const liveActive = isLiveActive(targetEdition, videoDuration, simulatedNow);
  const liveOver = isLiveOver(targetEdition, videoDuration, simulatedNow);
  const liveStatus = liveActive ? 'live' : liveOver ? 'over' : 'waiting';

  const editionConfig = currentEditionRow || {};

  return NextResponse.json({
    currentEdition: targetEdition,
    currentMetrics,
    recentRegs,
    allEditions: allEditionsMetrics,
    liveStatus,
    liveStartMs,
    editionConfig,
  });
}
