import type { ApplicationRow, CaptureRow, OverviewCheck, OverviewRow, SaleRow, ScheduleRow, SurveyRow } from './types.ts';
import {
  findCol, findColAll, firstCol, normEmail, normHeader, parseBR, parseBROrNull, parseDateTime, parseDay,
  parseEditionNumber, shiftHours,
} from './parse.ts';

export type TabKey = 'capture' | 'overview' | 'sales' | 'schedule' | 'survey' | 'applications';
export const TAB_KEYS: TabKey[] = ['capture', 'overview', 'sales', 'schedule', 'survey', 'applications'];

// Obrigatórias por nome exato (comparado depois de normalizar espaços).
export const TAB_COLUMNS: Record<TabKey, string[]> = {
  capture: ['e-mail', 'whatsapp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'data', 'Webinário', 'Edição'],
  overview: ['Data', 'Webinário', 'Aplicações', 'Agendamentos PWR', 'Agendamentos PWS', 'Realizadas PWR', 'Realizadas PWS', 'Investimento Total'],
  sales: ['STATUS', 'Produto', 'Ticket', 'Email', 'Telefone', 'utm_content_captacao', 'utm_content_venda', 'Data', 'Webinário'],
  schedule: ['Motivo da perda', 'Closer', 'utm_content', 'SE - Agendada', 'Agendada em', 'SE - Data', 'Ganho em', 'SE - Realizada', 'E-mail - Trabalho', 'WEBNÁRIO'],
  survey: [],
  applications: [],
};

// Abas novas: o texto da pergunta muda; obrigatório = alguma coluna contém uma das agulhas.
export const TAB_NEEDLES: Record<TabKey, string[][]> = {
  capture: [], overview: [], sales: [], schedule: [],
  survey: [['e-mail', 'email'], ['renda familiar', 'renda']],
  applications: [['submitted'], ['e-mail', 'email'], ['produto']],
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
  const keys = Object.keys(records[0]);
  const present: Record<string, true> = Object.create(null);
  keys.forEach(k => { present[normHeader(k)] = true; });
  const missing = TAB_COLUMNS[tab].filter(c => !present[normHeader(c)])
    .concat(TAB_NEEDLES[tab].filter(alts => !findCol(keys, ...alts)).map(alts => alts[0]));
  if (missing.length) throw new SheetFormatError(tab, missing);
}

export const isRefund = (status: string) => /reembol|estorno|cancel/i.test(status ?? '');

// Ticket e números da Visão Geral: "16.788" = 16788 (ponto de milhar), como o dash antigo.
const num = (s: string) => parseBR(s);
const v = (r: Record<string, string>, k: string) => (r[k] ?? '').trim();
const cell = (r: Record<string, string>, k: string | null) => (k ? (r[k] ?? '').trim() : '');
const headersOf = (recs: Record<string, string>[]) => (recs.length ? Object.keys(recs[0]) : []);

// dealCol do dash antigo: para cada agulha, a 1ª coluna que a contém; vale se a célula não estiver vazia.
function dealCol(r: Record<string, string>, ...needles: string[]): string {
  const keys = Object.keys(r);
  for (let i = 0; i < needles.length; i++) {
    const n = needles[i].toLowerCase();
    const k = keys.filter(x => x.toLowerCase().includes(n))[0];
    if (k && (r[k] ?? '').trim()) return r[k].trim();
  }
  return '';
}

export function toCaptureRows(recs: Record<string, string>[]): CaptureRow[] {
  const h = headersOf(recs);
  const cName = findCol(h, 'nome');
  const cTerm = findCol(h, 'utm_term', 'utm term');
  return recs.map(r => ({
    email: normEmail(v(r, 'e-mail')),
    phone: v(r, 'whatsapp'),
    name: cell(r, cName),
    utmSource: v(r, 'utm_source'),
    utmMedium: v(r, 'utm_medium'),
    utmCampaign: v(r, 'utm_campaign'),
    utmTerm: cell(r, cTerm),
    utmContent: v(r, 'utm_content'),
    at: parseDateTime(v(r, 'data')),
    edition: parseEditionNumber(v(r, 'Webinário')),
    funnel: v(r, 'Edição'),
  }));
}

export function toSaleRows(recs: Record<string, string>[]): SaleRow[] {
  const h = headersOf(recs);
  const capSrc = firstCol(h, 'utm_source_captacao', 'utm_source_captação');
  const capMed = firstCol(h, 'utm_medium_captacao', 'utm_medium_captação');
  const capCmp = firstCol(h, 'utm_campaign_captacao', 'utm_campaign_captação');
  const saleSrc = firstCol(h, 'utm_source_venda', 'utm_source_vendas');
  const saleCmp = firstCol(h, 'utm_campaign_venda');
  const cName = firstCol(h, 'nome contato', 'nome');
  const cFunnel = findCol(h, 'edição', 'edicao');
  return recs.map(r => {
    const status = v(r, 'STATUS');
    return {
      approved: !isRefund(status),
      refunded: isRefund(status),
      status,
      product: v(r, 'Produto'),
      amount: num(v(r, 'Ticket')),
      email: normEmail(v(r, 'Email')),
      phone: v(r, 'Telefone'),
      name: cell(r, cName),
      utmContentCapture: v(r, 'utm_content_captacao'),
      utmContentSale: v(r, 'utm_content_venda'),
      capSource: cell(r, capSrc),
      capMedium: cell(r, capMed),
      capCampaign: cell(r, capCmp),
      saleSource: cell(r, saleSrc),
      saleCampaign: cell(r, saleCmp),
      funnel: cell(r, cFunnel),
      at: parseDateTime(v(r, 'Data')),
      edition: parseEditionNumber(v(r, 'Webinário')),
    };
  });
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
    title: dealCol(r, 'Título'),
    personName: dealCol(r, 'Pessoa - Nome', 'Pessoa de contato'),
    emails: [dealCol(r, 'E-mail - Trabalho'), dealCol(r, 'E-mail - Residencial'), dealCol(r, 'E-mail - Outros')]
      .filter(Boolean).map(normEmail),
    via: dealCol(r, 'SE - Agendada'),
    realizedRaw: dealCol(r, 'SE - Realizada').toLowerCase(),
    productRaw: dealCol(r, 'Produto (certo)', 'Produto'),
    income: dealCol(r, 'Renda Mensal'),
    value: parseBR(dealCol(r, 'Negócio - Valor', 'Valor')),
    utmSource: dealCol(r, 'utm_source'),
    utmCampaign: dealCol(r, 'utm_campaign'),
    utmMedium: dealCol(r, 'utm_medium'),
  }));
}

const sumOrNull = (...xs: (number | null)[]): number | null =>
  xs.every(x => x === null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0);

export function toOverviewRows(recs: Record<string, string>[]): OverviewRow[] {
  const h = headersOf(recs);
  const c = {
    peak: findCol(h, 'pico'),
    attendance: findCol(h, 'comparecimento'),
    metaSpend: findColAll(h, 'capta', 'meta'),
    revenue: findCol(h, 'faturamento total'),
    salesStart: findCol(h, 'vendas start'),
    salesDesafio: findCol(h, 'vendas desafio'),
    salesPower: h.filter(x => { const l = x.toLowerCase(); return l.includes('venda') && l.includes('power') && !l.includes('start'); })[0] ?? null,
  };
  const opt = (r: Record<string, string>, col: string | null) => (col ? parseBROrNull(r[col] ?? '') : null);
  // Comparecimento pode vir "45%" ou 0,45.
  const pct = (r: Record<string, string>) => {
    const raw = c.attendance ? (r[c.attendance] ?? '') : '';
    const n = parseBROrNull(raw);
    return n !== null && !raw.includes('%') && n > 0 && n < 1 ? Math.round(n * 10000) / 100 : n;
  };
  const out: OverviewRow[] = [];
  for (const r of recs) {
    const edition = parseEditionNumber(v(r, 'Webinário'));
    if (edition === null) continue;
    const check: OverviewCheck = {
      applications: opt(r, 'Aplicações'),
      scheduled: sumOrNull(opt(r, 'Agendamentos PWR'), opt(r, 'Agendamentos PWS')),
      done: sumOrNull(opt(r, 'Realizadas PWR'), opt(r, 'Realizadas PWS')),
      peak: opt(r, c.peak),
      attendance: pct(r),
      metaSpend: opt(r, c.metaSpend),
      investment: opt(r, 'Investimento Total'),
      sales: sumOrNull(opt(r, c.salesStart), opt(r, c.salesDesafio), opt(r, c.salesPower)),
      revenue: opt(r, c.revenue),
    };
    out.push({
      edition,
      dayMonth: v(r, 'Data'),
      applications: num(v(r, 'Aplicações')),
      scheduled: num(v(r, 'Agendamentos PWR')) + num(v(r, 'Agendamentos PWS')),
      done: num(v(r, 'Realizadas PWR')) + num(v(r, 'Realizadas PWS')),
      investment: num(v(r, 'Investimento Total')),
      check,
    });
  }
  return out;
}

export function toSurveyRows(recs: Record<string, string>[]): SurveyRow[] {
  const h = headersOf(recs);
  const c = {
    email: findCol(h, 'e-mail', 'email'),
    at: findCol(h, 'data de envio', 'submitted at', 'timestamp') ?? findCol(h, 'data') ?? findCol(h, 'hora'),
    tempo: findCol(h, 'tempo de fotografia', 'tempo'),
    servico: findCol(h, 'serviço carro', 'servico carro', 'carro-chefe', 'carro chefe'),
    renda: findCol(h, 'renda familiar', 'renda'),
    fat: findCol(h, 'faturamento'),
    conhece: findCol(h, 'conhece'),
    desafios: findCol(h, 'desafios'),
  };
  return recs
    .map(r => ({
      email: normEmail(cell(r, c.email)), at: parseDateTime(cell(r, c.at)), tempo: cell(r, c.tempo), servico: cell(r, c.servico),
      renda: cell(r, c.renda), fat: cell(r, c.fat), conhece: cell(r, c.conhece), desafios: cell(r, c.desafios),
    }))
    .filter(s => s.email);
}

export function toApplicationRows(recs: Record<string, string>[]): ApplicationRow[] {
  const h = headersOf(recs);
  const c = {
    email: findCol(h, 'e-mail', 'email'), phone: findCol(h, 'whatsapp'), name: findCol(h, 'nome completo', 'nome'),
    at: findCol(h, 'submitted'), product: findCol(h, 'produto'), income: findCol(h, 'renda mensal'),
    revenue: findCol(h, 'faturamento'), relation: findCol(h, 'relação com a fotografia', 'relacao com a fotografia'),
    interest: findCol(h, 'teria interesse', 'mentorias focadas'), calendar: findCol(h, 'escolha o dia', 'calendário', 'calendario'),
    src: findCol(h, 'utm_source'), med: findCol(h, 'utm_medium'), cmp: findCol(h, 'utm_campaign'), content: findCol(h, 'utm_content'),
  };
  return recs.map((r): ApplicationRow => {
    const raw = parseDateTime(cell(r, c.at));
    const interest = cell(r, c.interest);
    return {
      email: normEmail(cell(r, c.email)),
      phone: cell(r, c.phone),
      name: cell(r, c.name),
      // Submitted At vem em UTC; "01/01/0001" (sem data) já vira null no parseDateTime.
      at: shiftHours(raw, -3),
      product: cell(r, c.product),
      income: cell(r, c.income),
      revenue: cell(r, c.revenue),
      relation: cell(r, c.relation),
      interest: /^sim/i.test(interest) ? 'Sim' : /^n[aã]o/i.test(interest) ? 'Não' : '',
      scheduled: !!cell(r, c.calendar),
      utmSource: cell(r, c.src),
      utmMedium: cell(r, c.med),
      utmCampaign: cell(r, c.cmp),
      utmContent: cell(r, c.content),
    };
  });
}
