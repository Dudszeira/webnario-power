import { mapInsightRow, type MetaInsightRow } from '../meta-map.ts';
import type { MetaAdDay } from '../types.ts';
import { getMarketingSettings, type MarketingSettings } from '../settings.ts';

const base = (s: MarketingSettings) => `https://graph.facebook.com/${s.metaApiVersion}`;
const accountId = (s: MarketingSettings) => s.metaAdAccount.replace(/^act_/, '');

// Teste de conexão (só leitura): nome da conta de anúncios.
export async function fetchAdAccountName(s: MarketingSettings): Promise<string> {
  const params = new URLSearchParams({ fields: 'name', access_token: s.metaToken });
  const res = await fetch(`${base(s)}/act_${accountId(s)}?${params}`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Meta: ${body.error?.message ?? `HTTP ${res.status}`}`);
  return body.name ?? '';
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

export async function fetchMetaAdDays(since: string, until: string, settings?: MarketingSettings): Promise<MetaAdDay[]> {
  const s = settings ?? await getMarketingSettings();
  const params = new URLSearchParams({
    level: 'ad',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,actions,video_thruplay_watched_actions',
    limit: '500',
    access_token: s.metaToken,
  });
  // A conta roda muitas campanhas além do webinário: sem filtrar na API, o Meta estoura o tempo
  // ("An unknown error occurred"). ponytail: trocar o filtro depois só vale para os dias sincronizados dali em diante.
  campaignFilter(params, s.metaCampaignFilter);
  const rows = await getAll<MetaInsightRow>(`${base(s)}/act_${accountId(s)}/insights?${params}`);
  return rows.map(mapInsightRow);
}

function campaignFilter(params: URLSearchParams, filter: string) {
  if (filter.trim()) params.set('filtering', JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: filter.trim() }]));
}

export async function fetchPermalinks(adIds: string[], settings?: MarketingSettings): Promise<Record<string, string>> {
  const s = settings ?? await getMarketingSettings();
  const out: Record<string, string> = {};
  for (let i = 0; i < adIds.length; i += 50) {
    const ids = adIds.slice(i, i + 50).join(',');
    const params = new URLSearchParams({ ids, fields: 'creative{instagram_permalink_url}', access_token: s.metaToken });
    const res = await fetch(`${base(s)}/?${params}`, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Meta: ${body.error?.message ?? `HTTP ${res.status}`}`);
    for (const [id, ad] of Object.entries(body as Record<string, { creative?: { instagram_permalink_url?: string } }>)) {
      const url = ad.creative?.instagram_permalink_url;
      if (url) out[id] = url;
    }
  }
  return out;
}

// Alcance e frequência não somam entre dias/anúncios: uma chamada por janela, nível conta, filtrando a campanha.
export async function fetchMetaWindow(since: string, until: string, filter: string, s: MarketingSettings): Promise<{ reach: number | null; frequency: number | null }> {
  const params = new URLSearchParams({
    level: 'account',
    fields: 'reach,frequency',
    time_range: JSON.stringify({ since, until }),
    access_token: s.metaToken,
  });
  campaignFilter(params, filter);
  const rows = await getAll<{ reach?: string; frequency?: string }>(`${base(s)}/act_${accountId(s)}/insights?${params}`);
  const r = rows[0];
  return { reach: r?.reach ? Number(r.reach) : null, frequency: r?.frequency ? Number(r.frequency) : null };
}
