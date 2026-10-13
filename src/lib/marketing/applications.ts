import type { ApplicationRow, DateRange } from './types.ts';
import { lastLiveOnOrBefore, latestCycleCapture, type CaptureIndex } from './editions.ts';
import { inRange } from './metrics.ts';
import { phoneKey } from './parse.ts';

export function applicationOrigin(src: string, cmp: string, content: string): string {
  const s = src.toLowerCase(), c = cmp.toLowerCase(), k = content.toLowerCase();
  if (!s && !k) return '(sem utm)';
  if (s === 'plataforma' && k === 'botao') return 'Botão da plataforma (ao vivo)';
  if (s === 'plataforma' && k === 'comentarios') return 'Comentários (ao vivo)';
  if (s === 'plataforma') return `Plataforma · ${content || cmp}`;
  if (/^whats/.test(s) && c === 'grupo') return `Grupo WhatsApp · msg ${content}`;
  if (/^whats/.test(s) && c === 'replay') return `Replay WhatsApp · msg ${content}`;
  if (s === 'api') return `API ${cmp} · msg ${content}`;
  return [src, cmp, content].filter(Boolean).join(' · ');
}

export function applicationOriginGroup(src: string, cmp: string): string {
  const s = src.toLowerCase(), c = cmp.toLowerCase();
  if (!s) return '(sem utm)';
  if (s === 'plataforma') return 'Plataforma (ao vivo)';
  if (/^whats/.test(s) && c === 'replay') return 'Replay WhatsApp';
  if (/^whats/.test(s)) return 'Grupo WhatsApp';
  if (s === 'api') return 'API';
  return src;
}

export type Application = {
  name: string; email: string; at: string | null; product: string;
  qualif: 'Power' | 'Start' | 'Desafio' | ''; qualified: boolean; complete: boolean;
  income: string; revenue: string; relation: string; interest: 'Sim' | 'Não' | ''; scheduled: boolean;
  origin: string; originGroup: string;
  edition: number | null; editionByEmail: boolean; // false = atribuída pela data (mostrada com *)
  creative: string; repeats: number;
  key: string; // pessoa: telefone (últimos 8 dígitos, ignora +55/DDD) > e-mail > nome
};

export function buildApplications(rows: ApplicationRow[], idx: CaptureIndex, eds: { number: number; liveDate: string }[]): Application[] {
  const all: Application[] = rows.map((r): Application => {
    const lead = r.email ? latestCycleCapture(idx, [r.email], r.at) : null;
    const p = r.product;
    const qualif = /power/i.test(p) ? 'Power' : /start/i.test(p) ? 'Start' : /desafio/i.test(p) ? 'Desafio' : '';
    return {
      name: r.name, email: r.email, at: r.at, product: p, qualif, qualified: qualif === 'Power' || qualif === 'Start',
      complete: !!(p || r.income || r.revenue),
      income: r.income, revenue: r.revenue, relation: r.relation, interest: r.interest, scheduled: r.scheduled,
      origin: applicationOrigin(r.utmSource, r.utmCampaign, r.utmContent),
      originGroup: applicationOriginGroup(r.utmSource, r.utmCampaign),
      edition: lead ? lead.edition : lastLiveOnOrBefore(eds, r.at ? r.at.slice(0, 10) : null),
      editionByEmail: !!lead,
      creative: lead ? lead.utmContent : '',
      repeats: 0,
      key: phoneKey(r.phone) || r.email || r.name.toLowerCase(),
    };
  });
  // Das completas fica a mais recente de cada pessoa; incompletas caem se a pessoa completou.
  const kept: Record<string, Application> = Object.create(null);
  const out: Application[] = [];
  all.filter(a => a.complete)
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))
    .forEach(a => { if (kept[a.key]) kept[a.key].repeats++; else { kept[a.key] = a; out.push(a); } });
  const seenInc: Record<string, true> = Object.create(null);
  all.forEach(a => {
    if (a.complete || kept[a.key] || seenInc[a.key]) return;
    seenInc[a.key] = true;
    out.push(a);
  });
  return out;
}

export type AppAgg = { key: string; count: number; qualified: number };

function agg(apps: Application[], key: (a: Application) => string): AppAgg[] {
  const m: Record<string, AppAgg> = Object.create(null);
  const list: AppAgg[] = [];
  apps.forEach(a => {
    const k = key(a);
    if (!m[k]) { m[k] = { key: k, count: 0, qualified: 0 }; list.push(m[k]); }
    m[k].count++;
    if (a.qualified) m[k].qualified++;
  });
  return list.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const INCOME_ORDER = ['Menos de R$1 mil', 'R$1 mil a R$3 mil', 'R$3 mil a R$5 mil', 'R$5 mil a R$7 mil', 'R$7 mil a R$10 mil', 'R$10 mil a R$15 mil', 'R$15 mil a R$20 mil', 'R$20 mil a R$30 mil', 'R$30 mil a R$50 mil', 'Mais de R$50 mil'];
const byIncome = (xs: AppAgg[]) => xs.sort((a, b) => {
  const ia = INCOME_ORDER.indexOf(a.key), ib = INCOME_ORDER.indexOf(b.key);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

export type ApplicationListItem = {
  at: string | null; name: string; origin: string; relation: string; revenue: string; income: string;
  qualif: string; scheduled: boolean; edition: number | null; editionByEmail: boolean; creative: string; repeats: number;
};

export type ApplicationsTab = {
  complete: number; repeats: number; incomplete: number; noEdition: number;
  qualified: number; power: number; start: number; desafio: number; scheduled: number; interestYes: number;
  originGroups: AppAgg[]; origins: AppAgg[];
  byEdition: { edition: number; complete: number; qualified: number; power: number; start: number; desafio: number; scheduled: number; incomplete: number; topOrigin: string | null }[];
  profile: { income: AppAgg[]; revenue: AppAgg[]; relation: AppAgg[] };
  list: { complete: ApplicationListItem[]; incomplete: string[] } | null;
};

export function applicationsTab(apps: Application[], selected: number[], range: DateRange | null, lists: boolean): ApplicationsTab {
  const inPeriod = apps.filter(a => inRange(a.at ? a.at.slice(0, 10) : null, range));
  const mine = inPeriod.filter(a => a.edition !== null && selected.indexOf(a.edition) >= 0);
  const done = mine.filter(a => a.complete);
  const inc = mine.filter(a => !a.complete);
  const n = (q: string) => done.filter(a => a.qualif === q).length;
  const byEdition = selected.map(ed => {
    const d = done.filter(a => a.edition === ed);
    const top = agg(d, a => a.originGroup)[0];
    return {
      edition: ed, complete: d.length, qualified: d.filter(a => a.qualified).length,
      power: d.filter(a => a.qualif === 'Power').length, start: d.filter(a => a.qualif === 'Start').length,
      desafio: d.filter(a => a.qualif === 'Desafio').length, scheduled: d.filter(a => a.scheduled).length,
      incomplete: inc.filter(a => a.edition === ed).length, topOrigin: top ? top.key : null,
    };
  }).filter(r => r.complete || r.incomplete);
  return {
    complete: done.length, repeats: done.reduce((s, a) => s + a.repeats, 0), incomplete: inc.length,
    noEdition: inPeriod.filter(a => a.edition === null).length,
    qualified: done.filter(a => a.qualified).length, power: n('Power'), start: n('Start'), desafio: n('Desafio'),
    scheduled: done.filter(a => a.scheduled).length, interestYes: done.filter(a => a.interest === 'Sim').length,
    originGroups: agg(done, a => a.originGroup), origins: agg(done, a => a.origin),
    byEdition,
    profile: {
      income: byIncome(agg(done, a => a.income || '(não informou)')),
      revenue: byIncome(agg(done, a => a.revenue || '(não informou)')),
      relation: agg(done, a => a.relation || '(não informou)'),
    },
    list: lists ? {
      complete: done.slice().sort((x, y) => (y.at ?? '').localeCompare(x.at ?? '')).map(a => ({
        at: a.at, name: a.name, origin: a.origin, relation: a.relation, revenue: a.revenue, income: a.income, qualif: a.qualif,
        scheduled: a.scheduled, edition: a.edition, editionByEmail: a.editionByEmail, creative: a.creative, repeats: a.repeats,
      })),
      incomplete: inc.map(a => a.name || a.email),
    } : null,
  };
}
