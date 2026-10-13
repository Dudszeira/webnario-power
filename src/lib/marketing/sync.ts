import { fetchTab } from './sources/sheet.ts';
import { fetchMetaAdDays, fetchPermalinks } from './sources/meta.ts';
import { getMarketingSettings, metaConfigured } from './settings.ts';
import { TAB_KEYS, toOverviewRows, type TabKey } from './sheet-rows.ts';
import { addDays, inferLiveDate } from './parse.ts';
import { hasAdDays, logRun, saveSnapshot, seedEditions, upsertAdDays, upsertPermalinks } from './store.ts';

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // Brasília

export const TAB_TITLES: Record<TabKey, string> = {
  capture: 'Captação',
  overview: 'Visão Geral',
  sales: 'Detalhamento Vendas',
  schedule: 'Detalhamento Agendamentos',
  survey: 'Pesquisa [novo]',
  applications: 'Análise Individual (Typeform)',
};

export async function runSync(opts: { metaDays: number }) {
  const results: { source: string; ok: boolean; message: string }[] = [];
  const settings = await getMarketingSettings();

  for (const tab of TAB_KEYS) {
    try {
      const rows = await fetchTab(tab, settings);
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

  if (!metaConfigured(settings)) {
    results.push({ source: 'meta', ok: false, message: 'Token do Meta não configurado' });
  } else {
    let ids: string[] = [];
    try {
      const until = today();
      // 1º sync (tabela vazia): 90 dias, para janelas de edições anteriores não ficarem parciais.
      const metaDays = (await hasAdDays()) ? opts.metaDays : 90;
      const days = await fetchMetaAdDays(addDays(until, -(metaDays - 1)), until, settings);
      await upsertAdDays(days);
      ids = days.map(d => d.adId).filter((x, i, all) => all.indexOf(x) === i);
      results.push({ source: 'meta', ok: true, message: `${days.length} linhas anúncio×dia (${metaDays} dias)` });
    } catch (e) {
      results.push({ source: 'meta', ok: false, message: (e as Error).message });
    }
    if (ids.length) {
      // Permalinks são acessórios: falha aqui não marca "meta" como falho.
      try {
        const links = await fetchPermalinks(ids, settings);
        await upsertPermalinks(links);
        results.push({ source: 'meta:permalinks', ok: true, message: `${Object.keys(links).length} permalinks` });
      } catch (e) {
        results.push({ source: 'meta:permalinks', ok: false, message: (e as Error).message });
      }
    }
  }

  for (const r of results) await logRun(r.source, r.ok, r.message);
  return results;
}
