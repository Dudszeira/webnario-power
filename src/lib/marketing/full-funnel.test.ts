import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, EditionConfig, MetaAdDay, MetaWindow } from './types.ts';
import { campaignFilterOf, fullFunnel, funnelMetrics, matchesCampaign, metaWindowRanges } from './full-funnel.ts';

const cfg = (number: number, liveDate: string, windowStart: string): EditionConfig =>
  ({ number, liveDate, windowStart, windowEnd: liveDate, ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45 });
const tk = (edition: number, day: string, utmCampaign = '[AK7] [VENDAS] [WB PG]'): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: 'ig', utmMedium: '', utmCampaign, utmTerm: '', utmContent: '',
  at: `${day}T10:00:00`, edition, funnel: 'WB03 - PAGO',
});
const ad = (date: string, spend: number, impressions = 1000, linkClicks = 10, landingViews = 5, initiateCheckouts = 0): MetaAdDay => ({
  date, adId: date, adName: 'img_1', adsetName: '', campaignName: '[WB PG]', spend, impressions, linkClicks, landingViews,
  initiateCheckouts, video3s: 0, thruplays: 0,
});
const e21 = cfg(21, '2026-10-06', '2026-09-30');
const e22 = cfg(22, '2026-10-13', '2026-10-07');
const caps = [
  tk(21, '2026-09-30'), tk(21, '2026-10-02'), tk(21, '2026-10-05'), tk(21, '2026-10-06'), tk(21, '2026-10-03', 'Outra campanha'),
  tk(22, '2026-10-08'), tk(22, '2026-10-09'),
];
const ads = [ad('2026-10-01', 50), ad('2026-10-06', 30), ad('2026-10-08', 40)];

test('campaign filter: default WB PG, saved empty = all, contains ignoring case', () => {
  assert.equal(campaignFilterOf(undefined), 'WB PG');
  assert.equal(campaignFilterOf(''), '');
  assert.equal(campaignFilterOf('  WB PG '), 'WB PG');
  assert.equal(matchesCampaign('[AK7] [VENDAS] [wb pg]', 'WB PG'), true);
  assert.equal(matchesCampaign('Outra', 'WB PG'), false);
  assert.equal(matchesCampaign('Outra', ''), true);
});

test('funnelMetrics derives rates and never divides by zero', () => {
  const m = funnelMetrics([ad('2026-10-08', 100, 10000, 200, 100, 10)], 5, { reach: 8000, frequency: 1.25 });
  assert.deepEqual(m, {
    spend: 100, impressions: 10000, reach: 8000, frequency: 1.25, cpm: 10, ctr: 0.02, linkClicks: 200, cpc: 0.5,
    landingViews: 100, loadRate: 0.5, costPerView: 1, ic: 10, costPerIc: 10, sales: 5, pageToSale: 0.05,
  });
  const none = funnelMetrics([], 3, null);
  assert.deepEqual([none.cpm, none.spend, none.sales], [null, null, 3]);
});

test('fullFunnel: total includes live day; comparison uses the capture days of the current edition', () => {
  const f = fullFunnel([e21, e22], ads, caps, [], 'WB PG', '2026-10-10');
  assert.deepEqual(f.columns.map(c => [c.edition, c.metrics.sales, c.metrics.spend]), [[21, 4, 80], [22, 2, 40]]);
  assert.equal(f.compare?.cutDays, 3); // 07, 08 e 09/10 (até ontem)
  assert.deepEqual(f.compare?.prevRange, { from: '2026-09-30', to: '2026-10-02' });
  assert.equal(f.compare?.deltas.sales, 0); // 2 × 2 nos 3 primeiros dias
  assert.equal(f.compare?.deltas.reach, null);
  assert.equal(f.compare?.reachComparable, false);
});

test('fullFunnel after the live: window ends the day before the live (rule verified on real data: #021 = 65, #022 = 41)', () => {
  const f = fullFunnel([e21, e22], ads, caps, [], 'WB PG', '2026-10-14');
  assert.equal(f.compare?.cutDays, 6);
  assert.deepEqual(f.compare?.prevRange, { from: '2026-09-30', to: '2026-10-05' });
  assert.deepEqual(f.compare?.curRange, { from: '2026-10-07', to: '2026-10-12' });
  assert.deepEqual([f.compare?.prevSales, f.compare?.curSales], [3, 2]);
  assert.equal(f.compare?.deltas.sales, (2 - 3) / 3);
  assert.equal(fullFunnel([e22], ads, caps, [], 'WB PG', '2026-10-14').compare, null);
});

test('fullFunnel compares reach only for closed editions with equal windows', () => {
  const w: MetaWindow[] = [
    { edition: 21, since: '2026-09-30', until: '2026-10-06', reach: 1000, frequency: 1.5 },
    { edition: 22, since: '2026-10-07', until: '2026-10-13', reach: 1200, frequency: 1.4 },
  ];
  const f = fullFunnel([e21, e22], ads, caps, w, 'WB PG', '2026-10-14');
  assert.equal(f.compare?.reachComparable, true);
  assert.equal(f.compare?.deltas.reach, 0.2);
  assert.equal(f.columns[1].metrics.reach, 1200);
});

test('metaWindowRanges: only paid editions already started, capped at today', () => {
  const r = metaWindowRanges([cfg(20, '2026-09-29', '2026-09-23'), e21, e22, cfg(23, '2026-10-20', '2026-10-14')], '2026-10-10');
  assert.deepEqual(r, [{ edition: 21, since: '2026-09-30', until: '2026-10-06' }, { edition: 22, since: '2026-10-07', until: '2026-10-10' }]);
});
