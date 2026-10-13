// Dados de cada aba do painel (/api/marketing/data?tab=...). Só servidor: calcula só a aba pedida
// e lê só as abas da planilha que ela usa (Visão Geral sempre, para montar as edições).
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewRow, SaleRow, SurveyRow } from './types.ts';
import { toApplicationRows, toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows, toSurveyRows, type TabKey } from './sheet-rows.ts';
import { buildEditions, cycleStartAt, editionKind, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { buildDeals, dealsTab, type Deal, type DealsTab } from './deals.ts';
import { buyersTab, salesTab, type BuyersTab, type SalesTab } from './sales.ts';
import { filterAds } from './full-funnel.ts';
import { getMarketingSettings } from './settings.ts';
import { TAB_TITLES } from './sync.ts';
import { loadAdDays, loadEditionOverrides, loadSnapshotTimes, loadSnapshots } from './store.ts';
import { loadLive } from './sources/platform.ts';

export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo', 'agendamentos', 'vendas', 'compradores',
] as const;
export type PanelTab = typeof PANEL_TABS[number];
export const isPanelTab = (t: string): t is PanelTab => (PANEL_TABS as readonly string[]).indexOf(t) >= 0;
export type TabOptions = { lists: boolean; renda: string; produto: string };

export type TabData = {
  pesquisa: SurveyTab;
  aplicacoes: ApplicationsTab;
  aovivo: LiveTab;
  agendamentos: DealsTab;
  vendas: SalesTab;
  compradores: BuyersTab;
};
// Aba da planilha sem dados: a tela diz qual fonte falta, em vez de mostrar zeros.
export type MissingSources = { missing: string[] };

// Abas da planilha que cada aba do painel lê, além da Visão Geral. Ao vivo e Disparos não leem a Captação.
const NEEDS: Record<PanelTab, TabKey[]> = {
  pesquisa: ['capture', 'survey'],
  aplicacoes: ['capture', 'applications'],
  aovivo: [],
  agendamentos: ['capture', 'schedule', 'sales', 'survey'],
  vendas: ['capture', 'sales'],
  compradores: ['capture', 'sales', 'survey'],
};

// Linhas da planilha em memória da instância, por aba, enquanto o `fetched_at` do snapshot não muda.
// ponytail: some no cold start da Vercel; se ainda ficar lento, guardar o resultado por aba no banco.
type Entry = { at: string; recs: Record<string, string>[]; typed?: unknown[] };
const memo: Partial<Record<TabKey, Entry>> = {};
let surveyMemo: { key: string; value: Record<string, SurveyRow> } | null = null;

async function snapshots(tabs: TabKey[]): Promise<Partial<Record<TabKey, Entry>>> {
  const times = await loadSnapshotTimes(tabs);
  const stale = times.filter(t => { const m = memo[t.tab]; return !m || m.at !== t.fetchedAt; });
  if (stale.length) {
    const fresh = await loadSnapshots(stale.map(t => t.tab));
    stale.forEach(t => { memo[t.tab] = { at: t.fetchedAt, recs: fresh[t.tab] ?? [] }; });
  }
  const out: Partial<Record<TabKey, Entry>> = {};
  times.forEach(t => { out[t.tab] = memo[t.tab]; });
  return out;
}

// Conversão tipada também fica na memória, junto das linhas.
function typed<T>(e: Entry | undefined, convert: (recs: Record<string, string>[]) => T[]): T[] {
  if (!e) return [];
  if (!e.typed) e.typed = convert(e.recs);
  return e.typed as T[];
}

export type Ctx = {
  today: string; range: DateRange | null;
  editions: EditionConfig[]; selected: number[]; eds: EditionConfig[];
  snap: Partial<Record<TabKey, Entry>>;
  captures: CaptureRow[];   // Captação inteira
  leads: CaptureRow[];      // Captação das edições selecionadas, no período
  overview: OverviewRow[];
  surveys: Record<string, SurveyRow>;
};

const todayBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const day = (at: string | null) => (at ? at.slice(0, 10) : null);
const inSel = (c: Ctx, n: number | null) => n !== null && c.selected.indexOf(n) >= 0;

async function context(tab: PanelTab, selectedIn: number[], range: DateRange | null): Promise<Ctx | MissingSources> {
  const today = todayBRT();
  const need = (['overview'] as TabKey[]).concat(NEEDS[tab]);
  const [snap, overrides] = await Promise.all([snapshots(need), loadEditionOverrides()]);
  const missing = need.filter(t => { const e = snap[t]; return !e || !e.recs.length; }).map(t => TAB_TITLES[t]);
  if (missing.length) return { missing };
  const captures = typed(snap.capture, toCaptureRows);
  const overview = typed(snap.overview, toOverviewRows);
  const editions = buildEditions(overview, overrides, today);
  // Mesma regra do buildView: sem seleção, a edição mais recente.
  const selected = selectedIn.length ? selectedIn : editions.slice(-1).map(e => e.number);
  let surveys: Record<string, SurveyRow> = {};
  const sv = snap.survey, cap = snap.capture;
  if (sv && cap) {
    const key = `${sv.at}|${cap.at}`;
    if (!surveyMemo || surveyMemo.key !== key) surveyMemo = { key, value: latestSurveys(typed(sv, toSurveyRows), cycleStartAt(captures)) };
    surveys = surveyMemo.value;
  }
  const ctx: Ctx = {
    today, range, editions, selected, eds: editions.filter(e => selected.indexOf(e.number) >= 0),
    snap, captures, overview, leads: [], surveys,
  };
  ctx.leads = captures.filter(c => inSel(ctx, c.edition) && inRange(day(c.at), range));
  return ctx;
}

function applications(c: Ctx): Application[] {
  return buildApplications(typed(c.snap.applications, toApplicationRows), indexCaptures(c.captures), c.editions);
}

// Presença de lives que já passaram não muda mais: fica na memória da instância.
const liveMemo: Record<string, LiveStats | null> = {};

// Presença oficial por edição (plataforma). Edição sem evento ou com erro = null ("—" na tela).
async function liveByEdition(c: Ctx): Promise<Record<number, LiveStats | null>> {
  const out: Record<number, LiveStats | null> = {};
  await Promise.all(c.eds.map(async e => {
    const past = e.liveDate < c.today;
    if (past && e.liveDate in liveMemo) { out[e.number] = liveMemo[e.liveDate]; return; }
    try {
      const l = await loadLive(e.liveDate);
      const people = presenceFromEvents(l.events);
      out[e.number] = people.length ? liveStats(people, l.liveStartMs, l.pitchSeconds) : null;
      if (past) liveMemo[e.liveDate] = out[e.number];
    } catch {
      out[e.number] = null; // erro não vai para a memória: tenta de novo na próxima
    }
  }));
  return out;
}

function deals(c: Ctx): Deal[] {
  return buildDeals(typed(c.snap.schedule, toScheduleRows), typed(c.snap.sales, toSaleRows), indexCaptures(c.captures), c.surveys, c.editions, c.today);
}

// Anúncios das janelas selecionadas, só das campanhas que passam no filtro.
async function adsOf(c: Ctx): Promise<{ ads: MetaAdDay[]; filter: string }> {
  const settings = await getMarketingSettings();
  if (!c.eds.length) return { ads: [], filter: settings.metaCampaignFilter };
  const from = c.eds.reduce((m, e) => (e.windowStart < m ? e.windowStart : m), c.eds[0].windowStart);
  const to = c.eds.reduce((m, e) => (e.windowEnd > m ? e.windowEnd : m), c.eds[0].windowEnd);
  return { ads: filterAds(await loadAdDays(from, to), settings.metaCampaignFilter), filter: settings.metaCampaignFilter };
}

// Gasto oficial da edição. NF10K (#015–#020): "Investimento Total" da Visão Geral, como o dash antigo.
// Pago: Meta (campanhas filtradas) na janela; sem Meta, "Investimento Total"; sem nada, null ("n/d").
function spendByEdition(c: Ctx, ads: MetaAdDay[]): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  c.eds.forEach(e => {
    const ov = c.overview.filter(o => o.edition === e.number)[0];
    const sheet = ov && ov.investment > 0 ? ov.investment : null;
    if (editionKind(e.number) !== 'pago') { out[e.number] = sheet; return; }
    const meta = ads.filter(a => a.date >= e.windowStart && a.date <= e.windowEnd).reduce((s, a) => s + a.spend, 0);
    out[e.number] = meta > 0 ? Math.round(meta * 100) / 100 : sheet;
  });
  return out;
}

// Vendas high ticket das edições selecionadas; com período, só as datadas dentro dele.
function salesOf(c: Ctx): SaleRow[] {
  return typed(c.snap.sales, toSaleRows).filter(s => inSel(c, s.edition) && inRange(day(s.at), c.range));
}

type Builder<K extends PanelTab> = (c: Ctx, o: TabOptions) => TabData[K] | Promise<TabData[K]>;
const BUILDERS: { [K in PanelTab]: Builder<K> } = {
  pesquisa: (c, o) => surveyTab(c.leads, c.surveys, o.renda),
  aplicacoes: (c, o) => applicationsTab(applications(c), c.selected, c.range, o.lists),
  aovivo: async c => {
    const live = await liveByEdition(c);
    const editions = c.eds.map(e => ({ edition: e.number, liveDate: e.liveDate, stats: live[e.number] ?? null }));
    const stats: LiveStats[] = [];
    editions.forEach(e => { if (e.stats) stats.push(e.stats); });
    return { editions, totals: liveTotals(stats) };
  },
  agendamentos: async (c, o) => dealsTab(deals(c), c.eds, spendByEdition(c, (await adsOf(c)).ads), c.range, o.lists),
  vendas: (c, o) => salesTab(c.leads, salesOf(c), o.lists),
  compradores: (c, o) => buyersTab(salesOf(c), c.surveys, o.produto, o.lists),
};
export async function buildTab(tab: PanelTab, selected: number[], range: DateRange | null, o: TabOptions): Promise<TabData[PanelTab] | MissingSources> {
  const c = await context(tab, selected, range);
  if ('missing' in c) return c;
  return BUILDERS[tab](c, o);
}
