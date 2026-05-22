import { redirect } from 'next/navigation';
import { verifyUserSession, verifyAdminSession } from '@/lib/auth';
import { getCurrentEditionId, isLiveActive, isLiveOver, getVideoOffset, getLiveStartMs } from '@/lib/edition';
import { 
  getEdition, 
  getRegistrationById, 
  markRegistrationConsumed, 
  createEvent, 
  getSimulatedComments, 
  getPinnedComments 
} from '@/lib/db';
import AoVivoContent from '@/components/AoVivoContent';

export const dynamic = 'force-dynamic';

export default async function AoVivoPage() {
  const isAdmin = await verifyAdminSession();
  const session = await verifyUserSession();
  const editionId = getCurrentEditionId();

  const edition = await getEdition(editionId);
  const videoDuration = edition?.video_duration ?? 7200;
  const salesUrl = edition?.sales_page_url ?? '';

  // Admin bypasses all time and session guards
  if (!isAdmin) {
    if (!session) redirect('/espera');
    if (session.editionId !== editionId) redirect('/espera');
    if (!isLiveActive(editionId, videoDuration)) redirect('/espera');

    // Mark registration as consumed on first access
    const reg = await getRegistrationById(session.registrationId);

    if (reg && !reg.consumed) {
      await markRegistrationConsumed(session.registrationId);

      await createEvent({
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        edition_id: editionId,
        registration_id: session.registrationId,
        type: 'enter_live',
        metadata: '{}'
      });
    }
  }

  const offset = isAdmin ? 0 : getVideoOffset(editionId);
  const liveStartMs = getLiveStartMs(editionId);

  const simulatedComments = await getSimulatedComments(editionId);
  const pinnedComments = await getPinnedComments(editionId);

  const chatEnabled = edition?.chat_enabled ?? 1;
  const chatMode = edition?.chat_mode ?? 'general';
  const ctaEnabled = edition?.cta_enabled ?? 0;
  const ctaUrl = edition?.cta_url ?? '';
  const ctaText = edition?.cta_text ?? '';
  const ctaStartSecs = edition?.cta_start_seconds ?? 0;
  const ctaEndSecs = edition?.cta_end_seconds ?? 3600;
  const viewerMin = edition?.viewer_min ?? 210;
  const viewerMax = edition?.viewer_max ?? 220;
  const videoSource = edition?.video_source ?? 'youtube';
  const videoUrl = edition?.video_url ?? '';

  const previewSession = session ?? { registrationId: 'admin', name: 'Admin', email: 'admin' };

  return (
    <AoVivoContent
      editionId={editionId}
      session={previewSession}
      videoSource={videoSource}
      videoUrl={videoUrl}
      videoDuration={videoDuration}
      initialOffset={offset}
      liveStartMs={liveStartMs}
      chatEnabled={!!chatEnabled}
      chatMode={chatMode as 'general' | 'isolated'}
      ctaEnabled={!!ctaEnabled}
      ctaUrl={ctaUrl}
      ctaText={ctaText}
      ctaStartSecs={ctaStartSecs}
      ctaEndSecs={ctaEndSecs}
      viewerMin={viewerMin}
      viewerMax={viewerMax}
      simulatedComments={simulatedComments.map(c => ({
        id: c.id,
        type: c.type,
        author_name: c.author_name,
        text: c.text,
        video_timestamp: c.video_timestamp ?? 0,
        is_pinned: c.is_pinned,
        pin_start_seconds: c.pin_start_seconds ?? undefined,
        pin_end_seconds: c.pin_end_seconds ?? undefined,
      }))}
      pinnedComments={pinnedComments.map(c => ({
        id: c.id,
        type: c.type,
        author_name: c.author_name,
        text: c.text,
        video_timestamp: c.video_timestamp ?? 0,
        is_pinned: c.is_pinned,
        pin_start_seconds: c.pin_start_seconds ?? undefined,
        pin_end_seconds: c.pin_end_seconds ?? undefined,
      }))}
      salesUrl={salesUrl}
      isAdminPreview={isAdmin}
    />
  );
}
