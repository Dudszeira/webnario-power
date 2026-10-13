import test from 'node:test';
import assert from 'node:assert/strict';
import type { OverviewCheck } from './types.ts';
import { reconcileEdition } from './reconcile.ts';

test('reconcileEdition: ok, diverge, só planilha, só plataforma; both missing dropped', () => {
  const sheet: OverviewCheck = { applications: 12, scheduled: 5, done: null, peak: 40, attendance: 12.5, metaSpend: null, investment: 1000, sales: 3, revenue: null };
  const rows = reconcileEdition(22, { peak: 40, attendance: 12.49, metaSpend: 950.4, applications: 10, scheduled: null, done: null, sales: 3, revenue: 6000 }, sheet);
  const by = Object.fromEntries(rows.map(r => [r.key, r]));
  assert.equal(by.peak.state, 'ok');
  assert.equal(by.attendance.state, 'ok'); // 12,49 → 12,5 com 1 casa
  assert.deepEqual([by.metaSpend.state, by.metaSpend.sheet, by.metaSpend.diff], ['diverge', 1000, -49.6]);
  assert.deepEqual([by.applications.state, by.applications.diff, by.applications.diffPct], ['diverge', -2, -2 / 12]);
  assert.equal(by.scheduled.state, 'so_planilha');
  assert.equal(by.revenue.state, 'so_plataforma');
  assert.equal(by.done, undefined);
  const none = { peak: 1, attendance: null, metaSpend: null, applications: null, scheduled: null, done: null, sales: null, revenue: null };
  assert.deepEqual(reconcileEdition(22, none, null).map(r => r.state), ['so_plataforma']);
});
