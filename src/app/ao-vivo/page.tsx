import { redirect } from 'next/navigation';
import { verifyUserSession, verifyAdminSession } from '@/lib/auth';
import { getCurrentEditionId, getLiveStartMs } from '@/lib/edition';
import {
  getOrCreateCurrentEdition,
  getRegistrationById,
  markRegistrationConsumed,
  createEvent,
  getSimulatedComments,
  getPinnedComments,
  getRealComments,
  getIsolatedComments,
} from '@/lib/db';
import AoVivoContent from '@/components/AoVivoContent';

export const dynamic = 'force-dynamic';

export default async function AoVivoPage() {
  const isAdmin = await verifyAdminSession();
  const session = await verifyUserSession();
  const editionId = getCurrentEditionId();

  const edition = await getOrCreateCurrentEdition();
  const videoDuration = edition?.video_duration ?? 7200;
  const salesUrl = edition?.sales_page_url ?? '';

  // In test mode, test_time is the simulated live start; outside test mode, use real Tuesday start.
  const testLiveStartMs = (edition?.test_mode === 1 && edition?.test_time)
    ? new Date(edition.test_time).getTime()
    : null;
  const liveStartMs = testLiveStartMs ?? getLiveStartMs(editionId);
  const liveEndMs = liveStartMs + videoDuration * 1000;
  const now = Date.now();

  // Admin bypasses all time and session guards
  if (!isAdmin) {
    if (!session) redirect('/espera');
    if (session.editionId !== editionId) redirect('/espera');
    if (now < liveStartMs || now > liveEndMs) redirect('/espera');

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

  // Admins see offset=0 (start of video) unless test_mode is on — then show elapsed since test_time
  const offset = (isAdmin && !edition?.test_mode) ? 0 : Math.max(0, Math.floor((now - liveStartMs) / 1000));

  const simulatedComments = await getSimulatedComments(editionId);
  const pinnedComments = await getPinnedComments(editionId);

  const chatEnabled = edition?.chat_enabled ?? 1;
  const chatMode = edition?.chat_mode ?? 'general';

  // Pre-load real comments server-side so ChatPanel starts with the correct
  // filtered state — no loading gap and no wrong comments in isolated mode.
  const realCutoff = '1970-01-01T00:00:00.000Z';
  const initialRealComments = (isAdmin || chatMode !== 'isolated' || !session)
    ? await getRealComments(editionId, realCutoff, 100)
    : await getIsolatedComments(editionId, realCutoff, session.registrationId, 100);
  const ctaAutoEnabled = !!(edition?.cta_auto_enabled ?? 0);
  const ctaOverride = (edition?.cta_override as 'on' | 'off' | null) ?? null;
  const ctaOverrideAt = edition?.cta_override_at ?? null;
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
      ctaAutoEnabled={ctaAutoEnabled}
      ctaOverride={ctaOverride}
      ctaOverrideAt={ctaOverrideAt}
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
      initialRealComments={initialRealComments.map(c => ({
        id: c.id,
        type: c.type,
        author_name: c.author_name,
        text: c.text,
        created_at: c.created_at,
        reply: c.reply ?? undefined,
        reply_author: c.reply_author ?? undefined,
      }))}
    />
  );
}
