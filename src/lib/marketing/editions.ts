import type { EditionConfig, OverviewRow } from './types.ts';
import { addDays, inferLiveDate } from './parse.ts';

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
