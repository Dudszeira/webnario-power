import test from 'node:test';
import assert from 'node:assert/strict';
import type { OverviewRow } from './types.ts';
import { buildEditions } from './editions.ts';

const noCheck = { applications: null, scheduled: null, done: null, peak: null, attendance: null, metaSpend: null, investment: null, sales: null, revenue: null };
const ov = (edition: number, dayMonth: string): OverviewRow =>
  ({ edition, dayMonth, applications: 0, scheduled: 0, done: 0, investment: 0, check: noCheck });

test('default windows chain from the previous live', () => {
  const eds = buildEditions([ov(22, '13/10'), ov(21, '06/10')], [], '2026-10-10');
  assert.deepEqual(eds.map(e => [e.number, e.liveDate, e.windowStart, e.windowEnd]), [
    [21, '2026-10-06', '2026-09-29', '2026-10-06'],
    [22, '2026-10-13', '2026-10-07', '2026-10-13'],
  ]);
  assert.equal(eds[1].cpaGood, 35);
  assert.equal(eds[1].ticketPrice, 9.9);
});

test('overrides win over defaults', () => {
  const [e] = buildEditions([ov(22, '13/10')], [{ number: 22, windowStart: '2026-09-29', cpaGood: 30 }], '2026-10-10');
  assert.equal(e.windowStart, '2026-09-29');
  assert.equal(e.cpaGood, 30);
  assert.equal(e.cpaLimit, 45);
});

test('rows with unreadable date are skipped', () => {
  assert.equal(buildEditions([ov(5, '')], [], '2026-10-10').length, 0);
});
