import { mapInsightRow, type MetaInsightRow } from '../meta-map.ts';
import type { MetaAdDay } from '../types.ts';

const VERSION = process.env.META_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${VERSION}`;

export function metaConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

async function getAll<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  while (next) {
    const res: Response = await fetch(next, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Meta: ${body.error?.message ?? `HTTP ${res.status}`}`);
    out.push(...(body.data ?? []));
    next = body.paging?.next ?? null;
  }
  return out;
}

export async function fetchMetaAdDays(since: string, until: string): Promise<MetaAdDay[]> {
  const account = process.env.META_AD_ACCOUNT_ID!.replace(/^act_/, '');
  const params = new URLSearchParams({
    level: 'ad',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,actions,video_thruplay_watched_actions',
    limit: '500',
    access_token: process.env.META_ACCESS_TOKEN!,
  });
  const rows = await getAll<MetaInsightRow>(`${BASE}/act_${account}/insights?${params}`);
  return rows.map(mapInsightRow);
}

export async function fetchPermalinks(adIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < adIds.length; i += 50) {
    const ids = adIds.slice(i, i + 50).join(',');
    const params = new URLSearchParams({ ids, fields: 'creative{instagram_permalink_url}', access_token: process.env.META_ACCESS_TOKEN! });
    const res = await fetch(`${BASE}/?${params}`, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Meta: ${body.error?.message ?? `HTTP ${res.status}`}`);
    for (const [id, ad] of Object.entries(body as Record<string, { creative?: { instagram_permalink_url?: string } }>)) {
      const url = ad.creative?.instagram_permalink_url;
      if (url) out[id] = url;
    }
  }
  return out;
}
