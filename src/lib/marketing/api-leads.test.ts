import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SaleRow, SurveyRow } from './types.ts';
import { apiTab } from './api-leads.ts';

const cap = (o: Partial<CaptureRow>): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: 'api', utmMedium: 'base-2024', utmCampaign: 'convite', utmTerm: 'v1',
  utmContent: 'APIWEB01', at: '2026-10-10T10:00:00', edition: 22, funnel: '', ...o,
});
const sv = (email: string, renda: string): SurveyRow => ({ email, at: null, tempo: '', servico: '', renda, fat: '', conhece: '', desafios: '' });
const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 22, ...o,
});

test('apiTab aggregates API leads by base, version and shot', () => {
  const leads = [cap({ email: 'a@x' }), cap({ email: 'b@x', utmTerm: 'v2', at: '2026-10-11T09:00:00' }), cap({ email: 'c@x', utmMedium: '' }), cap({ utmSource: 'ig' })];
  const t = apiTab(leads, { 'a@x': sv('a@x', '7a10k'), 'b@x': sv('b@x', '1a3k') }, [
    sale({ capSource: 'API', amount: 997, product: 'Desafio' }),
    sale({ capSource: 'api', approved: false, refunded: true }),
  ]);
  assert.deepEqual([t.leads, t.totalLeads, t.qualified, t.responded], [3, 4, 1, 2]);
  assert.deepEqual(t.bases.map(b => [b.key, b.leads, b.qualified]), [['base-2024', 2, 1], ['(sem base)', 1, 0]]);
  assert.deepEqual(t.versions.map(v => v.key), ['v1', 'v2']);
  assert.deepEqual(t.shots.map(s => s.key), ['APIWEB01 · convite']);
  assert.deepEqual(t.matrix['base-2024|v1'], { leads: 1, qualified: 1 });
  assert.deepEqual(t.byDay, [{ key: '2026-10-10', count: 2 }, { key: '2026-10-11', count: 1 }]);
  assert.deepEqual(t.bestDay, { key: '2026-10-10', count: 2 });
  assert.deepEqual([t.sales, t.revenue], [1, 997]);
});

test('apiTab without survey source: qualified and responded are null, not 0', () => {
  const t = apiTab([cap({ email: 'a@x' })], {}, [], false);
  assert.deepEqual([t.leads, t.qualified, t.responded, t.bases[0].qualified, t.bases[0].responded, t.matrix['base-2024|v1'].qualified], [1, null, null, null, null, null]);
});
