import { NextRequest, NextResponse } from 'next/server';
import { getEdition, getOrCreateCurrentEdition, upsertEdition } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi'];
const VIDEOS_DIR = path.join(process.cwd(), 'public', 'videos');

function scanVideoOnDisk() {
  try {
    const files = readdirSync(VIDEOS_DIR);
    const found = files.find(f => VIDEO_EXTS.includes(path.extname(f).toLowerCase()));
    if (found) {
      const stat = statSync(path.join(VIDEOS_DIR, found));
      return { filename: found, url: `/videos/${found}`, sizeMB: Math.round(stat.size / (1024 * 1024)) };
    }
  } catch { /* dir may not exist */ }
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let edition = await getOrCreateCurrentEdition();

  // If upload mode but video_url is empty, detect any existing file on disk and persist it
  if (edition && edition.video_source === 'upload' && !edition.video_url) {
    const disk = scanVideoOnDisk();
    if (disk) {
      edition = { ...edition, video_url: disk.url };
      await upsertEdition(edition);
    }
  }

  // Always scan disk and include in response so the frontend can show detected files
  const detectedVideo = scanVideoOnDisk();

  return NextResponse.json({ edition, detectedVideo });
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = getCurrentEditionId();
  const body = await req.json().catch(() => ({}));
  // Read the existing row so fields this form doesn't know about (e.g. the pitch
  // marker, edited from the live-monitor chart) aren't wiped out by this full save.
  const existing = await getEdition(editionId);

  // Upsert edition in Supabase
  await upsertEdition({
    id: editionId,
    live_date: editionId,
    video_source: body.video_source || 'youtube',
    video_url: body.video_url || '',
    video_duration: Number(body.video_duration) || 7200,
    sales_page_url: body.sales_page_url || '',
    chat_enabled: body.chat_enabled === false ? 0 : 1, // default 1 unless explicitly disabled
    chat_mode: body.chat_mode || 'general',
    cta_enabled: body.cta_enabled ? 1 : 0,
    cta_url: body.cta_url || '',
    cta_text: body.cta_text || '',
    cta_start_seconds: Number(body.cta_start_seconds) || 0,
    cta_end_seconds: Number(body.cta_end_seconds) || 3600,
    cta_auto_enabled: body.cta_auto_enabled ? 1 : 0,
    notifications_enabled: body.notifications_enabled === false ? 0 : 1, // default 1 unless explicitly disabled
    viewer_min: Number(body.viewer_min) || 210,
    viewer_max: Number(body.viewer_max) || 220,
    test_mode: body.test_mode ? 1 : 0,
    test_time: body.test_time || null,
    pitch_marker_seconds: body.pitch_marker_seconds !== undefined
      ? (body.pitch_marker_seconds === null ? null : Number(body.pitch_marker_seconds))
      : (existing?.pitch_marker_seconds ?? null),
  });

  return NextResponse.json({ ok: true });
}

// PATCH: partial update — only fields present in the body are changed, everything
// else on the row is left untouched. Accepts ?edition= like the live-metrics route
// so a field (e.g. the pitch marker) can be edited while looking at a past edition.
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const body = await req.json().catch(() => ({}));

  const existing = await getEdition(editionId);
  const base = existing || {
    id: editionId, live_date: editionId, video_source: 'youtube' as const,
    video_url: '', video_duration: 7200, sales_page_url: '',
    chat_enabled: 1, chat_mode: 'general' as const, cta_enabled: 0,
    cta_url: '', cta_text: '', cta_start_seconds: 0, cta_end_seconds: 3600,
    cta_auto_enabled: 0, cta_override: null, cta_override_at: null,
    notifications_enabled: 1,
    viewer_min: 210, viewer_max: 220,
    test_mode: 0, test_time: null,
    pitch_marker_seconds: null,
  };

  await upsertEdition({
    ...base,
    test_mode: body.test_mode !== undefined ? (body.test_mode ? 1 : 0) : base.test_mode,
    test_time: body.test_time !== undefined ? (body.test_time || null) : base.test_time,
    pitch_marker_seconds: body.pitch_marker_seconds !== undefined
      ? (body.pitch_marker_seconds === null ? null : Number(body.pitch_marker_seconds))
      : (base as { pitch_marker_seconds?: number | null }).pitch_marker_seconds ?? null,
  });

  return NextResponse.json({ ok: true });
}
