import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

// GET: All comments (real) for moderation
export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const db = getDb();
  const comments = db
    .prepare(
      `SELECT * FROM comments WHERE edition_id = ? ORDER BY created_at DESC LIMIT 100`
    )
    .all(editionId);
  return NextResponse.json({ comments });
}

// POST: Create real_staff comment or pinned comment
export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = getCurrentEditionId();
  const body = await req.json().catch(() => ({}));

  const db = getDb();
  const id = `c_${uuidv4()}`;
  db.prepare(
    `INSERT INTO comments (id, edition_id, type, author_name, text, is_pinned, pin_start_seconds, pin_end_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    editionId,
    body.type || 'real_staff',
    body.author_name || 'Staff',
    body.text || '',
    body.is_pinned ? 1 : 0,
    body.pin_start_seconds ?? null,
    body.pin_end_seconds ?? null,
  );
  return NextResponse.json({ ok: true, id });
}

// PATCH: Toggle visibility or pin
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { id, visible, is_pinned } = body;

  const db = getDb();
  if (typeof visible === 'number') {
    db.prepare('UPDATE comments SET visible = ? WHERE id = ?').run(visible, id);
  }
  if (typeof is_pinned === 'number') {
    db.prepare('UPDATE comments SET is_pinned = ? WHERE id = ?').run(is_pinned, id);
  }
  return NextResponse.json({ ok: true });
}
