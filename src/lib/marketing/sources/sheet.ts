import { parseCsv, toRecords } from '../parse.ts';
import { checkHeaders, type TabKey } from '../sheet-rows.ts';

// gids lidos em 2026-10-10. Buscar por gid: o endpoint por nome devolve a 1ª aba em silêncio.
export const SHEET_GIDS: Record<TabKey, string> = {
  capture: '0',
  overview: '214347056',
  sales: '2007849935',
  schedule: '1247583607',
};

export async function fetchTab(tab: TabKey): Promise<Record<string, string>[]> {
  const id = process.env.MKT_SHEET_ID;
  if (!id) throw new Error('MKT_SHEET_ID não configurado');
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${SHEET_GIDS[tab]}`;
  const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/csv')) {
    throw new Error(`planilha inacessível (HTTP ${res.status}). Ela precisa estar como "qualquer pessoa com o link: leitor".`);
  }
  const records = toRecords(parseCsv(await res.text()));
  checkHeaders(tab, records);
  return records;
}
