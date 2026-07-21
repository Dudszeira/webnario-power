import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { getEdition, getEditionMetrics } from '@/lib/db';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const editionId = getCurrentEditionId();
  const metrics = await getEditionMetrics(editionId);
  const edition = await getEdition(editionId);

  return NextResponse.json({
    online: metrics.consumed,
    cta_clicks: metrics.ctaClicks,
    chat_mode: edition?.chat_mode || 'general',
    cta_auto_enabled: !!edition?.cta_auto_enabled,
    cta_override: (edition?.cta_override as 'on' | 'off' | null) ?? null,
    cta_override_at: edition?.cta_override_at ?? null,
  });
}
