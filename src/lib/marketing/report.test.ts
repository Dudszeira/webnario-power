import test from 'node:test';
import assert from 'node:assert/strict';
import { brl, dailyReport, editionReport, report137 } from './report.ts';
import type { EditionConfig } from './types.ts';
import type { CreativeStats, FrontSummary } from './metrics.ts';

const cfg: EditionConfig = { number: 22, liveDate: '2026-10-13', windowStart: '2026-09-29', windowEnd: '2026-10-13', ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45 };
const front: FrontSummary = { sales: 16, revenue: 158.4, spend: 624.69, spendSource: 'meta', roas: 0.2536, cpa: 39.04, cpaSellingAds: 35.72, spendNoSales: 53.1, topNoSale: { family: 'vid_6', spend: 15.86 }, ic: 0, costPerIc: null };
const c = (family: string, sales: number, spend: number): CreativeStats => ({ family, sales, spend, cpa: spend / sales, ic: 0, costPerIc: null, impressions: 0, ctr: null, hookRate: null, bodyRate: null, band: null });

test('brl formats money and missing values', () => {
  assert.equal(brl(119.96), 'R$ 119,96');
  assert.equal(brl(null), '—');
});

test('editionReport follows the team format', () => {
  const txt = editionReport(cfg, front, [c('img_10', 7, 119.96), c('vid_1', 2, 43.94)], { img_10: 'https://www.instagram.com/p/Dd7ZZxHstCp/' }, '08/10');
  assert.match(txt, /REPORT WEBNÁRIO PAGO #022 \| 08\/10/);
  assert.match(txt, /16 vendas no total \(R\$ 158,40\) e R\$ 624,69 investidos = ROAS 0,25/);
  assert.match(txt, /img_10: 7 vendas \| R\$ 119,96 \| CPA R\$ 17,14/);
  assert.match(txt, /Tem R\$ 53,10 em anúncios que ainda não venderam\. O maior deles é o vid_6, com R\$ 15,86\./);
  assert.match(txt, /https:\/\/www\.instagram\.com\/p\/Dd7ZZxHstCp\//);
});

test('report137 prints the three windows per creative', () => {
  const w = [{ family: 'img_10', label: 'estável' as const, d1: c('img_10', 3, 100.12), d3: c('img_10', 9, 256.14), d7: c('img_10', 18, 694.26) }];
  const txt = report137(w, '08/10');
  assert.match(txt, /img_10: estável/);
  assert.match(txt, /1d: 3 vendas \| CPA R\$ 33,37/);
});

test('dailyReport prints "a <custo>" only when there was IC', () => {
  const none = dailyReport(cfg, { ...front, ic: 0, costPerIc: null }, [c('img_10', 2, 40)], {}, '08/10');
  assert.match(none, /^0 IC$/m);
  assert.doesNotMatch(none, /IC a/);
  assert.match(none, /^ 2 vendas \| R\$ 40,00 \| CPA R\$ 20,00 \| 0 IC$/m);
  const some = dailyReport(cfg, { ...front, ic: 10, costPerIc: 62.47 }, [{ ...c('img_10', 2, 40), ic: 4, costPerIc: 10 }], {}, '08/10');
  assert.match(some, /^10 IC a R\$ 62,47 cada$/m);
  assert.match(some, /^ 2 vendas \| R\$ 40,00 \| CPA R\$ 20,00 \| 4 IC a R\$ 10,00$/m);
});

test('reports show "—" for investment when there is no spend source', () => {
  const nenhum: FrontSummary = { ...front, spend: 0, spendSource: 'nenhum', roas: null, cpa: null, cpaSellingAds: null, spendNoSales: 0, topNoSale: null };
  const ed = editionReport(cfg, nenhum, [], {}, '08/10');
  assert.match(ed, /16 vendas no total \(R\$ 158,40\) e — investidos = ROAS —\./);
  assert.match(ed, /\(sem dados de investimento\)/);
  assert.doesNotMatch(ed, /R\$ 0,00|fonte nenhum/);
  const daily = dailyReport(cfg, nenhum, [], {}, '08/10');
  assert.match(daily, /com — investidos = ROAS —/);
  assert.doesNotMatch(daily, /R\$ 0,00/);
});
