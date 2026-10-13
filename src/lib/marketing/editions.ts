import type { CaptureRow, EditionConfig, OverviewRow } from './types.ts';
import { addDays, inferLiveDate, shiftHours } from './parse.ts';

export type EditionOverride = Partial<Omit<EditionConfig, 'number'>> & { number: number };

const DEFAULTS = { ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45 };

export function buildEditions(overview: OverviewRow[], overrides: EditionOverride[], today: string): EditionConfig[] {
  const byNumber = new Map(overrides.map(o => [o.number, o]));
  const base = overview
    .map(o => ({ number: o.edition, liveDate: inferLiveDate(o.dayMonth, today) }))
    .filter((e): e is { number: number; liveDate: string } => e.liveDate !== null)
    .sort((a, b) => a.number - b.number);

  return base.map((e, i) => {
    const prev = base[i - 1];
    const o = byNumber.get(e.number) ?? { number: e.number };
    const strip = Object.fromEntries(Object.entries(o).filter(([, val]) => val !== null && val !== undefined));
    return {
      ...DEFAULTS,
      number: e.number,
      liveDate: e.liveDate,
      windowStart: prev ? addDays(prev.liveDate, 1) : addDays(e.liveDate, -7),
      windowEnd: e.liveDate,
      ...strip,
    } as EditionConfig;
  });
}

export const PAGO_MIN = 21;   // #021 em diante: webinário pago (ingresso)
export const CYCLE_MIN = 15;  // #015–#020: histórico NF10K (gratuito)
export type EditionKind = 'pago' | 'nf10k' | 'antiga';
export const editionKind = (n: number): EditionKind => (n >= PAGO_MIN ? 'pago' : n >= CYCLE_MIN ? 'nf10k' : 'antiga');

// Última live até o dia (inclusive): quem não tem e-mail na captação vai para ela.
export function lastLiveOnOrBefore(eds: { number: number; liveDate: string }[], day: string | null): number | null {
  if (!day) return null;
  let best: { number: number; liveDate: string } | null = null;
  for (let i = 0; i < eds.length; i++) {
    const e = eds[i];
    if (e.liveDate <= day && (best === null || e.liveDate > best.liveDate)) best = e;
  }
  return best === null ? null : best.number;
}

// Início do ciclo = primeira captação das edições do ciclo − 1 dia (respostas anteriores são de ciclos antigos).
export function cycleStartAt(captures: CaptureRow[]): string | null {
  let min: string | null = null;
  for (let i = 0; i < captures.length; i++) {
    const c = captures[i];
    if (c.at && c.edition !== null && c.edition >= CYCLE_MIN && (min === null || c.at < min)) min = c.at;
  }
  return shiftHours(min, -24);
}

export type CaptureIndex = Record<string, CaptureRow[]>;

export function indexCaptures(captures: CaptureRow[]): CaptureIndex {
  const idx: CaptureIndex = Object.create(null);
  captures.forEach(c => { if (c.email) (idx[c.email] || (idx[c.email] = [])).push(c); });
  return idx;
}

// Captação mais recente do ciclo até `until`; se nenhuma é anterior, considera todas (igual ao dash antigo).
export function latestCycleCapture(idx: CaptureIndex, emails: string[], until: string | null): CaptureRow | null {
  let leads: CaptureRow[] = [];
  emails.forEach(e => { (idx[e] || []).forEach(l => leads.push(l)); });
  if (until) {
    const before = leads.filter(l => !l.at || l.at <= until);
    if (before.length) leads = before;
  }
  leads.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  for (let i = 0; i < leads.length; i++) {
    const ed = leads[i].edition;
    if (ed !== null && ed >= CYCLE_MIN) return leads[i];
  }
  return null;
}
