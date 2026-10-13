export type LiveEvent = { registration_id: string | null; type: string; created_at: string };
export type Presence = { first: number; last: number; minutes: number; cta: boolean };

// Uma pessoa por cadastro: primeira e última presença (entrada ou heartbeat); heartbeats = minutos.
export function presenceFromEvents(events: LiveEvent[]): Presence[] {
  const by: Record<string, Presence> = Object.create(null);
  const ids: string[] = [];
  const cta: Record<string, true> = Object.create(null);
  events.forEach(e => {
    const id = e.registration_id;
    if (!id) return;
    if (e.type === 'cta_click') { cta[id] = true; return; }
    if (e.type !== 'enter_live' && e.type !== 'heartbeat') return;
    const t = Date.parse(e.created_at);
    let p = by[id];
    if (!p) { p = by[id] = { first: t, last: t, minutes: 0, cta: false }; ids.push(id); }
    if (t < p.first) p.first = t;
    if (t > p.last) p.last = t;
    if (e.type === 'heartbeat') p.minutes++;
  });
  return ids.map(id => ({ ...by[id], cta: !!cta[id] }));
}

export const LIVE_HISTOGRAM: [string, number, number][] = [
  ['até 5 min', 0, 5], ['5 a 15', 5, 15], ['15 a 30', 15, 30], ['30 a 45', 30, 45], ['45 a 60', 45, 60], ['60 a 75', 60, 75], ['75+', 75, Infinity],
];

export type LiveStats = {
  people: number; watched: number; peak: number; peakMinute: number; mean: number | null; median: number | null;
  toPitch: number; min30: number; min60: number; cta: number; curve: number[];
  histogram: { label: string; count: number }[]; pitchMinute: number;
};

export function liveStats(people: Presence[], liveStartMs: number, pitchSeconds: number): LiveStats {
  const t0 = liveStartMs;
  const end = people.reduce((m, p) => Math.max(m, p.last), t0);
  const dur = Math.min(240, Math.max(1, Math.ceil((end - t0) / 60000)));
  const curve: number[] = [];
  for (let i = 0; i <= dur; i++) curve.push(0);
  // Minuto a minuto desde as 20h: quem já entrou e ainda não saiu (quem entrou antes conta a partir das 20h).
  people.forEach(p => {
    const a = Math.max(0, Math.ceil((p.first - t0) / 60000));
    const b = Math.min(dur, Math.floor((p.last - t0) / 60000));
    for (let t = a; t <= b; t++) curve[t]++;
  });
  const peak = curve.reduce((m, x) => Math.max(m, x), 0);
  const peakMinute = curve.indexOf(peak);
  // Corta a cauda (replay depois do fim): último minuto com pelo menos max(2, 5% do pico), mais 2.
  let cut = curve.length - 1;
  while (cut > peakMinute && curve[cut] < Math.max(2, peak * 0.05)) cut--;
  curve.length = Math.min(curve.length, cut + 3);
  const watched = people.filter(p => p.minutes > 0).map(p => p.minutes).sort((a, b) => a - b);
  const pitchMs = t0 + pitchSeconds * 1000;
  return {
    people: people.length, watched: watched.length, peak, peakMinute,
    mean: watched.length ? watched.reduce((s, m) => s + m, 0) / watched.length : null,
    median: watched.length ? watched[Math.floor(watched.length / 2)] : null,
    toPitch: people.filter(p => p.first <= pitchMs && p.last >= pitchMs).length,
    min30: people.filter(p => p.minutes >= 30).length,
    min60: people.filter(p => p.minutes >= 60).length,
    cta: people.filter(p => p.cta).length,
    curve,
    histogram: LIVE_HISTOGRAM.map(([label, a, b]) => ({ label, count: people.filter(p => p.minutes >= a && p.minutes < b).length })),
    pitchMinute: pitchSeconds / 60,
  };
}

export type LiveTotals = {
  editions: number; people: number; mean: number | null; median: number | null;
  peak: number; peakMinute: number | null; peakMax: number;
  toPitch: number; min30: number; min60: number; cta: number; histogram: { label: string; count: number }[];
};

// Uma edição: os números dela. Várias: somas, média ponderada, pico médio e maior pico.
export function liveTotals(stats: LiveStats[]): LiveTotals | null {
  if (!stats.length) return null;
  const sum = (k: 'people' | 'watched' | 'peak' | 'toPitch' | 'min30' | 'min60' | 'cta') => stats.reduce((s, x) => s + x[k], 0);
  const watched = sum('watched');
  const medians = stats.filter(x => x.median !== null);
  const one = stats.length === 1;
  return {
    editions: stats.length, people: sum('people'),
    mean: watched ? stats.reduce((s, x) => s + (x.mean ?? 0) * x.watched, 0) / watched : null,
    median: medians.length ? medians.reduce((s, x) => s + (x.median as number), 0) / medians.length : null,
    peak: one ? stats[0].peak : Math.round(sum('peak') / stats.length),
    peakMinute: one ? stats[0].peakMinute : null,
    peakMax: stats.reduce((m, x) => Math.max(m, x.peak), 0),
    toPitch: sum('toPitch'), min30: sum('min30'), min60: sum('min60'), cta: sum('cta'),
    histogram: stats[0].histogram.map((h, i) => ({ label: h.label, count: stats.reduce((s, x) => s + x.histogram[i].count, 0) })),
  };
}

export type LiveTab = { editions: { edition: number; liveDate: string; stats: LiveStats | null }[]; totals: LiveTotals | null };
