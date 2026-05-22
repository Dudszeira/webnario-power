import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyUserSession } from '@/lib/auth';
import { getCurrentEditionId, isLiveActive, isLiveOver, getLiveStartMs } from '@/lib/edition';
import { getDb } from '@/lib/db';
import EsperaContent from '@/components/EsperaContent';

export const dynamic = 'force-dynamic';

export default async function EsperaPage() {
  const session = await verifyUserSession();
  const editionId = getCurrentEditionId();

  const db = getDb();
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId) as any;
  const videoDuration = edition?.video_duration ?? 7200;
  const salesUrl = edition?.sales_page_url ?? '';

  // If live is active and user has a valid session for this edition → go to live room
  if (session && session.editionId === editionId) {
    if (isLiveActive(editionId, videoDuration)) {
      redirect('/ao-vivo');
    }
    if (isLiveOver(editionId, videoDuration)) {
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

  return (
    <EsperaContent
      editionId={editionId}
      session={session}
      liveStartMs={getLiveStartMs(editionId)}
      liveOver={false}
      salesUrl={salesUrl}
      registered={registered}
    />
  );
}
