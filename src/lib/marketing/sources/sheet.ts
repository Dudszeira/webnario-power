import { parseCsv, toRecords } from '../parse.ts';
import { checkHeaders, type TabKey } from '../sheet-rows.ts';
import { getMarketingSettings, type MarketingSettings } from '../settings.ts';

export async function fetchTab(tab: TabKey, settings?: MarketingSettings): Promise<Record<string, string>[]> {
  const s = settings ?? await getMarketingSettings();
  if (!s.sheetId) throw new Error('ID da planilha não configurado');
  const url = `https://docs.google.com/spreadsheets/d/${s.sheetId}/export?format=csv&gid=${s.gids[tab]}`;
  const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/csv')) {
    throw new Error(`planilha inacessível (HTTP ${res.status}). Ela precisa estar como "qualquer pessoa com o link: leitor".`);
  }
  const records = toRecords(parseCsv(await res.text()));
  checkHeaders(tab, records);
  return records;
}
