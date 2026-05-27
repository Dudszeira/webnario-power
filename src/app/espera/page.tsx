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

  // In test mode when the live is simulated as active, pass a past timestamp so
  // the client-side countdown and redirect interval also fire immediately.
  const testLiveNow = edition?.test_mode === 1 && isLiveActive(editionId, videoDuration, simulatedNow);
  const effectiveLiveStartMs = testLiveNow ? Date.now() - 1000 : getLiveStartMs(editionId);

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
