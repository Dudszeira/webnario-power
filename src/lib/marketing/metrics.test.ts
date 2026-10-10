import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, EditionConfig, MetaAdDay } from './types.ts';
import { div, ticketSales, frontSummary, creativeTable, windows137, backSummary } from './metrics.ts';

const cfg: EditionConfig = {
  number: 22, liveDate: '2026-10-13', windowStart: '2026-09-29', windowEnd: '2026-10-13',
  ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45,
};
const sale = (content: string, at: string): CaptureRow => ({
  email: `${content}${at}@x.com`, phone: '', utmSource: 'fb', utmMedium: '', utmCampaign: '',
  utmContent: `webp_vendas_${content}`, at: `${at}T10:00:00`, edition: 22, funnel: 'WB03 - PAGO',
});
const ad = (adName: string, date: string, spend: number, ic = 0, impressions = 1000, linkClicks = 10): MetaAdDay => ({
  date, adId: `${adName}-id`, adName, adsetName: '', campaignName: '', spend, impressions, linkClicks,
  landingViews: 0, initiateCheckouts: ic, video3s: 0, thruplays: 0,
});

test('div never returns NaN or Infinity', () => {
  assert.equal(div(1, 0), null);
  assert.equal(div(0, 0), null);
  assert.equal(div(10, 4), 2.5);
});

test('ticketSales keeps only paid funnel rows of the chosen editions', () => {
  const rows = [sale('img_10', '2026-10-08'), { ...sale('img_10', '2026-10-08'), funnel: 'WB03' }, { ...sale('img_10', '2026-10-08'), edition: 21 }];
  assert.equal(ticketSales(rows, [22]).length, 1);
});

test('report #022 (08/10): img_10 CPA 17,14 and campaign CPA 39,04', () => {
  const sales = [
    ...Array.from({ length: 7 }, () => sale('img_10', '2026-10-07')),
    ...Array.from({ length: 2 }, () => sale('vid_1', '2026-10-07')),
    ...Array.from({ length: 4 }, () => sale('img_01', '2026-10-07')),
    ...Array.from({ length: 3 }, () => sale('img_11', '2026-10-07')),
  ];
  const ads = [
    ad('img_10', '2026-10-07', 119.96), ad('vid_1', '2026-10-07', 43.94),
    ad('img_01', '2026-10-07', 150), ad('img_01.2', '2026-10-07', 77.22),
    ad('img_11', '2026-10-07', 180.47), ad('vid_6', '2026-10-07', 15.86), ad('img_04', '2026-10-07', 37.24),
  ];
  const f = frontSummary(sales, ads, [cfg], {}, 0);
  assert.equal(f.sales, 16);
  assert.equal(f.revenue, 158.4);
  assert.equal(f.spend.toFixed(2), '624.69');
  assert.equal(f.cpa?.toFixed(2), '39.04');
  assert.equal(f.cpaSellingAds?.toFixed(2), '35.72');
  assert.equal(f.spendNoSales.toFixed(2), '53.10');
  assert.deepEqual(f.topNoSale, { family: 'img_04', spend: 37.24 });
  assert.equal(f.spendSource, 'meta');

  const t = creativeTable(sales, ads, cfg, {});
  assert.equal(t[0].family, 'img_10');
  assert.equal(t[0].cpa?.toFixed(2), '17.14');
  assert.equal(t[0].band, 'sonho');
  assert.equal(t.find(c => c.family === 'img_01')?.cpa?.toFixed(2), '56.81');
  assert.equal(t.find(c => c.family === 'img_01')?.band, 'acima');
});

test('no Meta data falls back to sheet investment; no spend gives null CPA', () => {
  const sales = [sale('img_10', '2026-10-07')];
  assert.equal(frontSummary(sales, [], [cfg], {}, 100).spendSource, 'planilha');
  const none = frontSummary(sales, [], [cfg], {}, 0);
  assert.equal(none.spendSource, 'nenhum');
  assert.equal(none.cpa, null);
  assert.equal(none.roas, null);
});

test('ads outside the edition window are ignored', () => {
  const f = frontSummary([], [ad('img_10', '2026-09-01', 500)], [cfg], {}, 0);
  assert.equal(f.spend, 0);
});

test('windows137 labels match the report rules', () => {
  const y = '2026-10-08';
  const sales = [
    sale('img_10', '2026-10-02'), sale('img_10', '2026-10-06'), sale('img_10', '2026-10-08'),
    sale('img_11', '2026-10-02'), sale('img_11', '2026-10-02'), sale('img_11', '2026-10-02'), sale('img_11', '2026-10-08'),
    sale('vid_6', '2026-10-02'),
  ];
  const ads = [
    ad('img_10', '2026-10-02', 30), ad('img_10', '2026-10-06', 30), ad('img_10', '2026-10-08', 30),
    ad('img_11', '2026-10-02', 60), ad('img_11', '2026-10-08', 180),
    ad('vid_6', '2026-10-02', 20), ad('vid_6', '2026-10-07', 44),
    ad('vid_3', '2026-10-08', 3.42),
  ];
  const w = Object.fromEntries(windows137(sales, ads, cfg, {}, y).map(x => [x.family, x.label]));
  assert.equal(w['img_10'], 'estável');
  assert.equal(w['img_11'], 'caindo forte');
  assert.equal(w['vid_6'], 'caindo');
  assert.equal(w['vid_3'], 'sem entrega');
});

test('backSummary: cost per call uses front spend; Pipedrive rows win over overview', () => {
  const front = frontSummary([], [ad('img_10', '2026-10-07', 300)], [cfg], {}, 0);
  const b = backSummary(
    [{ edition: 22, dayMonth: '13/10', applications: 10, scheduled: 99, done: 99, investment: 0 }],
    [
      { lostReason: '', closer: '', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-15', wonAt: null, done: true, email: 'a@x', edition: 22 },
      { lostReason: '', closer: '', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-16', wonAt: null, done: false, email: 'b@x', edition: 22 },
    ],
    [{ approved: true, product: 'Power', amount: 16788, email: 'a@x', phone: '', utmContentCapture: '', utmContentSale: '', at: null, edition: 22 },
     { approved: false, product: 'Power', amount: 16788, email: 'c@x', phone: '', utmContentCapture: '', utmContentSale: '', at: null, edition: 22 }],
    [22], front,
  );
  assert.equal(b.scheduled, 2);
  assert.equal(b.done, 1);
  assert.equal(b.costPerScheduled, 150);
  assert.equal(b.costPerDone, 300);
  assert.equal(b.highTicketSales, 1);
  assert.equal(b.applications, 10);
});
