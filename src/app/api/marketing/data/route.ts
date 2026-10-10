import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { buildView } from '@/lib/marketing/view';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const editions = (p.get('editions') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  const range = DAY.test(from) && DAY.test(to) && from <= to ? { from, to } : null;
  try {
    return NextResponse.json(await buildView(editions, range));
  } catch (e) {
    console.error('marketing data', e);
    return NextResponse.json({ error: 'Falha ao montar o painel' }, { status: 500 });
  }
}
