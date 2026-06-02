import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getEdition,
  upsertEdition,
  getRegistrationByEmail,
  getRegistrationByIP,
  createRegistration,
  createEvent
} from '@/lib/db';
import { createUserSession, getIP } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function POST(req: NextRequest) {
  try {
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

  const editionId = getCurrentEditionId();

  // Ensure edition row exists
  const existing = await getEdition(editionId);
  if (!existing) {
    await upsertEdition({
      id: editionId,
      live_date: editionId,
      video_source: 'youtube',
      video_url: '',
      video_duration: 7200,
      sales_page_url: '',
      chat_enabled: 1,
      chat_mode: 'general',
      cta_enabled: 0,
      cta_url: '',
      cta_text: '',
      cta_start_seconds: 0,
      cta_end_seconds: 3600,
      viewer_min: 210,
      viewer_max: 220
    });
  }

  // Check: same email → re-issue session (user returning from any device)
  const emailReg = await getRegistrationByEmail(editionId, email);
  if (emailReg) {
    const token = await createUserSession({
      registrationId: emailReg.id,
      editionId,
      email: emailReg.email,
      name: emailReg.name,
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

  // Check: same IP + different email → re-issue the existing slot silently.
  // Prevents the same person from creating multiple registrations with different
  // e-mails. Family members on the same network share the slot (fine for live viewing).
  const ipReg = await getRegistrationByIP(editionId, ip);
  if (ipReg) {
    const token = await createUserSession({
      registrationId: ipReg.id,
      editionId,
      email: ipReg.email,
      name: ipReg.name,
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

  // Register new user
  const regId = `reg_${uuidv4()}`;
  try {
    await createRegistration({ id: regId, edition_id: editionId, name, email, ip });
  } catch (err: any) {
    if (err?.code === '23505') { // PostgreSQL Unique Constraint Violation
      const edition = await getEdition(editionId);
      return NextResponse.json(
        { error: 'blocked', sales_page_url: edition?.sales_page_url || '' },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }

  // Log page_view event
  await createEvent({
    id: `ev_${uuidv4()}`,
    edition_id: editionId,
    registration_id: regId,
    type: 'register',
    metadata: '{}'
  });

  const token = await createUserSession({ registrationId: regId, editionId, email, name });
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 8,
    path: '/',
  });
  return resp;
  } catch (err) {
    console.error('POST /api/cadastro unhandled error:', err);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
