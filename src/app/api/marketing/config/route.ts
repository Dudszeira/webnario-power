import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { saveAlias, saveEditionOverride } from '@/lib/marketing/store';

const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (body?.edition && Number.isInteger(body.edition.number)) {
    const e = body.edition;
    await saveEditionOverride({
      number: e.number, windowStart: day(e.windowStart), windowEnd: day(e.windowEnd),
      ticketPrice: money(e.ticketPrice), cpaDream: money(e.cpaDream), cpaGood: money(e.cpaGood), cpaLimit: money(e.cpaLimit),
    });
  }
  if (typeof body?.alias?.raw === 'string' && typeof body?.alias?.family === 'string' && body.alias.raw.trim() && body.alias.family.trim()) {
    await saveAlias(body.alias.raw, body.alias.family);
  }
  return NextResponse.json({ ok: true });
}
