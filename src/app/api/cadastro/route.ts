import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { createUserSession, getIP } from '@/lib/auth';
import { getCurrentEditionId, getLiveStartMs } from '@/lib/edition';

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const body = await req.json().catch(() => null);

  if (!body?.name || !body?.email) {
    return NextResponse.json({ error: 'Preencha nome e e-mail.' }, { status: 400 });
  }

  const name = String(body.name).trim();
  const email = String(body.email).trim().toLowerCase();

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const db = getDb();
  const editionId = getCurrentEditionId();

  // Ensure edition row exists
  const existing = db.prepare('SELECT id FROM editions WHERE id = ?').get(editionId);
  if (!existing) {
    const [y, m, d] = editionId.split('-');
    db.prepare(
      `INSERT INTO editions (id, live_date) VALUES (?, ?)`
    ).run(editionId, editionId);
  }

  // Check: same email already used in this edition → block
  const emailReg = db
    .prepare('SELECT id, ip, consumed FROM registrations WHERE edition_id = ? AND email = ?')
    .get(editionId, email) as any;

  if (emailReg) {
    // Same email: check if same IP or different IP
    if (emailReg.ip !== ip || emailReg.consumed) {
      const edition = db.prepare('SELECT sales_page_url FROM editions WHERE id = ?').get(editionId) as any;
      return NextResponse.json(
        { error: 'blocked', sales_page_url: edition?.sales_page_url || '' },
        { status: 409 }
      );
    }
    // Same email + same IP + not consumed → re-issue session (refresh)
    const token = await createUserSession({
      registrationId: emailReg.id,
      editionId,
      email,
      name,
    });

    const resp = NextResponse.json({ ok: true });
    resp.cookies.set('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 8,
      path: '/',
    });
    return resp;
  }

  // Check: same IP already used in this edition → block
  const ipReg = db
    .prepare('SELECT id, email FROM registrations WHERE edition_id = ? AND ip = ?')
    .get(editionId, ip) as any;

  if (ipReg) {
    const edition = db.prepare('SELECT sales_page_url FROM editions WHERE id = ?').get(editionId) as any;
    return NextResponse.json(
      { error: 'blocked', sales_page_url: edition?.sales_page_url || '' },
      { status: 409 }
    );
  }

  // Register new user
  const regId = `reg_${uuidv4()}`;
  try {
    db.prepare(
      `INSERT INTO registrations (id, edition_id, name, email, ip)
       VALUES (?, ?, ?, ?, ?)`
    ).run(regId, editionId, name, email, ip);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const edition = db.prepare('SELECT sales_page_url FROM editions WHERE id = ?').get(editionId) as any;
      return NextResponse.json(
        { error: 'blocked', sales_page_url: edition?.sales_page_url || '' },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }

  // Log page_view event
  db.prepare(
    `INSERT INTO events (id, edition_id, registration_id, type, metadata)
     VALUES (?, ?, ?, 'register', '{}')`
  ).run(`ev_${uuidv4()}`, editionId, regId);

  const token = await createUserSession({ registrationId: regId, editionId, email, name });
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 8,
    path: '/',
  });
  return resp;
}
