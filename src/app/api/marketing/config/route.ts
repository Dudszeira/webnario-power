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
  let saved = false;
  if (body?.edition && Number.isInteger(body.edition.number) && body.edition.number > 0) {
    const e = body.edition;
    await saveEditionOverride({
      number: e.number, windowStart: day(e.windowStart), windowEnd: day(e.windowEnd),
      ticketPrice: money(e.ticketPrice), cpaDream: money(e.cpaDream), cpaGood: money(e.cpaGood), cpaLimit: money(e.cpaLimit),
    });
    saved = true;
  }
  const raw = body?.alias?.raw;
  const family = body?.alias?.family;
  if (typeof raw === 'string' && typeof family === 'string' && raw.trim() && family.trim() && raw.length <= 200 && family.length <= 200) {
    await saveAlias(raw, family);
    saved = true;
  }
  if (!saved) return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
