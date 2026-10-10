import type { DateRange, EditionConfig, MetaAdDay } from './types.ts';
import { toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows } from './sheet-rows.ts';
import { buildEditions } from './editions.ts';
import { addDays } from './parse.ts';
import { creativeFamily } from './creatives.ts';
import {
  adsInWindows, backSummary, creativeTable, frontSummary, inRange, ticketSales, windows137,
  type BackSummary, type CreativeStats, type FrontSummary, type Window137,
} from './metrics.ts';
import { matchBuyers, type BuyerMatch } from './matching.ts';
import { dailyReport, editionReport, report137 } from './report.ts';
import { lastRuns, loadAdDays, loadAliases, loadEditionOverrides, loadPermalinks, loadSnapshots } from './store.ts';
import { loadAttendance } from './sources/platform.ts';

export type MarketingView = {
  editions: EditionConfig[]; selected: number[]; range: DateRange | null;
  front: FrontSummary; back: BackSummary; creatives: CreativeStats[]; windows: Window137[];
  buyers: BuyerMatch[]; icVsSales: { day: string; ic: number; sales: number }[];
  unmatched: { utmContents: string[]; adNames: string[] };
  permalinks: Record<string, string>;
  reports: { edition: string; daily: string; w137: string };
  sources: { source: string; ok: boolean; message: string; finished_at: string }[];
  stale: boolean;
};

const todayBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export async function buildView(selectedIn: number[], range: DateRange | null): Promise<MarketingView> {
  const today = todayBRT();
  const yesterday = addDays(today, -1);
  const [snap, overrides, aliases, adPermalinks, sources] = await Promise.all([
    loadSnapshots(), loadEditionOverrides(), loadAliases(), loadPermalinks(), lastRuns(),
  ]);
  const captures = toCaptureRows(snap.capture ?? []);
  const overview = toOverviewRows(snap.overview ?? []);
  const sales = toSaleRows(snap.sales ?? []);
  const schedules = toScheduleRows(snap.schedule ?? []);
  const editions = buildEditions(overview, overrides, today);

  const selected = selectedIn.length ? selectedIn : editions.slice(-1).map(e => e.number);
  const eds = editions.filter(e => selected.includes(e.number));
  const minStart = eds.reduce((m, e) => (e.windowStart < m ? e.windowStart : m), today);
  const maxEnd = eds.reduce((m, e) => (e.windowEnd > m ? e.windowEnd : m), minStart);
  const rawAds: MetaAdDay[] = eds.length ? await loadAdDays(minStart, maxEnd) : [];
  const ads = adsInWindows(rawAds, eds, range);

  const tickets = ticketSales(captures, selected).filter(s => inRange(s.at?.slice(0, 10) ?? null, range));
  const sheetSpend = (nums: number[]) => overview.filter(o => nums.includes(o.edition)).reduce((s, o) => s + o.investment, 0);
  const fullFallback = sheetSpend(selected);
  // "Investimento Total" da planilha é da edição inteira: não serve para um recorte de datas.
  const front = frontSummary(tickets, ads, eds, aliases, range ? 0 : fullFallback);
  // Calls, aplicações e vendas high ticket são sempre da edição inteira: custo contra a frente inteira.
  const frontFull = frontSummary(ticketSales(captures, selected), adsInWindows(rawAds, eds, null), eds, aliases, fullFallback);
  const back = backSummary(overview, schedules, sales, selected, frontFull);
  const first = eds[0];
  // Criativos e reports são rotulados pela primeira edição: só usam dados dela.
  const firstTickets = first ? ticketSales(captures, [first.number]) : [];
  const firstAds = first ? adsInWindows(rawAds, [first], null) : [];
  const creatives = first
    ? creativeTable(firstTickets.filter(s => inRange(s.at?.slice(0, 10) ?? null, range)), adsInWindows(rawAds, [first], range), first, aliases)
    : [];
  const windows = first ? windows137(firstTickets, firstAds, first, aliases, yesterday) : [];

  const buyers: BuyerMatch[] = [];
  for (const e of eds) {
    const ht = sales.filter(s => s.approved && s.edition === e.number)
      .map(s => ({ email: s.email, phone: s.phone, product: s.product, amount: s.amount }));
    const tk = tickets.filter(t => t.edition === e.number)
      .map(t => ({ email: t.email, phone: t.phone, product: 'Ingresso', amount: e.ticketPrice }));
    const att = await loadAttendance(e.liveDate);
    matchBuyers([...ht, ...tk], att, captures).forEach(m => buyers.push(m));
  }

  const byDay: Record<string, { ic: number; sales: number }> = {};
  const slot = (d: string) => byDay[d] || (byDay[d] = { ic: 0, sales: 0 });
  for (const a of ads) slot(a.date).ic += a.initiateCheckouts;
  for (const t of tickets) {
    const d = t.at?.slice(0, 10);
    if (d && eds.some(e => d >= e.windowStart && d <= e.windowEnd)) slot(d).sales += 1;
  }
  const icVsSales = Object.keys(byDay).sort().map(day => ({ day, ...byDay[day] }));

  const permalinks: Record<string, string> = {};
  for (const a of ads) {
    const f = creativeFamily(a.adName, aliases);
    if (!permalinks[f] && adPermalinks[a.adId]) permalinks[f] = adPermalinks[a.adId];
  }
  const toSet = (xs: string[]) => { const o: Record<string, true> = {}; xs.forEach(x => { o[x] = true; }); return o; };
  const adFamilies = toSet(ads.map(a => creativeFamily(a.adName, aliases)));
  const captureFamilies = toSet(captures.filter(c => c.edition !== null && selected.includes(c.edition)).map(c => creativeFamily(c.utmContent, aliases)));
  const saleFamilies = toSet(tickets.map(t => creativeFamily(t.utmContent, aliases)));
  const unmatched = {
    utmContents: Object.keys(saleFamilies).filter(f => !adFamilies[f]).sort(),
    adNames: Object.keys(adFamilies).filter(f => !saleFamilies[f] && !captureFamilies[f]).sort(),
  };

  const yAds = firstAds.filter(a => a.date === yesterday);
  const yTickets = firstTickets.filter(t => t.at?.slice(0, 10) === yesterday);
  const reports = first ? {
    edition: editionReport(first, frontSummary(firstTickets, firstAds, [first], aliases, sheetSpend([first.number])), creativeTable(firstTickets, firstAds, first, aliases), permalinks, dm(yesterday)),
    daily: dailyReport(first, frontSummary(yTickets, yAds, [first], aliases, 0), creativeTable(yTickets, yAds, first, aliases), permalinks, dm(yesterday)),
    w137: report137(windows, dm(yesterday)),
  } : { edition: '', daily: '', w137: '' };

  const capRun = sources.find(s => s.source === 'planilha:capture' && s.ok);
  const stale = !capRun || Date.now() - Date.parse(capRun.finished_at) > 30 * 60_000;

  return { editions, selected, range, front, back, creatives, windows, buyers, icVsSales, unmatched, permalinks, reports, sources, stale };
}
