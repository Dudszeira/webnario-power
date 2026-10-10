import { fetchTab } from './sources/sheet.ts';
import { fetchMetaAdDays, fetchPermalinks, metaConfigured } from './sources/meta.ts';
import { toOverviewRows, type TabKey } from './sheet-rows.ts';
import { addDays, inferLiveDate } from './parse.ts';
import { logRun, saveSnapshot, seedEditions, upsertAdDays, upsertPermalinks } from './store.ts';

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // Brasília

const TAB_TITLES: Record<TabKey, string> = {
  capture: 'Captação',
  overview: 'Visão Geral',
  sales: 'Detalhamento Vendas',
  schedule: 'Detalhamento Agendamentos',
};

export async function runSync(opts: { metaDays: number }) {
  const results: { source: string; ok: boolean; message: string }[] = [];

  for (const tab of ['capture', 'overview', 'sales', 'schedule'] as TabKey[]) {
    try {
      const rows = await fetchTab(tab);
      await saveSnapshot(tab, rows);
      if (tab === 'overview') {
        const t = today();
        await seedEditions(toOverviewRows(rows)
          .map(o => ({ number: o.edition, liveDate: inferLiveDate(o.dayMonth, t) }))
          .filter((e): e is { number: number; liveDate: string } => e.liveDate !== null));
      }
      results.push({ source: `planilha:${tab}`, ok: true, message: `${rows.length} linhas` });
    } catch (e) {
      results.push({ source: `planilha:${tab}`, ok: false, message: `Aba "${TAB_TITLES[tab]}": ${(e as Error).message}` });
    }
  }

  if (!metaConfigured()) {
    results.push({ source: 'meta', ok: false, message: 'Token do Meta não configurado' });
  } else {
    try {
      const until = today();
      const days = await fetchMetaAdDays(addDays(until, -(opts.metaDays - 1)), until);
      await upsertAdDays(days);
      const ids = days.map(d => d.adId);
      await upsertPermalinks(await fetchPermalinks(ids.filter((x, i) => ids.indexOf(x) === i)));
      results.push({ source: 'meta', ok: true, message: `${days.length} linhas anúncio×dia` });
    } catch (e) {
      results.push({ source: 'meta', ok: false, message: (e as Error).message });
    }
  }

  for (const r of results) await logRun(r.source, r.ok, r.message);
  return results;
}
