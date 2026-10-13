// Agregados que cruzam aplicações, negócios, vendas e presença (Edição e Criativos).
import type { CaptureRow, OverviewCheck, SaleRow, SurveyRow } from './types.ts';
import type { Application } from './applications.ts';
import type { LiveStats } from './live.ts';
import { dealDone, type Deal } from './deals.ts';
import { normProd, saleValue, type Product } from './sales.ts';
import { addDays } from './parse.ts';
import { creativeFamily } from './creatives.ts';
import { qualified5k } from './survey.ts';

export type Stage4 = { qualified: number; scheduled: number; done: number; sales: number };
export type EditionFunnel = {
  applications: number; qualified: number;
  scheduled: number; done: number;      // todos os negócios (qualquer produto)
  power: Stage4; start: Stage4; desafioSales: number;
};

// Funil oficial: aplicações do Typeform → qualificada (Power/Start) → agendada → realizada → venda, por produto.
export function editionFunnel(apps: Application[], deals: Deal[], sales: SaleRow[]): EditionFunnel {
  const complete = apps.filter(a => a.complete);
  const ok = sales.filter(s => s.approved);
  const stage = (qualif: 'Power' | 'Start', prod: Product): Stage4 => {
    const ds = deals.filter(d => normProd(d.product) === prod);
    return {
      qualified: complete.filter(a => a.qualif === qualif).length,
      scheduled: ds.length, done: ds.filter(dealDone).length,
      sales: ok.filter(s => normProd(s.product) === prod).length,
    };
  };
  return {
    applications: complete.length, qualified: complete.filter(a => a.qualified).length,
    scheduled: deals.length, done: deals.filter(dealDone).length,
    power: stage('Power', 'power'), start: stage('Start', 'powerStart'),
    desafioSales: ok.filter(s => normProd(s.product) === 'desafio').length,
  };
}

export type WebinarRow = {
  edition: number | null; // null = linha de total
  leads: number; scheduled: number; before: number; onDay: number; after: number; viaApi: number; calls: number;
  sales: number; revenue: number;
  peak: number | null;        // plataforma (oficial)
  sheetPeak: number | null;   // Visão Geral, só referência
  attendance: number | null;  // % 0–100: Visão Geral; sem ela, pico ÷ leads
  attendanceFromSheet: boolean;
  toPitch: number | null; applications: number; liveApps: number; liveConversion: number | null;
};
export type WebinarTable = { rows: WebinarRow[]; total: WebinarRow | null };

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const round2 = (n: number) => Math.round(n * 100) / 100;
// Agendamento via API, como o dash antigo: utm_content do negócio começa com "api" ou é "197", ou utm_source = api.
export const dealViaApi = (d: Deal) => /^api/i.test(d.utmContent) || d.utmContent === '197' || /^api$/i.test(d.utmSource);

export function webinarTable(
  eds: { number: number; liveDate: string }[], leads: CaptureRow[], deals: Deal[], sales: SaleRow[],
  apps: Application[], live: Record<number, LiveStats | null>, sheet: Record<number, OverviewCheck | null>,
): WebinarTable {
  const rows: WebinarRow[] = eds.map(e => {
    const n = e.number;
    const ds = deals.filter(d => d.edition === n);
    const ss = sales.filter(s => s.approved && s.edition === n);
    const complete = apps.filter(a => a.complete && a.edition === n);
    // Conversão ao vivo: aplicações completas das 20h da live às 6h do dia seguinte ÷ pessoas no pitch.
    const from = `${e.liveDate}T20:00:00`, to = `${addDays(e.liveDate, 1)}T06:00:00`;
    const liveApps = complete.filter(a => a.at !== null && a.at >= from && a.at <= to).length;
    const st = live[n] ?? null;
    const ov = sheet[n] ?? null;
    const nLeads = leads.filter(l => l.edition === n).length;
    const toPitch = st ? st.toPitch : null;
    const sheetAttendance = ov ? ov.attendance : null;
    let before = 0, onDay = 0, after = 0;
    ds.forEach(d => {
      if (!d.scheduledAt) return;
      const off = days(e.liveDate, d.scheduledAt);
      if (off < 0) before++; else if (off === 0) onDay++; else after++;
    });
    return {
      edition: n, leads: nLeads, scheduled: ds.length, before, onDay, after, viaApi: ds.filter(dealViaApi).length,
      calls: ds.filter(dealDone).length, sales: ss.length, revenue: round2(ss.reduce((t, s) => t + saleValue(s), 0)),
      peak: st ? st.peak : null, sheetPeak: ov ? ov.peak : null,
      attendance: sheetAttendance !== null ? sheetAttendance : st && nLeads ? Math.round((st.peak / nLeads) * 1000) / 10 : null,
      attendanceFromSheet: sheetAttendance !== null,
      toPitch, applications: complete.length, liveApps, liveConversion: toPitch ? liveApps / toPitch : null,
    };
  });
  if (rows.length < 2) return { rows, total: null };
  const sum = (k: 'leads' | 'scheduled' | 'before' | 'onDay' | 'after' | 'viaApi' | 'calls' | 'sales' | 'revenue' | 'applications' | 'liveApps') =>
    rows.reduce((t, r) => t + r[k], 0);
  const withPitch = rows.filter(r => r.toPitch !== null);
  const toPitch = withPitch.length ? withPitch.reduce((t, r) => t + (r.toPitch as number), 0) : null;
  const liveApps = sum('liveApps');
  return {
    rows,
    total: {
      edition: null, leads: sum('leads'), scheduled: sum('scheduled'), before: sum('before'), onDay: sum('onDay'), after: sum('after'),
      viaApi: sum('viaApi'), calls: sum('calls'), sales: sum('sales'), revenue: round2(sum('revenue')),
      peak: null, sheetPeak: null, attendance: null, attendanceFromSheet: false, // pico e comparecimento não somam entre lives
      toPitch, applications: sum('applications'), liveApps, liveConversion: toPitch ? liveApps / toPitch : null,
    },
  };
}

export type CreativeExtra = {
  family: string; leads: number; qualified: number | null; qualifiedRate: number | null; scheduled: number;
  sales: number; power: number; start: number; desafio: number; // vendas high ticket (sales = todas, sem reembolso)
};

// Por família de criativo: leads da captação, % 5k+ na pesquisa, agendamentos e vendas high ticket por produto.
export function creativeExtras(
  leads: CaptureRow[], surveys: Record<string, SurveyRow>, deals: Deal[], sales: SaleRow[], aliases: Record<string, string>, hasSurvey = true,
): CreativeExtra[] {
  const m: Record<string, CreativeExtra> = Object.create(null);
  const list: CreativeExtra[] = [];
  const get = (raw: string) => {
    const f = creativeFamily(raw, aliases);
    let x = m[f];
    if (!x) { x = m[f] = { family: f, leads: 0, qualified: 0, qualifiedRate: null, scheduled: 0, sales: 0, power: 0, start: 0, desafio: 0 }; list.push(x); }
    return x;
  };
  leads.forEach(l => {
    const x = get(l.utmContent);
    x.leads++;
    const s = l.email ? surveys[l.email] : undefined;
    if (s && qualified5k(s.renda)) (x.qualified as number)++;
  });
  deals.forEach(d => { get(d.creative).scheduled++; });
  sales.filter(s => s.approved).forEach(s => {
    const x = get(s.utmContentCapture);
    x.sales++;
    const p = normProd(s.product);
    if (p === 'power') x.power++; else if (p === 'powerStart') x.start++; else if (p === 'desafio') x.desafio++;
  });
  // Sem a fonte da pesquisa, qualificação é desconhecida (null), não 0.
  list.forEach(x => {
    if (!hasSurvey) { x.qualified = null; x.qualifiedRate = null; } else x.qualifiedRate = x.leads ? (x.qualified as number) / x.leads : null;
  });
  return list;
}

// Ordenação do dash antigo: vendas → agendamentos → leads; agendamentos → leads; qualificação → leads; leads → vendas.
export type CreativeSort = 'vendas' | 'agend' | 'qualif' | 'leads';
export function sortCreatives<T extends { x: CreativeExtra | null }>(rows: T[], s: CreativeSort): T[] {
  const v = (r: T, k: 'sales' | 'scheduled' | 'qualified' | 'leads') => (r.x ? r.x[k] ?? 0 : 0);
  return rows.slice().sort((a, b) =>
    s === 'qualif' ? v(b, 'qualified') - v(a, 'qualified') || v(b, 'leads') - v(a, 'leads')
      : s === 'agend' ? v(b, 'scheduled') - v(a, 'scheduled') || v(b, 'leads') - v(a, 'leads')
      : s === 'leads' ? v(b, 'leads') - v(a, 'leads') || v(b, 'sales') - v(a, 'sales')
      : v(b, 'sales') - v(a, 'sales') || v(b, 'scheduled') - v(a, 'scheduled') || v(b, 'leads') - v(a, 'leads'));
}
