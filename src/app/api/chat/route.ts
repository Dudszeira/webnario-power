import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
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
  const db = getDb();

  // Read authoritative settings from DB
  const edition = db.prepare('SELECT chat_mode, cta_enabled FROM editions WHERE id = ?').get(editionId) as any;
  const chatMode: string = edition?.chat_mode || 'general';
  const ctaEnabled: number = edition?.cta_enabled ?? 1;

  let comments;

  if (staffMember) {
    // Staff sees all real comments regardless of chat_mode
    comments = db.prepare(
      `SELECT id, type, author_name, text, reply, reply_author, created_at, is_pinned, pin_start_seconds, pin_end_seconds
       FROM comments
       WHERE edition_id = ? AND type IN ('real_user','real_staff') AND visible = 1 AND created_at > ?
       ORDER BY created_at ASC LIMIT 100`
    ).all(editionId, since);
  } else if (chatMode === 'isolated') {
    // Isolated: user sees own comments + real_staff only
    comments = db.prepare(
      `SELECT id, type, author_name, text, reply, reply_author, created_at, is_pinned, pin_start_seconds, pin_end_seconds
       FROM comments
       WHERE edition_id = ?
         AND type IN ('real_user','real_staff')
         AND visible = 1
         AND created_at > ?
         AND (type = 'real_staff' OR registration_id = ?)
       ORDER BY created_at ASC LIMIT 50`
    ).all(editionId, since, session!.registrationId);
  } else {
    // General: all real comments
    comments = db.prepare(
      `SELECT id, type, author_name, text, reply, reply_author, created_at, is_pinned, pin_start_seconds, pin_end_seconds
       FROM comments
       WHERE edition_id = ? AND type IN ('real_user','real_staff') AND visible = 1 AND created_at > ?
       ORDER BY created_at ASC LIMIT 50`
    ).all(editionId, since);
  }

  return NextResponse.json({ comments, cta_enabled: ctaEnabled });
}

// POST: Submit a real comment
export async function POST(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const editionId = getCurrentEditionId();
  if (session.editionId !== editionId) {
    return NextResponse.json({ error: 'Edição inválida' }, { status: 403 });
  }

  const db = getDb();
  const edition = db.prepare('SELECT chat_enabled FROM editions WHERE id = ?').get(editionId) as any;
  if (!edition?.chat_enabled) {
    return NextResponse.json({ error: 'Chat desabilitado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text || '').trim();
  if (!text || text.length > 500) {
    return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 });
  }

  const commentId = `c_${uuidv4()}`;
  db.prepare(
    `INSERT INTO comments (id, edition_id, registration_id, type, author_name, text)
     VALUES (?, ?, ?, 'real_user', ?, ?)`
  ).run(commentId, editionId, session.registrationId, session.name, text);

  return NextResponse.json({ ok: true, id: commentId });
}
