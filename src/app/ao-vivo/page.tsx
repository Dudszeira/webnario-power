import { redirect } from 'next/navigation';
import { verifyUserSession, verifyAdminSession } from '@/lib/auth';
import { getCurrentEditionId, isLiveActive, isLiveOver, getVideoOffset, getLiveStartMs } from '@/lib/edition';
import { getDb, type Edition } from '@/lib/db';
import AoVivoContent from '@/components/AoVivoContent';

export const dynamic = 'force-dynamic';

export default async function AoVivoPage() {
  const isAdmin = await verifyAdminSession();
  const session = await verifyUserSession();
  const editionId = getCurrentEditionId();

  const db = getDb();
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId) as Edition | undefined;
  const videoDuration = edition?.video_duration ?? 7200;
  const salesUrl = edition?.sales_page_url ?? '';

  // Admin bypasses all time and session guards
  if (!isAdmin) {
    if (!session) redirect('/espera');
    if (session.editionId !== editionId) redirect('/espera');
    if (!isLiveActive(editionId, videoDuration)) redirect('/espera');

    // Mark registration as consumed on first access
    const reg = db
      .prepare('SELECT consumed FROM registrations WHERE id = ?')
      .get(session.registrationId) as { consumed: number } | undefined;

    if (reg && !reg.consumed) {
      db.prepare(
        "UPDATE registrations SET consumed = 1, consumed_at = datetime('now') WHERE id = ?"
      ).run(session.registrationId);

      db.prepare(
        "INSERT OR IGNORE INTO events (id, edition_id, registration_id, type, metadata) VALUES (?, ?, ?, 'enter_live', '{}')"
      ).run(
        `ev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        editionId,
        session.registrationId
      );
    }
  }

  const offset = isAdmin ? 0 : getVideoOffset(editionId);
  const liveStartMs = getLiveStartMs(editionId);

  const simulatedComments = db
    .prepare(
      `SELECT * FROM comments
       WHERE edition_id = ?
         AND type IN ('simulated_user','simulated_staff','simulated_purchase')
         AND visible = 1
       ORDER BY video_timestamp ASC`
    )
    .all(editionId) as any[];

  const pinnedComments = db
    .prepare(
      `SELECT * FROM comments
       WHERE edition_id = ? AND is_pinned = 1 AND visible = 1`
    )
    .all(editionId) as any[];

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
      simulatedComments={simulatedComments}
      pinnedComments={pinnedComments}
      salesUrl={salesUrl}
      isAdminPreview={isAdmin}
    />
  );
}
