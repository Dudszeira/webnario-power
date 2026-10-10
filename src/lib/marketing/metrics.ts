import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewRow, SaleRow, ScheduleRow } from './types.ts';
import { creativeFamily } from './creatives.ts';
import { addDays } from './parse.ts';

export function div(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

const day = (at: string | null) => (at ? at.slice(0, 10) : null);

export function inRange(d: string | null, r: DateRange | null): boolean {
  if (!r) return true;
  return d !== null && d >= r.from && d <= r.to;
}

export function ticketSales(captures: CaptureRow[], editions: number[]): CaptureRow[] {
  const set = new Set(editions);
  return captures.filter(c => c.edition !== null && set.has(c.edition) && /pago/i.test(c.funnel));
}

export function adsInWindows(ads: MetaAdDay[], eds: EditionConfig[], r: DateRange | null): MetaAdDay[] {
  return ads.filter(a => eds.some(e => a.date >= e.windowStart && a.date <= e.windowEnd) && inRange(a.date, r));
}

export type FrontSummary = {
  sales: number; revenue: number; spend: number; spendSource: 'meta' | 'planilha' | 'nenhum';
  roas: number | null; cpa: number | null; cpaSellingAds: number | null;
  spendNoSales: number; topNoSale: { family: string; spend: number } | null;
  ic: number; costPerIc: number | null;
};

function spendByFamily(ads: MetaAdDay[], aliases: Record<string, string>) {
  const m = new Map<string, number>();
  for (const a of ads) {
    const f = creativeFamily(a.adName, aliases);
    m.set(f, (m.get(f) ?? 0) + a.spend);
  }
  return m;
}

function salesByFamily(sales: CaptureRow[], aliases: Record<string, string>) {
  const m = new Map<string, number>();
  for (const s of sales) {
    const f = creativeFamily(s.utmContent, aliases);
    m.set(f, (m.get(f) ?? 0) + 1);
  }
  return m;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function frontSummary(
  sales: CaptureRow[], ads: MetaAdDay[], eds: EditionConfig[],
  aliases: Record<string, string>, fallbackSpend: number,
): FrontSummary {
  const winAds = adsInWindows(ads, eds, null);
  const metaSpend = round2(winAds.reduce((s, a) => s + a.spend, 0));
  const spendSource = winAds.length ? 'meta' : fallbackSpend > 0 ? 'planilha' : 'nenhum';
  const spend = spendSource === 'meta' ? metaSpend : spendSource === 'planilha' ? fallbackSpend : 0;
  const price = eds[0]?.ticketPrice ?? 9.9;
  const revenue = round2(sales.length * price);
  const famSpend = spendByFamily(winAds, aliases);
  const famSales = salesByFamily(sales, aliases);
  let sellingSpend = 0;
  let spendNoSales = 0;
  let topNoSale: FrontSummary['topNoSale'] = null;
  famSpend.forEach((s, family) => {
    if ((famSales.get(family) ?? 0) > 0) sellingSpend += s;
    else {
      spendNoSales += s;
      if (!topNoSale || s > topNoSale.spend) topNoSale = { family, spend: round2(s) };
    }
  });
  const ic = winAds.reduce((s, a) => s + a.initiateCheckouts, 0);
  let salesFromSelling = 0;
  famSales.forEach((n, f) => { if (famSpend.has(f)) salesFromSelling += n; });
  return {
    sales: sales.length, revenue, spend, spendSource,
    // Sem investimento conhecido, CPA é "—" e não R$ 0,00.
    roas: div(revenue, spend), cpa: spendSource === 'nenhum' ? null : div(spend, sales.length),
    cpaSellingAds: div(sellingSpend, salesFromSelling),
    spendNoSales: round2(spendNoSales), topNoSale, ic, costPerIc: div(spend, ic),
  };
}

export type CreativeStats = {
  family: string; sales: number; spend: number; cpa: number | null; ic: number; costPerIc: number | null;
  impressions: number; ctr: number | null; hookRate: number | null; bodyRate: number | null;
  band: 'sonho' | 'bom' | 'limite' | 'acima' | null;
};

function band(cpa: number | null, cfg: EditionConfig): CreativeStats['band'] {
  if (cpa === null) return null;
  if (cpa <= cfg.cpaDream) return 'sonho';
  if (cpa <= cfg.cpaGood) return 'bom';
  if (cpa <= cfg.cpaLimit) return 'limite';
  return 'acima';
}

function statsFor(family: string, sales: number, ads: MetaAdDay[], cfg: EditionConfig): CreativeStats {
  const sum = (k: keyof MetaAdDay) => ads.reduce((s, a) => s + (a[k] as number), 0);
  const spend = round2(sum('spend'));
  const impressions = sum('impressions');
  const video3s = sum('video3s');
  const ic = sum('initiateCheckouts');
  // round2: 227.22/4 = 56.805 em float vira 56.80 no toFixed; relatório mostra 56.81.
  const raw = div(spend, sales);
  const cpa = raw === null ? null : round2(raw);
  return {
    family, sales, spend, cpa, ic, costPerIc: div(spend, ic), impressions,
    ctr: div(sum('linkClicks'), impressions), hookRate: div(video3s, impressions),
    bodyRate: div(sum('thruplays'), video3s), band: band(cpa, cfg),
  };
}

function table(sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig, aliases: Record<string, string>): CreativeStats[] {
  const famSales = salesByFamily(sales, aliases);
  const adsByFam = new Map<string, MetaAdDay[]>();
  for (const a of ads) {
    const f = creativeFamily(a.adName, aliases);
    adsByFam.set(f, [...(adsByFam.get(f) ?? []), a]);
  }
  const families: string[] = [];
  famSales.forEach((_, f) => families.push(f));
  adsByFam.forEach((_, f) => { if (!famSales.has(f)) families.push(f); });
  return families
    .map(f => statsFor(f, famSales.get(f) ?? 0, adsByFam.get(f) ?? [], cfg))
    .sort((a, b) => b.sales - a.sales || b.spend - a.spend);
}

export function creativeTable(sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig, aliases: Record<string, string>): CreativeStats[] {
  return table(sales, adsInWindows(ads, [cfg], null), cfg, aliases);
}

export type TrendLabel = 'estável' | 'caindo' | 'caindo forte' | 'sem entrega' | 'sem venda';
export type Window137 = { family: string; d1: CreativeStats; d3: CreativeStats; d7: CreativeStats; label: TrendLabel };

// ponytail: regra simples e explicável; ajustar os limites 1.15 / 1.5 se a equipe discordar dos rótulos.
function label(d1: CreativeStats, d3: CreativeStats, d7: CreativeStats): TrendLabel {
  if (d3.spend < 20 && d1.spend < 5) return 'sem entrega';
  if (d7.sales === 0) return 'sem venda';
  if (d3.sales === 0) return 'caindo';
  const ratio = (d3.cpa ?? 0) / (d7.cpa ?? 1);
  if (ratio <= 1.15) return 'estável';
  if (ratio <= 1.5) return 'caindo';
  return 'caindo forte';
}

export function windows137(
  sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig,
  aliases: Record<string, string>, yesterday: string,
): Window137[] {
  const win = (n: number) => {
    const r = { from: addDays(yesterday, -(n - 1)), to: yesterday };
    return table(sales.filter(s => inRange(day(s.at), r)), ads.filter(a => inRange(a.date, r)), cfg, aliases);
  };
  const [w1, w3, w7] = [win(1), win(3), win(7)];
  const empty = (family: string) => statsFor(family, 0, [], cfg);
  return w7.map(d7 => {
    const d1 = w1.find(x => x.family === d7.family) ?? empty(d7.family);
    const d3 = w3.find(x => x.family === d7.family) ?? empty(d7.family);
    return { family: d7.family, d1, d3, d7, label: label(d1, d3, d7) };
  });
}

export type BackSummary = {
  applications: number; scheduled: number; done: number;
  highTicketSales: number; highTicketRevenue: number;
  costPerScheduled: number | null; costPerDone: number | null; roasTotal: number | null;
};

export function backSummary(
  overview: OverviewRow[], schedules: ScheduleRow[], htSales: SaleRow[],
  editions: number[], front: FrontSummary,
): BackSummary {
  const set = new Set(editions);
  const ov = overview.filter(o => set.has(o.edition));
  const sch = schedules.filter(s => s.edition !== null && set.has(s.edition));
  const scheduled = sch.length ? sch.length : ov.reduce((s, o) => s + o.scheduled, 0);
  const done = sch.length ? sch.filter(s => s.done).length : ov.reduce((s, o) => s + o.done, 0);
  const ht = htSales.filter(s => s.approved && s.edition !== null && set.has(s.edition));
  const htRevenue = round2(ht.reduce((s, x) => s + x.amount, 0));
  return {
    applications: ov.reduce((s, o) => s + o.applications, 0),
    scheduled, done,
    highTicketSales: ht.length, highTicketRevenue: htRevenue,
    costPerScheduled: div(front.spend, scheduled), costPerDone: div(front.spend, done),
    roasTotal: div(front.revenue + htRevenue, front.spend),
  };
}
