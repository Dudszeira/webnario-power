import test from 'node:test';
import assert from 'node:assert/strict';
import { liveStats, liveTotals, presenceFromEvents } from './live.ts';

const t0 = Date.UTC(2026, 9, 13, 23, 0, 0); // 20h de Brasília
const at = (min: number) => new Date(t0 + min * 60000).toISOString();
const ev = (id: string, type: string, min: number) => ({ registration_id: id, type, created_at: at(min) });
const sample = () => presenceFromEvents([
  ev('a', 'enter_live', -5), ev('a', 'heartbeat', 30), ev('a', 'heartbeat', 70),
  ev('b', 'enter_live', 10), ev('b', 'heartbeat', 20), ev('b', 'cta_click', 15),
]);

test('presenceFromEvents: first/last presence, heartbeats as minutes, CTA flag', () => {
  const p = presenceFromEvents([
    ev('a', 'enter_live', -5), ev('a', 'heartbeat', 30), ev('a', 'heartbeat', 70),
    ev('b', 'enter_live', 10), ev('b', 'heartbeat', 20), ev('b', 'cta_click', 15),
    { registration_id: null, type: 'heartbeat', created_at: at(1) }, ev('c', 'cta_click', 3),
  ]);
  assert.deepEqual(p, [
    { first: t0 - 5 * 60000, last: t0 + 70 * 60000, minutes: 2, cta: false },
    { first: t0 + 10 * 60000, last: t0 + 20 * 60000, minutes: 1, cta: true },
  ]);
});

test('liveStats: curve from 20h, peak, tail cut, pitch, histogram', () => {
  const s = liveStats(sample(), t0, 66 * 60 + 10);
  assert.equal(s.curve[0], 1);
  assert.equal(s.curve[10], 2);
  assert.deepEqual([s.peak, s.peakMinute], [2, 10]);
  assert.equal(s.curve.length, 23); // corta a cauda abaixo de max(2, 5% do pico) e deixa 2 minutos
  assert.deepEqual([s.people, s.watched, s.mean, s.median, s.toPitch, s.cta], [2, 2, 1.5, 2, 1, 1]);
  assert.deepEqual(s.histogram[0], { label: 'até 5 min', count: 2 });
  assert.equal(Math.round(s.pitchMinute * 100) / 100, 66.17);
  assert.equal(liveStats([], t0, 0).mean, null);
});

test('liveTotals: sums, weighted mean, average peak with max', () => {
  const a = liveStats(presenceFromEvents([ev('a', 'enter_live', 0), ev('a', 'heartbeat', 1), ev('a', 'heartbeat', 2)]), t0, 3960);
  const b = liveStats(presenceFromEvents([ev('b', 'enter_live', 0), ev('b', 'heartbeat', 1), ev('c', 'enter_live', 0), ev('c', 'heartbeat', 1)]), t0, 3960);
  const t = liveTotals([a, b]);
  assert.deepEqual([t?.editions, t?.people, t?.peak, t?.peakMax, t?.peakMinute], [2, 3, 2, 2, null]);
  assert.equal(t?.mean, (2 * 1 + 1 * 2) / 3);
  assert.equal(liveTotals([]), null);
});
