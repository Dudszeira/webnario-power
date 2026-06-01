import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getEdition,
  getRealComments,
  getRecentRealComments,
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

  // Admin session bypass: admin preview mode can read comments
  const isAdmin = !session && !staffMember ? await verifyAdminFromRequest(req) : false;

  if (!session && !staffMember && !isAdmin) return NextResponse.json({ comments: [] });

  const editionId = getCurrentEditionId();
  if (session && session.editionId !== editionId) return NextResponse.json({ comments: [] });

  const since = req.nextUrl.searchParams.get('since') || '1970-01-01T00:00:00.000Z';
  const isFull = req.nextUrl.searchParams.get('full') === '1';

  // Read authoritative settings from DB
  const edition = await getEdition(editionId);
  const chatMode: string = edition?.chat_mode || 'general';
  const ctaEnabled: number = edition?.cta_enabled ?? 1;
  const ctaUrl: string = edition?.cta_url || '';
  const ctaText: string = edition?.cta_text || '';

  let comments;

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

  // On full refresh: also include simulated comments that received replies,
  // so clients can display replies in real-time without a page reload.
  if (isFull) {
    const simReplied = await getSimulatedWithReplies(editionId);
    if (simReplied.length) comments = [...comments, ...simReplied];
  }

  return NextResponse.json({ comments, cta_enabled: ctaEnabled, cta_url: ctaUrl, cta_text: ctaText });
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
  if (session && session.editionId !== editionId) {
    return NextResponse.json({ error: 'Edição inválida' }, { status: 403 });
  }

  const edition = await getEdition(editionId);
  if (!edition?.chat_enabled && !staffMember) {
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
    console.error('insertComment error:', e);
    return NextResponse.json({ error: 'Erro ao salvar comentário' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: commentId });
}
