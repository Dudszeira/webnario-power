import { NextRequest, NextResponse } from 'next/server';
import { verifyUserSessionFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  const session = await verifyUserSessionFromRequest(req);
  const editionId = getCurrentEditionId();

  if (!session || session.editionId !== editionId) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({ session });
}
