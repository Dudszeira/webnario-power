import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createEvent } from '@/lib/db';
import { verifyUserSessionFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function POST(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);
  const editionId = getCurrentEditionId();

  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || 'cta_click');
  const meta = JSON.stringify(body?.meta || {});

  await createEvent({
    id: `ev_${uuidv4()}`,
    edition_id: editionId,
    registration_id: session?.registrationId || null,
    type,
    metadata: meta
  });

  return NextResponse.json({ ok: true });
}
