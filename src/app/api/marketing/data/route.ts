import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { buildView } from '@/lib/marketing/view';
import { buildTab, isPanelTab } from '@/lib/marketing/tabs';

// Abas pesadas (Edição com várias lives) podem passar dos 10 s padrão no primeiro acesso.
export const maxDuration = 60;

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
  const tab = p.get('tab');
  try {
    // Sem `tab`: o MarketingView de sempre (painel no ar não muda). Com `tab`: só aquela aba.
    if (tab === null) return NextResponse.json(await buildView(editions, range));
    if (!isPanelTab(tab)) return NextResponse.json({ error: 'Aba inválida' }, { status: 400 });
    return NextResponse.json(await buildTab(tab, editions, range, {
      lists: p.get('lists') === '1',
      renda: (p.get('renda') ?? 'all').slice(0, 20),
      produto: (p.get('produto') ?? 'todos').slice(0, 20),
    }));
  } catch (e) {
    console.error('marketing data', tab, e);
    return NextResponse.json({ error: 'Falha ao montar o painel' }, { status: 500 });
  }
}
