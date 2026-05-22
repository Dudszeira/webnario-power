import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  getAdminComments, 
  insertComment, 
  updateCommentVisibility, 
  updateCommentPin 
} from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

// GET: All comments (real) for moderation
export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const comments = await getAdminComments(editionId);
  return NextResponse.json({ comments });
}

// POST: Create real_staff comment or pinned comment
export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = getCurrentEditionId();
  const body = await req.json().catch(() => ({}));

  const id = `c_${uuidv4()}`;
  await insertComment({
    id,
    edition_id: editionId,
    registration_id: null,
    type: body.type || 'real_staff',
    author_name: body.author_name || 'Staff',
    text: body.text || '',
    video_timestamp: null,
    is_pinned: body.is_pinned ? 1 : 0,
    pin_start_seconds: body.pin_start_seconds ?? null,
    pin_end_seconds: body.pin_end_seconds ?? null,
    visible: 1
  });
  return NextResponse.json({ ok: true, id });
}

// PATCH: Toggle visibility or pin
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, visible, is_pinned } = body;

  if (typeof visible === 'number') {
    await updateCommentVisibility(id, visible);
  }
  if (typeof is_pinned === 'number') {
    await updateCommentPin(id, is_pinned);
  }
  return NextResponse.json({ ok: true });
}
