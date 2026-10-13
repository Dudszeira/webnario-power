// Credenciais do painel de marketing: valor salvo na plataforma (mkt_settings) > env da Vercel > padrão.
// Só servidor. Sem cache global: cada chamada lê o banco (o runSync lê uma vez e repassa).
import { supabase } from '@/lib/db';
import type { TabKey } from './sheet-rows.ts';

export const SETTING_KEYS = [
  'sheet_id', 'gid_capture', 'gid_overview', 'gid_sales', 'gid_schedule', 'gid_survey', 'gid_applications',
  'meta_token', 'meta_ad_account', 'meta_api_version',
] as const;
export type SettingKey = typeof SETTING_KEYS[number];
export type SettingSource = 'plataforma' | 'vercel' | null;

// gids lidos em 2026-10-10 e 2026-10-13. Buscar por gid: o endpoint por nome devolve a 1ª aba em silêncio.
export const DEFAULT_GIDS: Record<TabKey, string> = {
  capture: '0',
  overview: '214347056',
  sales: '2007849935',
  schedule: '1247583607',
  survey: '503784201',
  applications: '336862755',
};

export type MarketingSettings = {
  sheetId: string;
  gids: Record<TabKey, string>;
  metaToken: string;
  metaAdAccount: string;
  metaApiVersion: string;
  sources: { sheetId: SettingSource; metaToken: SettingSource; metaAdAccount: SettingSource };
};

async function loadRows(): Promise<Partial<Record<SettingKey, string>>> {
  try {
    const { data, error } = await supabase.from('mkt_settings').select('key, value');
    if (error) return {};
    const out: Partial<Record<SettingKey, string>> = {};
    (data ?? []).forEach(r => { if (r.value?.trim()) out[r.key as SettingKey] = r.value.trim(); });
    return out;
  } catch {
    return {}; // ponytail: banco fora do ar não derruba o sync; cai no env.
  }
}

export async function getMarketingSettings(): Promise<MarketingSettings> {
  const db = await loadRows();
  const pick = (key: SettingKey, env?: string): [string, SettingSource] =>
    db[key] ? [db[key]!, 'plataforma'] : env?.trim() ? [env.trim(), 'vercel'] : ['', null];
  const [sheetId, sheetSrc] = pick('sheet_id', process.env.MKT_SHEET_ID);
  const [metaToken, tokenSrc] = pick('meta_token', process.env.META_ACCESS_TOKEN);
  const [metaAdAccount, accSrc] = pick('meta_ad_account', process.env.META_AD_ACCOUNT_ID);
  return {
    sheetId, metaToken, metaAdAccount,
    metaApiVersion: pick('meta_api_version', process.env.META_API_VERSION)[0] || 'v23.0',
    gids: {
      capture: db.gid_capture || DEFAULT_GIDS.capture,
      overview: db.gid_overview || DEFAULT_GIDS.overview,
      sales: db.gid_sales || DEFAULT_GIDS.sales,
      schedule: db.gid_schedule || DEFAULT_GIDS.schedule,
      survey: db.gid_survey || DEFAULT_GIDS.survey,
      applications: db.gid_applications || DEFAULT_GIDS.applications,
    },
    sources: { sheetId: sheetSrc, metaToken: tokenSrc, metaAdAccount: accSrc },
  };
}

export function metaConfigured(s: MarketingSettings): boolean {
  return !!(s.metaToken && s.metaAdAccount);
}

// Grava só chaves com valor não vazio; vazio = manter o atual. Nunca apaga.
export async function saveMarketingSettings(patch: Partial<Record<SettingKey, string>>) {
  const now = new Date().toISOString();
  const rows = SETTING_KEYS
    .filter(k => typeof patch[k] === 'string' && patch[k]!.trim())
    .map(k => ({ key: k, value: patch[k]!.trim(), updated_at: now }));
  if (!rows.length) return;
  const { error } = await supabase.from('mkt_settings').upsert(rows);
  if (error) throw new Error(`salvar integrações: ${error.message}`);
}
