import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  getEdition, 
  getRealComments, 
  getIsolatedComments, 
  insertComment 
} from '@/lib/db';
import { verifyUserSessionFromRequest, verifyStaffToken } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

// GET: Poll for new real comments since a timestamp
export async function GET(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);

  // Staff token bypass: staff always get all comments
  const authHeader = req.headers.get('Authorization') || '';
  const sToken = authHeader.replace('Bearer ', '').trim();
  const staffMember = sToken ? await verifyStaffToken(sToken) : null;

  if (!session && !staffMember) return NextResponse.json({ comments: [] });

  const editionId = getCurrentEditionId();
  if (session && session.editionId !== editionId) return NextResponse.json({ comments: [] });

  const since = req.nextUrl.searchParams.get('since') || '1970-01-01T00:00:00.000Z';

  // Read authoritative settings from DB
  const edition = await getEdition(editionId);
  const chatMode: string = edition?.chat_mode || 'general';
  const ctaEnabled: number = edition?.cta_enabled ?? 1;

  let comments;

  if (staffMember) {
    // Staff sees all real comments regardless of chat_mode
    comments = await getRealComments(editionId, since, 100);
  } else if (chatMode === 'isolated') {
    // Isolated: user sees own comments + real_staff only
    comments = await getIsolatedComments(editionId, since, session!.registrationId, 50);
  } else {
    // General: all real comments
    comments = await getRealComments(editionId, since, 50);
  }

  return NextResponse.json({ comments, cta_enabled: ctaEnabled });
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
  if (!edition?.chat_enabled) {
    return NextResponse.json({ error: 'Chat desabilitado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text || '').trim();
  if (!text || text.length > 500) {
    return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
  }

  const isStaffPost = !!staffMember;
  const commentId = `c_${uuidv4()}`;
  await insertComment({
    id: commentId,
    edition_id: editionId,
    registration_id: session?.registrationId ?? `staff_${commentId}`,
    type: isStaffPost ? 'real_staff' : 'real_user',
    author_name: isStaffPost ? 'Equipe Kunz' : session!.name,
    text,
    video_timestamp: null,
    is_pinned: 0,
    pin_start_seconds: null,
    pin_end_seconds: null,
    visible: 1
  });

  return NextResponse.json({ ok: true, id: commentId });
}
