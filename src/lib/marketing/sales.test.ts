import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SaleRow, SurveyRow } from './types.ts';
import { buyersTab, classifyAudience, normProd, normSource, saleValue, salesTab } from './sales.ts';

const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 20, ...o,
});
const lead = (o: Partial<CaptureRow>): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: 'ig', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', at: null, edition: 20, funnel: '', ...o,
});
const sv = (email: string, renda: string, servico = ''): SurveyRow => ({ email, at: null, tempo: '', servico, renda, fat: '', conhece: '', desafios: '' });

test('normProd and saleValue default tickets', () => {
  assert.equal(normProd('Power Start'), 'powerStart');
  assert.equal(normProd('Start (dupla)'), 'powerStart');
  assert.equal(normProd('PWS'), 'powerStart');
  assert.equal(normProd('Power '), 'power');
  assert.equal(normProd('Desafio Poderoso'), 'desafio');
  assert.equal(normProd('Outro'), 'outro');
  assert.equal(saleValue(sale({ product: 'Power Start' })), 1997);
  assert.equal(saleValue(sale({ product: 'Power', amount: 16788 })), 16788);
});

test('classifyAudience follows the old precedence', () => {
  assert.equal(classifyAudience('frio', 'api', '', ''), 'api');
  assert.equal(classifyAudience('', 'fb', '', 'APIWEB01'), 'api');
  assert.equal(classifyAudience('frio', 'email', '', ''), 'email');
  assert.equal(classifyAudience('[wb] frio', 'ig', 'quente', ''), 'frio');
  assert.equal(classifyAudience('x', 'ig', 'publico-quente', ''), 'quente');
  assert.equal(classifyAudience('pwr_perpetuo', 'ig', '', ''), 'bio_se');
  assert.equal(classifyAudience('web_01_26', 'ig', '', ''), 'insta_organico');
  assert.equal(classifyAudience('outra', 'ig', '', ''), 'outros');
});

test('normSource maps Meta placements unless organic', () => {
  assert.equal(normSource('ig', 'cpc', 'x'), 'meta ads');
  assert.equal(normSource('ig', 'stories', 'x'), 'instagram orgânico');
  assert.equal(normSource('', '', ''), '(sem utm)');
  assert.equal(normSource('Google', '', ''), 'google');
});

test('salesTab excludes refunds from every count', () => {
  const leads = [lead({ utmCampaign: 'frio' }), lead({ utmCampaign: 'frio' }), lead({ utmCampaign: 'quente' }), lead({ utmSource: 'api' })];
  const t = salesTab(leads, [
    sale({ product: 'Power Start', capCampaign: 'frio', capSource: 'ig' }),
    sale({ product: 'Power', capCampaign: 'quente', approved: false, refunded: true }),
    sale({ product: 'Desafio', capSource: 'api', amount: 997, at: '2026-10-10T10:00:00' }),
  ], false);
  assert.deepEqual([t.sales, t.refunds, t.revenue, t.avgTicket, t.conversion], [2, 1, 2994, 1497, 0.5]);
  assert.deepEqual(t.audiences.map(a => [a.key, a.leads, a.sales, a.refunds]), [['quente', 1, 0, 1], ['frio', 2, 1, 0], ['api', 1, 1, 0]]);
  assert.deepEqual(t.byDay, [{ key: '2026-10-10', count: 1 }]);
  assert.equal(t.lists, null);
  assert.equal(salesTab(leads, [], true).lists?.frio?.length, 0);
});

test('buyersTab joins survey by e-mail and filters product', () => {
  const sales = [
    sale({ email: 'a@x', product: 'Power' }), sale({ email: 'b@x', product: 'Power Start' }),
    sale({ email: 'c@x', product: 'Power', approved: false, refunded: true }),
  ];
  const surveys = { 'a@x': sv('a@x', '5a7k', 'estudio') };
  const p = buyersTab(sales, surveys, 'power', false);
  assert.deepEqual([p.filter, p.buyers, p.responded, p.qualified], ['power', 1, 1, 1]);
  assert.deepEqual(p.topIncome, { key: 'R$5k a 7k', count: 1 });
  assert.deepEqual(p.topService, { key: 'Estúdio', count: 1 });
  assert.equal(p.list, null);
  const all = buyersTab(sales, surveys, 'x', true);
  assert.deepEqual([all.filter, all.buyers, all.responded, all.list?.length], ['todos', 2, 1, 2]);
});
