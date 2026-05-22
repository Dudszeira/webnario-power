import { NextRequest, NextResponse } from 'next/server';
import { getEdition, upsertEdition } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = getCurrentEditionId();
  const edition = await getEdition(editionId);
  return NextResponse.json({ edition: edition || { id: editionId } });
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = getCurrentEditionId();
  const body = await req.json().catch(() => ({}));

  // Upsert edition in Supabase
  await upsertEdition({
    id: editionId,
    live_date: editionId,
    video_source: body.video_source || 'youtube',
    video_url: body.video_url || '',
    video_duration: Number(body.video_duration) || 7200,
    sales_page_url: body.sales_page_url || '',
    chat_enabled: body.chat_enabled ? 1 : 0,
    chat_mode: body.chat_mode || 'general',
    cta_enabled: body.cta_enabled ? 1 : 0,
    cta_url: body.cta_url || '',
    cta_text: body.cta_text || '',
    cta_start_seconds: Number(body.cta_start_seconds) || 0,
    cta_end_seconds: Number(body.cta_end_seconds) || 3600,
    viewer_min: Number(body.viewer_min) || 210,
    viewer_max: Number(body.viewer_max) || 220,
  });

  return NextResponse.json({ ok: true });
}
