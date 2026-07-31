import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { getOrCreateCurrentEdition, getEditionMetrics, getOnlineCount } from '@/lib/db';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const editionId = getCurrentEditionId();
  const [metrics, online, edition] = await Promise.all([
    getEditionMetrics(editionId),
    getOnlineCount(editionId),
    getOrCreateCurrentEdition(),
  ]);

  return NextResponse.json({
    online,
    cta_clicks: metrics.ctaClicks,
    chat_mode: edition?.chat_mode || 'general',
    cta_auto_enabled: !!edition?.cta_auto_enabled,
    cta_override: (edition?.cta_override as 'on' | 'off' | null) ?? null,
    cta_override_at: edition?.cta_override_at ?? null,
  });
}
