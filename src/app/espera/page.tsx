import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyUserSession } from '@/lib/auth';
import { getCurrentEditionId, isLiveActive, isLiveOver, getLiveStartMs, getSimulatedNow } from '@/lib/edition';
import { getEdition } from '@/lib/db';
import EsperaContent from '@/components/EsperaContent';

export const dynamic = 'force-dynamic';

export default async function EsperaPage() {
  const session = await verifyUserSession();
  const editionId = getCurrentEditionId();

  const edition = await getEdition(editionId);
  const simulatedNow = getSimulatedNow(edition);
  const videoDuration = edition?.video_duration ?? 7200;
  const salesUrl = edition?.sales_page_url ?? '';

  // If live is active and user has a valid session for this edition → go to live room
  if (session && session.editionId === editionId) {
    if (isLiveActive(editionId, videoDuration, simulatedNow)) {
      redirect('/ao-vivo');
    }
    if (isLiveOver(editionId, videoDuration, simulatedNow)) {
      // Live is over — show "perdeu a live" modal on waiting page
      return (
        <EsperaContent
          editionId={editionId}
          session={session}
          liveStartMs={getLiveStartMs(editionId)}
          liveOver={true}
          salesUrl={salesUrl}
          registered={true}
        />
      );
    }
  }

  const registered = !!(session && session.editionId === editionId);

  // In test mode, adjust the target timestamp so the client-side countdown reflects
  // the simulated perspective (test_time = "pretend it's currently this moment").
  let effectiveLiveStartMs: number;
  if (edition?.test_mode === 1) {
    if (isLiveActive(editionId, videoDuration, simulatedNow)) {
      // Simulated live is active → fire countdown immediately
      effectiveLiveStartMs = Date.now() - 1000;
    } else {
      // Keep simulated remaining time, anchored to real now so the client ticks correctly
      const simulatedRemaining = getLiveStartMs(editionId) - simulatedNow.getTime();
      effectiveLiveStartMs = Date.now() + Math.max(0, simulatedRemaining);
    }
  } else {
    effectiveLiveStartMs = getLiveStartMs(editionId);
  }

  return (
    <EsperaContent
      editionId={editionId}
      session={session}
      liveStartMs={effectiveLiveStartMs}
      liveOver={false}
      salesUrl={salesUrl}
      registered={registered}
    />
  );
}
