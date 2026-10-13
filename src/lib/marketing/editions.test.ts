import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, OverviewRow } from './types.ts';
import { buildEditions, editionKind, lastLiveOnOrBefore, cycleStartAt, indexCaptures, latestCycleCapture } from './editions.ts';

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

const cap = (email: string, at: string, edition: number): CaptureRow => ({
  email, at, edition, phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: `c${edition}`, funnel: '',
});

test('editionKind splits paid and NF10K history', () => {
  assert.equal(editionKind(22), 'pago');
  assert.equal(editionKind(21), 'pago');
  assert.equal(editionKind(20), 'nf10k');
  assert.equal(editionKind(15), 'nf10k');
  assert.equal(editionKind(14), 'antiga');
});

test('lastLiveOnOrBefore counts the live day itself', () => {
  const eds = [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }];
  assert.equal(lastLiveOnOrBefore(eds, '2026-10-13'), 22);
  assert.equal(lastLiveOnOrBefore(eds, '2026-10-12'), 21);
  assert.equal(lastLiveOnOrBefore(eds, '2026-10-01'), null);
  assert.equal(lastLiveOnOrBefore(eds, null), null);
});

test('cycleStartAt and latestCycleCapture', () => {
  const rows = [cap('a@x', '2026-08-20T10:00:00', 14), cap('a@x', '2026-08-25T10:00:00', 15), cap('a@x', '2026-10-10T10:00:00', 22)];
  assert.equal(cycleStartAt(rows), '2026-08-24T10:00:00');
  const idx = indexCaptures(rows);
  assert.equal(latestCycleCapture(idx, ['a@x'], '2026-09-01T00:00:00')?.edition, 15);
  assert.equal(latestCycleCapture(idx, ['a@x'], null)?.edition, 22);
  assert.equal(latestCycleCapture(idx, ['a@x'], '2026-08-01T00:00:00')?.edition, 22); // nada antes: usa todas
  assert.equal(latestCycleCapture(idx, ['b@x'], null), null);
});
