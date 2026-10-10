import type { CaptureRow, SaleRow, ScheduleRow, OverviewRow } from './types.ts';
import { normEmail, parseBRL, parseDateTime, parseDay, parseEditionNumber } from './parse.ts';

export type TabKey = 'capture' | 'overview' | 'sales' | 'schedule';

export const TAB_COLUMNS: Record<TabKey, string[]> = {
  capture: ['e-mail', 'whatsapp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'data', 'Webinário', 'Edição'],
  overview: ['Data', 'Webinário', 'Aplicações', 'Agendamentos PWR', 'Agendamentos PWS', 'Realizadas PWR', 'Realizadas PWS', 'Investimento Total'],
  sales: ['STATUS', 'Produto', 'Ticket', 'Email', 'Telefone', 'utm_content_captacao', 'utm_content_venda', 'Data', 'Webinário'],
  schedule: ['Motivo da perda', 'Closer', 'utm_content', 'SE - Agendada', 'Agendada em', 'SE - Data', 'Ganho em', 'SE - Realizada', 'E-mail - Trabalho', 'WEBNÁRIO'],
};

export class SheetFormatError extends Error {
  tab: string;
  missing: string[];
  constructor(tab: string, missing: string[]) {
    super(`colunas não encontradas: ${missing.join(', ') || '(aba vazia)'}`);
    this.tab = tab;
    this.missing = missing;
  }
}

export function checkHeaders(tab: TabKey, records: Record<string, string>[]): void {
  if (!records.length) throw new SheetFormatError(tab, []);
  const present = new Set(Object.keys(records[0]));
  const missing = TAB_COLUMNS[tab].filter(c => !present.has(c));
  if (missing.length) throw new SheetFormatError(tab, missing);
}

const num = (s: string) => parseBRL(s);
const v = (r: Record<string, string>, k: string) => (r[k] ?? '').trim();

export function toCaptureRows(recs: Record<string, string>[]): CaptureRow[] {
  return recs.map(r => ({
    email: normEmail(v(r, 'e-mail')),
    phone: v(r, 'whatsapp'),
    utmSource: v(r, 'utm_source'),
    utmMedium: v(r, 'utm_medium'),
    utmCampaign: v(r, 'utm_campaign'),
    utmContent: v(r, 'utm_content'),
    at: parseDateTime(v(r, 'data')),
    edition: parseEditionNumber(v(r, 'Webinário')),
    funnel: v(r, 'Edição'),
  }));
}

export function toSaleRows(recs: Record<string, string>[]): SaleRow[] {
  return recs.map(r => ({
    approved: v(r, 'STATUS').toLowerCase() === 'aprovada',
    product: v(r, 'Produto'),
    amount: num(v(r, 'Ticket')),
    email: normEmail(v(r, 'Email')),
    phone: v(r, 'Telefone'),
    utmContentCapture: v(r, 'utm_content_captacao'),
    utmContentSale: v(r, 'utm_content_venda'),
    at: parseDateTime(v(r, 'Data')),
    edition: parseEditionNumber(v(r, 'Webinário')),
  }));
}

export function toScheduleRows(recs: Record<string, string>[]): ScheduleRow[] {
  return recs.map(r => ({
    lostReason: v(r, 'Motivo da perda'),
    closer: v(r, 'Closer'),
    utmContent: v(r, 'utm_content'),
    scheduledAt: parseDay(v(r, 'Agendada em')),
    callDate: parseDay(v(r, 'SE - Data')),
    wonAt: parseDay(v(r, 'Ganho em')),
    done: v(r, 'SE - Realizada').toLowerCase() === 'sim',
    email: normEmail(v(r, 'E-mail - Trabalho')),
    edition: parseEditionNumber(v(r, 'WEBNÁRIO')),
  }));
}

export function toOverviewRows(recs: Record<string, string>[]): OverviewRow[] {
  const out: OverviewRow[] = [];
  for (const r of recs) {
    const edition = parseEditionNumber(v(r, 'Webinário'));
    if (edition === null) continue;
    out.push({
      edition,
      dayMonth: v(r, 'Data'),
      applications: num(v(r, 'Aplicações')),
      scheduled: num(v(r, 'Agendamentos PWR')) + num(v(r, 'Agendamentos PWS')),
      done: num(v(r, 'Realizadas PWR')) + num(v(r, 'Realizadas PWS')),
      investment: num(v(r, 'Investimento Total')),
    });
  }
  return out;
}
