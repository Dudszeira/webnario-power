import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getMarketingSettings, saveMarketingSettings, metaConfigured, type MarketingSettings, type SettingKey } from '@/lib/marketing/settings';
import { fetchTab } from '@/lib/marketing/sources/sheet';
import { fetchAdAccountName } from '@/lib/marketing/sources/meta';
import { TAB_TITLES } from '@/lib/marketing/sync';
import type { TabKey } from '@/lib/marketing/sheet-rows';

export const dynamic = 'force-dynamic';

const TABS: TabKey[] = ['capture', 'overview', 'sales', 'schedule'];

// Nunca devolve o token do Meta inteiro.
function view(s: MarketingSettings) {
  return {
    sheetId: s.sheetId,
    gids: s.gids,
    metaAdAccount: s.metaAdAccount,
    metaApiVersion: s.metaApiVersion,
    metaToken: { configured: !!s.metaToken, last4: s.metaToken ? s.metaToken.slice(-4) : null, source: s.sources.metaToken },
    source: { sheetId: s.sources.sheetId, metaAdAccount: s.sources.metaAdAccount },
  };
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(view(await getMarketingSettings()));
}

type Rule = { key: SettingKey; label: string; ok: (v: string) => boolean };
const rule = (key: SettingKey, label: string, re: RegExp): Rule => ({ key, label, ok: v => re.test(v) });

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (req.nextUrl.searchParams.get('test') === '1') return NextResponse.json({ results: await test() });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  const gids = body.gids && typeof body.gids === 'object' ? body.gids : {};

  const fields: [Rule, unknown][] = [
    [rule('sheet_id', 'ID da planilha', /^[A-Za-z0-9_-]{20,100}$/), body.sheetId],
    [rule('meta_ad_account', 'ID da conta de anúncios', /^(act_)?\d{5,20}$/), body.metaAdAccount],
    [rule('meta_api_version', 'Versão da API do Meta', /^v\d{1,2}\.\d$/), body.metaApiVersion],
    [{ key: 'meta_token', label: 'Token de acesso do Meta', ok: v => v.length >= 20 && v.length <= 1000 && !/\s/.test(v) }, body.metaToken],
    ...TABS.map((t): [Rule, unknown] => [rule(`gid_${t}` as SettingKey, `gid da aba ${TAB_TITLES[t]}`, /^\d{1,12}$/), gids[t]]),
  ];

  const patch: Partial<Record<SettingKey, string>> = {};
  for (let i = 0; i < fields.length; i++) {
    const [r, raw] = fields[i];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') return NextResponse.json({ error: `${r.label} inválido` }, { status: 400 });
    const v = raw.trim();
    if (!v) continue; // vazio = manter o atual
    if (!r.ok(v)) return NextResponse.json({ error: `${r.label} inválido` }, { status: 400 });
    patch[r.key] = v;
  }

  try {
    await saveMarketingSettings(patch);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json(view(await getMarketingSettings()));
}

// Só leitura: não grava snapshot nem log.
async function test() {
  const s = await getMarketingSettings();
  const hide = (m: string) => (s.metaToken ? m.split(s.metaToken).join('••••') : m);
  const results = await Promise.all(TABS.map(async tab => {
    const source = `Planilha · ${TAB_TITLES[tab]}`;
    try {
      const rows = await fetchTab(tab, s);
      return { source, ok: true, message: `${rows.length} linhas, cabeçalho ok` };
    } catch (e) {
      return { source, ok: false, message: hide((e as Error).message) };
    }
  }));
  if (!metaConfigured(s)) {
    results.push({ source: 'Meta Ads', ok: false, message: s.metaToken ? 'ID da conta de anúncios não configurado' : 'Token do Meta não configurado' });
  } else {
    try {
      const name = await fetchAdAccountName(s);
      results.push({ source: 'Meta Ads', ok: true, message: name ? `Conta "${name}"` : 'Conectado' });
    } catch (e) {
      results.push({ source: 'Meta Ads', ok: false, message: hide((e as Error).message) });
    }
  }
  return results;
}
