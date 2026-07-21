import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getEdition,
  getRealComments,
  getIsolatedComments,
  getSimulatedWithReplies,
  insertComment
} from '@/lib/db';
import { verifyUserSessionFromRequest, verifyStaffToken, verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

// GET: Poll for new real comments since a timestamp
export async function GET(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);

  // Staff token bypass: staff always get all comments
  const authHeader = req.headers.get('Authorization') || '';
  const sToken = authHeader.replace('Bearer ', '').trim();
  const staffMember = sToken ? await verifyStaffToken(sToken) : null;

  // Admin session bypass: admin preview mode can read comments (checked even when session is present)
  const isAdmin = !staffMember ? await verifyAdminFromRequest(req) : false;

  if (!session && !staffMember && !isAdmin) return NextResponse.json({ comments: [] });

  const editionId = getCurrentEditionId();
  // Edition isolation only applies to regular viewers — staff and admin bypass it
  if (session && !staffMember && !isAdmin && session.editionId !== editionId) return NextResponse.json({ comments: [] });

  const since = req.nextUrl.searchParams.get('since') || '1970-01-01T00:00:00.000Z';
  const isFull = req.nextUrl.searchParams.get('full') === '1';

  // Read authoritative settings from DB
  const edition = await getEdition(editionId);
  const chatMode: string = edition?.chat_mode || 'general';
  const ctaAutoEnabled: boolean = !!edition?.cta_auto_enabled;
  const ctaOverride: 'on' | 'off' | null = (edition?.cta_override as 'on' | 'off' | null) ?? null;
  const ctaOverrideAt: string | null = edition?.cta_override_at ?? null;
  const ctaStartSeconds: number = edition?.cta_start_seconds ?? 0;
  const ctaEndSeconds: number = edition?.cta_end_seconds ?? 0;
  const ctaUrl: string = edition?.cta_url || '';
  const ctaText: string = edition?.cta_text || '';

  let comments: Awaited<ReturnType<typeof getRealComments>> = [];

  if (staffMember || isAdmin) {
    // Staff and admin preview see all real comments
    comments = await getRealComments(editionId, since, 100);
  } else if (chatMode === 'isolated' && session) {
    // Isolated: user sees own comments + real_staff only (respects isolation on full refresh too)
    const isoCutoff = isFull ? '1970-01-01T00:00:00.000Z' : since;
    comments = await getIsolatedComments(editionId, isoCutoff, session.registrationId, 100);
  } else {
    // General: all real comments (incremental or full)
    const genCutoff = isFull ? '1970-01-01T00:00:00.000Z' : since;
    comments = await getRealComments(editionId, genCutoff, 100);
  }

  // On full refresh: also include simulated comments that received replies so
  // clients update reply fields in real-time. Excluded in isolated mode (users
  // there only see their own comments) and kept separate from the real array so
  // it does not corrupt lastPoll on the client.
  let simReplied: typeof comments = [];
  if (isFull && chatMode !== 'isolated') {
    simReplied = await getSimulatedWithReplies(editionId);
  }

  return NextResponse.json({
    comments,
    sim_replied: simReplied,
    cta_auto_enabled: ctaAutoEnabled,
    cta_override: ctaOverride,
    cta_override_at: ctaOverrideAt,
    cta_start_seconds: ctaStartSeconds,
    cta_end_seconds: ctaEndSeconds,
    cta_url: ctaUrl,
    cta_text: ctaText,
  });
}

// POST: Submit a real comment
export async function POST(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);

  // Staff members may post without a user session using their staff token
  const authHeader = req.headers.get('Authorization') || '';
  const sToken = authHeader.replace('Bearer ', '').trim();
  const staffMember = sToken ? await verifyStaffToken(sToken) : null;

  if (!session && !staffMember) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const editionId = getCurrentEditionId();
  // Edition isolation only applies to regular viewers — staff bypass it
  if (session && !staffMember && session.editionId !== editionId) {
    return NextResponse.json({ error: 'Edição inválida' }, { status: 403 });
  }

  const edition = await getEdition(editionId);
  if (!edition) {
    return NextResponse.json({ error: 'Edição não encontrada' }, { status: 404 });
  }
  if (!edition.chat_enabled && !staffMember) {
    return NextResponse.json({ error: 'Chat desabilitado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text || '').trim();
  if (!text || text.length > 500) {
    return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
  }

  const isStaffPost = !!staffMember;
  const commentId = `c_${uuidv4()}`;
  try {
    await insertComment({
      id: commentId,
      edition_id: editionId,
      registration_id: session?.registrationId ?? null,
      type: isStaffPost ? 'real_staff' : 'real_user',
      author_name: isStaffPost ? 'Equipe Kunz' : session!.name,
      text,
      video_timestamp: null,
      is_pinned: 0,
      pin_start_seconds: null,
      pin_end_seconds: null,
      visible: 1
    });
  } catch (e: any) {
    console.error('insertComment error:', e?.code, e?.message, e);
    return NextResponse.json({ error: 'Erro ao salvar comentário', code: e?.code ?? null }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: commentId });
}
