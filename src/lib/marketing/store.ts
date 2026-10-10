import { supabase } from '@/lib/db';
import type { MetaAdDay } from './types.ts';
import type { TabKey } from './sheet-rows.ts';
import type { EditionOverride } from './editions.ts';

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function saveSnapshot(tab: TabKey, rows: Record<string, string>[]) {
  const { error } = await supabase.from('mkt_sheet_snapshot').upsert({ tab, rows, fetched_at: new Date().toISOString() });
  check(error, `snapshot ${tab}`);
}

export async function loadSnapshots(): Promise<Partial<Record<TabKey, Record<string, string>[]>>> {
  const { data, error } = await supabase.from('mkt_sheet_snapshot').select('tab, rows');
  check(error, 'snapshots');
  return Object.fromEntries((data ?? []).map(r => [r.tab, r.rows]));
}

export async function upsertAdDays(rows: MetaAdDay[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('mkt_meta_ad_daily').upsert(rows.slice(i, i + 500).map(r => ({
      date: r.date, ad_id: r.adId, ad_name: r.adName, adset_name: r.adsetName, campaign_name: r.campaignName,
      spend: r.spend, impressions: r.impressions, link_clicks: r.linkClicks, landing_views: r.landingViews,
      initiate_checkouts: r.initiateCheckouts, video_3s: r.video3s, thruplays: r.thruplays,
      updated_at: new Date().toISOString(),
    })));
    check(error, 'meta ad days');
  }
}

export async function loadAdDays(from: string, to: string): Promise<MetaAdDay[]> {
  const out: MetaAdDay[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('mkt_meta_ad_daily').select('*')
      .gte('date', from).lte('date', to).order('date').range(start, start + 999);
    check(error, 'load ad days');
    out.push(...(data ?? []).map(r => ({
      date: r.date, adId: r.ad_id, adName: r.ad_name, adsetName: r.adset_name, campaignName: r.campaign_name,
      spend: Number(r.spend), impressions: r.impressions, linkClicks: r.link_clicks, landingViews: r.landing_views,
      initiateCheckouts: r.initiate_checkouts, video3s: r.video_3s, thruplays: r.thruplays,
    })));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function hasAdDays(): Promise<boolean> {
  const { data, error } = await supabase.from('mkt_meta_ad_daily').select('date').limit(1);
  check(error, 'has ad days');
  return !!data?.length;
}

export async function upsertPermalinks(map: Record<string, string>) {
  const rows = Object.entries(map).map(([ad_id, permalink]) => ({ ad_id, permalink, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await supabase.from('mkt_meta_ad').upsert(rows);
  check(error, 'permalinks');
}

export async function loadPermalinks(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('mkt_meta_ad').select('ad_id, permalink');
  check(error, 'load permalinks');
  return Object.fromEntries((data ?? []).filter(r => r.permalink).map(r => [r.ad_id, r.permalink]));
}

export async function seedEditions(list: { number: number; liveDate: string }[]) {
  if (!list.length) return;
  const { error } = await supabase.from('mkt_editions')
    .upsert(list.map(e => ({ number: e.number, live_date: e.liveDate })), { onConflict: 'number', ignoreDuplicates: true });
  check(error, 'seed editions');
}

export async function loadEditionOverrides(): Promise<EditionOverride[]> {
  const { data, error } = await supabase.from('mkt_editions').select('*');
  check(error, 'editions');
  return (data ?? []).map(r => ({
    number: r.number,
    windowStart: r.window_start ?? undefined, windowEnd: r.window_end ?? undefined,
    ticketPrice: Number(r.ticket_price), cpaDream: Number(r.cpa_dream), cpaGood: Number(r.cpa_good), cpaLimit: Number(r.cpa_limit),
  }));
}

// Grava só os campos enviados: campo omitido não vira null (não congela a janela de captação).
// UPSERT por number: a edição pode ainda não ter sido semeada pelo sync (aí live_date, NOT NULL, é obrigatório).
export async function saveEditionOverride(o: EditionOverride) {
  const cols: Record<string, string | number> = { number: o.number, updated_at: new Date().toISOString() };
  const map: [keyof EditionOverride, string][] = [
    ['liveDate', 'live_date'], ['windowStart', 'window_start'], ['windowEnd', 'window_end'],
    ['ticketPrice', 'ticket_price'], ['cpaDream', 'cpa_dream'], ['cpaGood', 'cpa_good'], ['cpaLimit', 'cpa_limit'],
  ];
  map.forEach(([k, col]) => { if (o[k] !== undefined) cols[col] = o[k] as string | number; });
  const { error } = await supabase.from('mkt_editions').upsert(cols, { onConflict: 'number' });
  check(error, 'save edition');
}

export async function loadAliases(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('mkt_creative_alias').select('raw, family');
  check(error, 'aliases');
  return Object.fromEntries((data ?? []).map(r => [r.raw, r.family]));
}

export async function saveAlias(raw: string, family: string) {
  const { error } = await supabase.from('mkt_creative_alias').upsert({ raw: raw.trim().toLowerCase(), family: family.trim() });
  check(error, 'save alias');
}

export async function logRun(source: string, ok: boolean, message: string) {
  await supabase.from('mkt_sync_runs').insert({ source, ok, message, finished_at: new Date().toISOString() });
}

export async function lastRuns() {
  const { data } = await supabase.from('mkt_sync_runs').select('source, ok, message, finished_at')
    .order('id', { ascending: false }).limit(20);
  const seen = new Set<string>();
  return (data ?? []).filter(r => (seen.has(r.source) ? false : (seen.add(r.source), true)));
}
