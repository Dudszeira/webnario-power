import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = getCurrentEditionId();
  const db = getDb();
  const edition = db.prepare('SELECT * FROM editions WHERE id = ?').get(editionId);
  return NextResponse.json({ edition: edition || { id: editionId } });
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = getCurrentEditionId();
  const db = getDb();
  const body = await req.json().catch(() => ({}));

  // Upsert edition
  db.prepare(`
    INSERT INTO editions (
      id, live_date, video_source, video_url, video_duration,
      sales_page_url, chat_enabled, chat_mode,
      cta_enabled, cta_url, cta_text, cta_start_seconds, cta_end_seconds,
      viewer_min, viewer_max
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      video_source = excluded.video_source,
      video_url = excluded.video_url,
      video_duration = excluded.video_duration,
      sales_page_url = excluded.sales_page_url,
      chat_enabled = excluded.chat_enabled,
      chat_mode = excluded.chat_mode,
      cta_enabled = excluded.cta_enabled,
      cta_url = excluded.cta_url,
      cta_text = excluded.cta_text,
      cta_start_seconds = excluded.cta_start_seconds,
      cta_end_seconds = excluded.cta_end_seconds,
      viewer_min = excluded.viewer_min,
      viewer_max = excluded.viewer_max
  `).run(
    editionId,
    editionId,
    body.video_source || 'youtube',
    body.video_url || '',
    Number(body.video_duration) || 7200,
    body.sales_page_url || '',
    body.chat_enabled ? 1 : 0,
    body.chat_mode || 'general',
    body.cta_enabled ? 1 : 0,
    body.cta_url || '',
    body.cta_text || '',
    Number(body.cta_start_seconds) || 0,
    Number(body.cta_end_seconds) || 3600,
    Number(body.viewer_min) || 210,
    Number(body.viewer_max) || 220,
  );

  return NextResponse.json({ ok: true });
}
