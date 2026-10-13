import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, MetaWindow } from './types.ts';
import { addDays } from './parse.ts';
import { div } from './metrics.ts';
import { PAGO_MIN } from './editions.ts';

export const DEFAULT_CAMPAIGN_FILTER = 'WB PG';
// Sem linha salva = padrão; linha salva vazia = todas as campanhas.
export const campaignFilterOf = (stored: string | undefined) => (stored === undefined ? DEFAULT_CAMPAIGN_FILTER : stored.trim());
export function matchesCampaign(name: string, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  return !f || (name ?? '').toLowerCase().includes(f);
}
export const filterAds = (ads: MetaAdDay[], filter: string) => ads.filter(a => matchesCampaign(a.campaignName, filter));

export type FunnelMetrics = {
  spend: number | null; impressions: number | null; reach: number | null; frequency: number | null; cpm: number | null;
  ctr: number | null; linkClicks: number | null; cpc: number | null; landingViews: number | null; loadRate: number | null;
  costPerView: number | null; ic: number | null; costPerIc: number | null; sales: number; pageToSale: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function funnelMetrics(ads: MetaAdDay[], sales: number, win: { reach: number | null; frequency: number | null } | null): FunnelMetrics {
  const reach = win ? win.reach : null, frequency = win ? win.frequency : null;
  if (!ads.length) {
    return {
      spend: null, impressions: null, reach, frequency, cpm: null, ctr: null, linkClicks: null, cpc: null,
      landingViews: null, loadRate: null, costPerView: null, ic: null, costPerIc: null, sales, pageToSale: null,
    };
  }
  const sum = (k: 'spend' | 'impressions' | 'linkClicks' | 'landingViews' | 'initiateCheckouts') => ads.reduce((s, a) => s + a[k], 0);
  const spend = round2(sum('spend')), imp = sum('impressions'), clicks = sum('linkClicks'), lpv = sum('landingViews'), ic = sum('initiateCheckouts');
  const cost = (n: number) => (spend > 0 ? div(spend, n) : null);
  return {
    spend, impressions: imp, reach, frequency,
    cpm: imp > 0 && spend > 0 ? (spend / imp) * 1000 : null,
    ctr: div(clicks, imp), linkClicks: clicks, cpc: cost(clicks),
    landingViews: lpv, loadRate: div(lpv, clicks), costPerView: cost(lpv),
    ic, costPerIc: cost(ic), sales, pageToSale: div(sales, lpv),
  };
}

export const FUNNEL_ROWS: { key: keyof FunnelMetrics; label: string; better: 'up' | 'down' | null; format: 'int' | 'money' | 'pct' | 'dec' }[] = [
  { key: 'spend', label: 'Investimento', better: null, format: 'money' },
  { key: 'impressions', label: 'Impressões', better: 'up', format: 'int' },
  { key: 'reach', label: 'Alcance', better: 'up', format: 'int' },
  { key: 'frequency', label: 'Frequência', better: null, format: 'dec' },
  { key: 'cpm', label: 'CPM', better: 'down', format: 'money' },
  { key: 'ctr', label: 'CTR do link', better: 'up', format: 'pct' },
  { key: 'linkClicks', label: 'Cliques no link', better: 'up', format: 'int' },
  { key: 'cpc', label: 'Custo por clique', better: 'down', format: 'money' },
  { key: 'landingViews', label: 'Visualizações da página', better: 'up', format: 'int' },
  { key: 'loadRate', label: 'Página carregada', better: 'up', format: 'pct' },
  { key: 'costPerView', label: 'Custo por visualização', better: 'down', format: 'money' },
  { key: 'ic', label: 'IC (pixel)', better: 'up', format: 'int' },
  { key: 'costPerIc', label: 'Custo por IC', better: 'down', format: 'money' },
  { key: 'sales', label: 'Vendas (UTM)', better: 'up', format: 'int' },
  { key: 'pageToSale', label: 'Página para venda', better: 'up', format: 'pct' },
];

// Dias de captação (sem o dia da live) já corridos até ontem; hoje é parcial no Meta e na planilha.
export function captureDays(ed: EditionConfig, today: string): number {
  const lastCapture = addDays(ed.liveDate, -1);
  const yesterday = addDays(today, -1);
  const end = yesterday < lastCapture ? yesterday : lastCapture;
  if (end < ed.windowStart) return 0;
  return Math.round((Date.parse(end) - Date.parse(ed.windowStart)) / 864e5) + 1;
}

// Vendas = linhas da Captação (funil PAGO) da edição cuja utm_campaign passa no filtro.
export function ticketSalesIn(captures: CaptureRow[], edition: number, filter: string, range: DateRange | null): number {
  return captures.filter(c => {
    if (c.edition !== edition || !/pago/i.test(c.funnel) || !matchesCampaign(c.utmCampaign, filter)) return false;
    if (!range) return true;
    const d = c.at ? c.at.slice(0, 10) : null;
    return d !== null && d >= range.from && d <= range.to;
  }).length;
}

export type FunnelColumn = { edition: number; from: string; to: string; metrics: FunnelMetrics };
export type FunnelCompare = {
  prev: number; cur: number; cutDays: number; prevRange: DateRange; curRange: DateRange;
  prevSales: number; curSales: number; // vendas no mesmo nº de dias de captação
  deltas: Partial<Record<keyof FunnelMetrics, number | null>>; reachComparable: boolean;
};
export type FullFunnel = { filter: string; columns: FunnelColumn[]; compare: FunnelCompare | null };

const inDays = (ads: MetaAdDay[], from: string, to: string) => ads.filter(a => a.date >= from && a.date <= to);

// `ads` já vem filtrado pelo filtro de campanha. Coluna = edição inteira (inclui o dia da live);
// variação entre as duas últimas com o mesmo número de dias de captação, definido pela edição mais recente.
export function fullFunnel(eds: EditionConfig[], ads: MetaAdDay[], captures: CaptureRow[], windows: MetaWindow[], filter: string, today: string): FullFunnel {
  const win = (n: number) => windows.filter(w => w.edition === n)[0] ?? null;
  const columns = eds.map(e => ({
    edition: e.number, from: e.windowStart, to: e.windowEnd,
    metrics: funnelMetrics(inDays(ads, e.windowStart, e.windowEnd), ticketSalesIn(captures, e.number, filter, null), win(e.number)),
  }));
  if (eds.length < 2) return { filter, columns, compare: null };
  const prevEd = eds[eds.length - 2], curEd = eds[eds.length - 1];
  const cutDays = captureDays(curEd, today);
  if (cutDays === 0) return { filter, columns, compare: null };
  const rangeOf = (e: EditionConfig): DateRange => {
    const last = addDays(e.liveDate, -1), end = addDays(e.windowStart, cutDays - 1);
    return { from: e.windowStart, to: end < last ? end : last };
  };
  const pr = rangeOf(prevEd), cr = rangeOf(curEd);
  const pm = funnelMetrics(inDays(ads, pr.from, pr.to), ticketSalesIn(captures, prevEd.number, filter, pr), null);
  const cm = funnelMetrics(inDays(ads, cr.from, cr.to), ticketSalesIn(captures, curEd.number, filter, cr), null);
  // Alcance não soma por dia: só compara edições encerradas com janelas de mesma duração.
  const wp = win(prevEd.number), wc = win(curEd.number);
  const span = (w: MetaWindow) => Date.parse(w.until) - Date.parse(w.since);
  const reachComparable = !!(wp && wc && today > curEd.liveDate && span(wp) === span(wc));
  const deltas: Partial<Record<keyof FunnelMetrics, number | null>> = {};
  FUNNEL_ROWS.forEach(r => {
    const reachy = r.key === 'reach' || r.key === 'frequency';
    const pick = (w: MetaWindow | null, m: FunnelMetrics) =>
      reachy ? (reachComparable && w ? w[r.key as 'reach' | 'frequency'] : null) : m[r.key];
    const a = pick(wp, pm), b = pick(wc, cm);
    deltas[r.key] = a !== null && b !== null && a !== 0 ? (b - a) / a : null;
  });
  return { filter, columns, compare: { prev: prevEd.number, cur: curEd.number, cutDays, prevRange: pr, curRange: cr, prevSales: pm.sales, curSales: cm.sales, deltas, reachComparable } };
}

// Janelas de alcance que o sync pede ao Meta: edições pagas já começadas, até hoje.
export function metaWindowRanges(eds: EditionConfig[], today: string): { edition: number; since: string; until: string }[] {
  return eds
    .filter(e => e.number >= PAGO_MIN && e.windowStart <= today)
    .map(e => ({ edition: e.number, since: e.windowStart, until: e.windowEnd < today ? e.windowEnd : today }));
}
