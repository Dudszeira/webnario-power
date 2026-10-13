import type { DateRange, SaleRow, ScheduleRow, SurveyRow } from './types.ts';
import { addDays, normName } from './parse.ts';
import { CYCLE_MIN, editionKind, lastLiveOnOrBefore, latestCycleCapture, type CaptureIndex } from './editions.ts';
import { normProd, saleValue } from './sales.ts';
import { LABEL_RENDA } from './survey.ts';
import { countBy, inRange, type Count } from './metrics.ts';

export type DealStatus = 'agendada' | 'realizada' | 'reagendada' | 'cancelada' | 'nao_realizada' | 'sem_registro' | 'perdido' | 'ganho' | 'reembolsado';
export const STATUS_LABEL: Record<DealStatus, string> = {
  agendada: 'Agendada', realizada: 'Realizada', reagendada: 'Reagendada', cancelada: 'Cancelada', nao_realizada: 'Não compareceu',
  sem_registro: 'Sem registro', perdido: 'Perdido', ganho: 'Ganho', reembolsado: 'Reembolsado',
};

// "today" = data de Brasília (YYYY-MM-DD). Call hoje conta como futura.
export function dealStatus(
  d: { won: boolean; saleOk: boolean; saleRefunded: boolean; lostReason: string; realizedRaw: string; callDate: string | null },
  today: string,
): DealStatus {
  if (d.won || d.saleOk) return d.saleOk ? 'ganho' : d.saleRefunded ? 'reembolsado' : 'ganho';
  if (d.lostReason) return 'perdido';
  const r = d.realizedRaw.toLowerCase();
  if (r.startsWith('sim')) return 'realizada';
  if (/reagend/.test(r)) return 'reagendada';
  if (/cancel/.test(r)) return 'cancelada';
  if (/no show/.test(r)) return 'nao_realizada';
  if (/^n[aã]o/.test(r)) return d.callDate && d.callDate >= today ? 'agendada' : 'nao_realizada';
  return d.callDate && d.callDate < today ? 'sem_registro' : 'agendada';
}

export type Deal = {
  name: string; type: 'SE' | 'WB' | ''; closer: string; via: string; product: string;
  scheduledAt: string | null; callDate: string | null; realized: boolean; lostReason: string;
  status: DealStatus; alerts: string[]; income: string; value: number;
  edition: number | null; editionBy: 'planilha' | 'email' | 'data' | null;
  creative: string;   // utm_content do negócio, senão o do lead
  utmContent: string; // utm_content do próprio negócio ("Via API")
  utmSource: string;
};

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function buildDeals(
  rows: ScheduleRow[], sales: SaleRow[], idx: CaptureIndex, surveys: Record<string, SurveyRow>,
  eds: { number: number; liveDate: string }[], today: string,
): Deal[] {
  // Venda do Detalhamento Vendas (valor oficial): por e-mail, senão por nome normalizado.
  const byEmail: Record<string, SaleRow[]> = Object.create(null);
  const byName: Record<string, SaleRow[]> = Object.create(null);
  sales.filter(s => s.edition !== null && s.edition >= CYCLE_MIN).forEach(s => {
    if (s.email) (byEmail[s.email] || (byEmail[s.email] = [])).push(s);
    const nn = normName(s.name);
    if (nn) (byName[nn] || (byName[nn] = [])).push(s);
  });
  return rows.map((r): Deal => {
    const name = r.personName || r.title.replace(/^(SE|WB)\s*-\s*/i, '');
    // Webinário: coluna WEBNÁRIO > captação pelo e-mail (até agendamento + 1 dia) > última live até o agendamento.
    const lead = latestCycleCapture(idx, r.emails, r.scheduledAt ? `${addDays(r.scheduledAt, 1)}T00:00:00` : null);
    const byDate = lastLiveOnOrBefore(eds, r.scheduledAt);
    const edition = r.edition ?? (lead ? lead.edition : byDate);
    const editionBy = r.edition !== null ? 'planilha' : lead ? 'email' : byDate !== null ? 'data' : null;
    // Negócio NF10K só casa com venda de #015–#020; negócio do pago, com venda do pago (como o dash antigo, por ciclo).
    const sameCycle = (s: SaleRow) => edition === null || editionKind(s.edition as number) === editionKind(edition);
    let mine: SaleRow[] = [];
    r.emails.forEach(e => { (byEmail[e] || []).forEach(s => mine.push(s)); });
    if (!mine.length) { const nn = normName(name); if (nn) mine = byName[nn] || []; }
    mine = mine.filter(sameCycle);
    const saleOk = mine.filter(s => !s.refunded)[0] ?? null;
    const saleRef = saleOk ? null : mine.filter(s => s.refunded)[0] ?? null;
    const status = dealStatus({
      won: !!r.wonAt, saleOk: !!saleOk, saleRefunded: !!saleRef, lostReason: r.lostReason, realizedRaw: r.realizedRaw, callDate: r.callDate,
    }, today);
    const alerts: string[] = [];
    const gap = r.scheduledAt && r.callDate ? days(r.scheduledAt, r.callDate) : null;
    if (gap !== null && gap > 14) alerts.push(`call marcada ${gap} dias depois do agendamento`);
    if (gap !== null && gap < 0) alerts.push('call antes do agendamento');
    if (status === 'sem_registro') alerts.push('call já passou sem registro');
    if (!r.closer) alerts.push('sem closer');
    const survey = r.emails.map(e => surveys[e]).filter(Boolean)[0];
    const viaRaw = r.via.toLowerCase();
    const isWB = /^wb\b/i.test(r.title), isSE = /^se\b/i.test(r.title);
    return {
      name, type: isSE ? 'SE' : isWB ? 'WB' : '', closer: r.closer,
      via: viaRaw.includes('comercial') ? 'Comercial' : viaRaw.includes('autom') ? 'Automático' : r.via,
      product: r.productRaw || (isWB ? 'Power' : isSE ? 'Start' : ''),
      scheduledAt: r.scheduledAt, callDate: r.callDate, realized: r.realizedRaw.startsWith('sim'), lostReason: r.lostReason,
      status, alerts,
      income: r.income || (survey ? LABEL_RENDA[survey.renda] ?? survey.renda : ''),
      value: saleOk ? saleValue(saleOk) : 0,
      edition, editionBy, creative: r.utmContent || (lead ? lead.utmContent : ''), utmContent: r.utmContent, utmSource: r.utmSource,
    };
  });
}

// Call feita: realizada, ganho, reembolsado ou perdido depois da call.
export const dealDone = (d: Deal) =>
  d.status === 'realizada' || d.status === 'ganho' || d.status === 'reembolsado' || (d.status === 'perdido' && d.realized);

export type MomentCat = 'ganho' | 'perdCall' | 'perdSem' | 'andamento' | 'aberto';
export function momentCat(d: Deal): MomentCat {
  if (d.status === 'ganho' || d.status === 'reembolsado') return 'ganho';
  if (d.status === 'perdido' && d.realized) return 'perdCall';
  if (d.status === 'nao_realizada' || d.status === 'perdido' || d.status === 'cancelada') return 'perdSem';
  if (d.status === 'realizada') return 'andamento';
  return 'aberto';
}

export type CatCounts = { total: number; ganho: number; perdCall: number; perdSem: number; andamento: number; aberto: number };
const emptyCats = (): CatCounts => ({ total: 0, ganho: 0, perdCall: 0, perdSem: 0, andamento: 0, aberto: 0 });
const addCat = (c: CatCounts, d: Deal) => { c.total++; c[momentCat(d)]++; };

export type CostRow = {
  edition: number | null; spend: number | null; n: number; power: number; start: number;
  cost: number | null; costPower: number | null; costStart: number | null;
};
export type DealListItem = {
  name: string; type: string; scheduledAt: string | null; callDate: string | null; via: string; status: DealStatus; closer: string;
  product: string; income: string; edition: number | null; creative: string; lostReason: string; alerts: string[];
};
export type LosingCreative = {
  creative: string; n: number; noShow: number; noInterest: number; cancelled: number; lost: number; rate: number;
  calls: number; won: number; open: number; tone: 'red' | 'yellow' | 'green';
};
export type DealsTab = {
  total: number; noEdition: number; power: number; start: number; auto: number; commercial: number;
  realized: number; attendance: number | null; noShow: number; waiting: number; cancelled: number;
  lost: number; lostByReason: Count[]; won: number; wonRevenue: number; wonRate: number | null; refunded: number;
  origin: { planilha: number; email: number; data: number };
  alertCount: number;
  moment: { edition: number; before: CatCounts; onDay: CatCounts; after: CatCounts }[];
  momentTotal: { before: CatCounts; onDay: CatCounts; after: CatCounts };
  losingCreatives: LosingCreative[];
  lostBeforeCall: number;
  costPerCall: { rows: CostRow[]; total: CostRow };
  byEdition: Count[]; via: Count[]; closer: Count[]; status: Count[];
  list: DealListItem[] | null;
};

const ed = (n: number) => `#${String(n).padStart(3, '0')}`;
const per = (spend: number | null, n: number) => (spend !== null && spend > 0 && n > 0 ? spend / n : null);

export function dealsTab(
  all: Deal[], eds: { number: number; liveDate: string }[], spend: Record<number, number | null>,
  range: DateRange | null, lists: boolean,
): DealsTab {
  const selected = eds.map(e => e.number);
  const inPeriod = all.filter(d => inRange(d.scheduledAt, range));
  const deals = inPeriod.filter(d => d.edition !== null && selected.indexOf(d.edition) >= 0);
  const count = (s: DealStatus) => deals.filter(d => d.status === s).length;
  const realized = deals.filter(dealDone).length;
  const noShow = count('nao_realizada');
  const won = count('ganho');

  // Quando agendaram: dia do agendamento − dia da live da edição.
  const moment = eds.map(e => {
    const row = { edition: e.number, before: emptyCats(), onDay: emptyCats(), after: emptyCats() };
    deals.filter(d => d.edition === e.number && d.scheduledAt).forEach(d => {
      const off = days(e.liveDate, d.scheduledAt as string);
      addCat(off < 0 ? row.before : off === 0 ? row.onDay : row.after, d);
    });
    return row;
  });
  const momentTotal = { before: emptyCats(), onDay: emptyCats(), after: emptyCats() };
  moment.forEach(m => (['before', 'onDay', 'after'] as const).forEach(k => {
    (Object.keys(m[k]) as (keyof CatCounts)[]).forEach(c => { momentTotal[k][c] += m[k][c]; });
  }));

  // Criativos que perdem: não compareceu + cancelada + perdido sem call; só com 3+ agendamentos.
  type Acc = Omit<LosingCreative, 'lost' | 'rate' | 'tone'>;
  const byCreative: Record<string, Acc> = Object.create(null);
  const accs: Acc[] = [];
  deals.forEach(d => {
    const k = d.creative || '(sem utm_content)';
    let c = byCreative[k];
    if (!c) { c = byCreative[k] = { creative: k, n: 0, noShow: 0, noInterest: 0, cancelled: 0, calls: 0, won: 0, open: 0 }; accs.push(c); }
    c.n++;
    if (d.status === 'nao_realizada') c.noShow++;
    else if (d.status === 'cancelada') c.cancelled++;
    else if (d.status === 'perdido' && !d.realized) c.noInterest++;
    if (dealDone(d)) c.calls++;
    if (d.status === 'ganho') c.won++;
    if (d.status === 'agendada' || d.status === 'reagendada') c.open++;
  });
  const losingCreatives: LosingCreative[] = accs
    .filter(c => c.n >= 3)
    .map(c => {
      const lost = c.noShow + c.noInterest + c.cancelled;
      const rate = lost / c.n;
      const tone: LosingCreative['tone'] = rate >= 0.6 ? 'red' : rate >= 0.4 ? 'yellow' : 'green';
      return { ...c, lost, rate, tone };
    })
    .sort((a, b) => b.rate - a.rate || b.lost - a.lost);

  // Custo por call: gasto oficial da edição inteira ÷ negócios da edição inteira (o período não entra:
  // o gasto não é fatiado por período); edição sem gasto fica "n/d" e fora do total.
  const rows: CostRow[] = eds.map(e => {
    const ds = all.filter(d => d.edition === e.number);
    const power = ds.filter(d => normProd(d.product) === 'power').length;
    const start = ds.filter(d => normProd(d.product) === 'powerStart').length;
    const s = spend[e.number] ?? null;
    return { edition: e.number, spend: s, n: ds.length, power, start, cost: per(s, ds.length), costPower: per(s, power), costStart: per(s, start) };
  });
  const counted = rows.filter(r => r.spend !== null && r.spend > 0 && r.n > 0);
  const tSpend = counted.reduce((t, r) => t + (r.spend as number), 0);
  const tN = counted.reduce((t, r) => t + r.n, 0), tP = counted.reduce((t, r) => t + r.power, 0), tS = counted.reduce((t, r) => t + r.start, 0);

  return {
    total: deals.length, noEdition: inPeriod.filter(d => d.edition === null).length,
    power: deals.filter(d => normProd(d.product) === 'power').length,
    start: deals.filter(d => normProd(d.product) === 'powerStart').length,
    auto: deals.filter(d => d.via === 'Automático').length, commercial: deals.filter(d => d.via === 'Comercial').length,
    realized, attendance: realized + noShow ? realized / (realized + noShow) : null, noShow,
    waiting: count('agendada') + count('sem_registro') + count('reagendada'), cancelled: count('cancelada'),
    lost: count('perdido'), lostByReason: countBy(deals.filter(d => d.status === 'perdido' && d.lostReason), d => d.lostReason),
    won, wonRevenue: deals.filter(d => d.status === 'ganho').reduce((t, d) => t + d.value, 0),
    wonRate: realized ? won / realized : null, refunded: count('reembolsado'),
    origin: {
      planilha: deals.filter(d => d.editionBy === 'planilha').length,
      email: deals.filter(d => d.editionBy === 'email').length,
      data: deals.filter(d => d.editionBy === 'data').length,
    },
    alertCount: deals.filter(d => d.alerts.length).length,
    moment, momentTotal, losingCreatives,
    lostBeforeCall: deals.filter(d => d.status === 'nao_realizada' || d.status === 'cancelada' || (d.status === 'perdido' && !d.realized)).length,
    costPerCall: {
      rows,
      total: { edition: null, spend: counted.length ? tSpend : null, n: tN, power: tP, start: tS, cost: per(tSpend, tN), costPower: per(tSpend, tP), costStart: per(tSpend, tS) },
    },
    byEdition: countBy(deals, d => ed(d.edition as number)),
    via: countBy(deals, d => d.via || 'Sem registro'),
    closer: countBy(deals, d => d.closer || 'Sem closer'),
    status: countBy(deals, d => d.status),
    list: lists ? deals.slice().sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? '')).map(d => ({
      name: d.name, type: d.type, scheduledAt: d.scheduledAt, callDate: d.callDate, via: d.via, status: d.status, closer: d.closer,
      product: d.product, income: d.income, edition: d.edition, creative: d.creative, lostReason: d.lostReason, alerts: d.alerts,
    })) : null,
  };
}
