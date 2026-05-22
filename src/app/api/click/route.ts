import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { verifyUserSessionFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function POST(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);
  const editionId = getCurrentEditionId();

  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || 'cta_click');
  const meta = JSON.stringify(body?.meta || {});

  const db = getDb();
  db.prepare(
    `INSERT INTO events (id, edition_id, registration_id, type, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    `ev_${uuidv4()}`,
    editionId,
    session?.registrationId || null,
    type,
    meta
  );

  return NextResponse.json({ ok: true });
}
