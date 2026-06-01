import { redirect } from 'next/navigation';
import { verifyUserSession } from '@/lib/auth';
import { getCurrentEditionId, getLiveStartMs } from '@/lib/edition';
import { getEdition, getRegistrationById } from '@/lib/db';
import EsperaContent from '@/components/EsperaContent';

export const dynamic = 'force-dynamic';

export default async function EsperaPage() {
  const session = await verifyUserSession();
  const editionId = getCurrentEditionId();

  const edition = await getEdition(editionId);
  const videoDuration = edition?.video_duration ?? 7200;
  const salesUrl = edition?.sales_page_url ?? '';

  // In test mode, test_time IS the simulated live start time (countdown target).
  // Outside test mode, the live always starts at the hardcoded Tuesday 20h BRT.
  const testLiveStartMs = (edition?.test_mode === 1 && edition?.test_time)
    ? new Date(edition.test_time).getTime()
    : null;
  const effectiveLiveStartMs = testLiveStartMs ?? getLiveStartMs(editionId);
  const effectiveLiveEndMs = effectiveLiveStartMs + videoDuration * 1000;
  const now = Date.now();

  // Verify session is still backed by a real DB registration (admin may have deleted it)
  let registrationValid = false;
  if (session && session.editionId === editionId) {
    const reg = await getRegistrationById(session.registrationId);
    registrationValid = !!reg;
  }

  // Redirect registered users to live room when the (possibly simulated) live is active
  if (registrationValid) {
    if (now >= effectiveLiveStartMs && now <= effectiveLiveEndMs) {
      redirect('/ao-vivo');
    }
    if (now > effectiveLiveEndMs) {
      return (
        <EsperaContent
          editionId={editionId}
          session={session}
          liveStartMs={effectiveLiveStartMs}
          serverNow={now}
          liveOver={true}
          salesUrl={salesUrl}
          registered={true}
        />
      );
    }
  }

  const registered = registrationValid;

  return (
    <EsperaContent
      editionId={editionId}
      session={session}
      liveStartMs={effectiveLiveStartMs}
      serverNow={now}
      liveOver={false}
      salesUrl={salesUrl}
      registered={registered}
    />
  );
}
