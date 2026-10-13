import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, OverviewCheck, SaleRow, SurveyRow } from './types.ts';
import type { Application } from './applications.ts';
import type { Deal } from './deals.ts';
import type { LiveStats } from './live.ts';
import { creativeExtras, editionFunnel, sortCreatives, webinarTable } from './breakdowns.ts';

const app = (o: Partial<Application>): Application => ({
  name: '', email: '', at: null, product: '', qualif: '', qualified: false, complete: true, income: '', revenue: '', relation: '',
  interest: '', scheduled: false, origin: '', originGroup: '', edition: 22, editionByEmail: true, creative: '', repeats: 0, key: '', ...o,
});
const deal = (o: Partial<Deal>): Deal => ({
  name: '', type: 'WB', closer: 'Ana', via: '', product: 'Power', scheduledAt: '2026-10-13', callDate: null, realized: false,
  lostReason: '', status: 'agendada', alerts: [], income: '', value: 0, edition: 22, editionBy: 'planilha',
  creative: '', utmContent: '', utmSource: '', ...o,
});
const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 22, ...o,
});
const lead = (edition: number): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', at: null, edition, funnel: '',
});
const stats = (o: Partial<LiveStats>): LiveStats => ({
  people: 0, watched: 0, peak: 0, peakMinute: 0, mean: null, median: null, toPitch: 0, min30: 0, min60: 0, cta: 0, curve: [], histogram: [], pitchMinute: 66, ...o,
});
const check = (o: Partial<OverviewCheck>): OverviewCheck => ({
  applications: null, scheduled: null, done: null, peak: null, attendance: null, metaSpend: null, investment: null, sales: null, revenue: null, ...o,
});

test('editionFunnel splits Power and Start; refunds and incomplete applications stay out', () => {
  const f = editionFunnel(
    [app({ qualif: 'Power', qualified: true }), app({ qualif: 'Start', qualified: true }), app({ qualif: 'Desafio' }), app({ complete: false })],
    [deal({ product: 'Power', status: 'ganho', realized: true }), deal({ product: 'Power' }), deal({ product: 'Start', status: 'perdido', realized: true }), deal({ product: '' })],
    [sale({ product: 'Power' }), sale({ product: 'Desafio' }), sale({ product: 'Power Start', approved: false, refunded: true })],
  );
  assert.deepEqual(f, {
    applications: 3, qualified: 2, scheduled: 4, done: 2,
    power: { qualified: 1, scheduled: 2, done: 1, sales: 1 },
    start: { qualified: 1, scheduled: 1, done: 1, sales: 0 },
    desafioSales: 1,
  });
});

test('webinarTable: moment buckets, via API, calls, attendance, live conversion from 20h to 6h', () => {
  const t = webinarTable(
    [{ number: 22, liveDate: '2026-10-13' }],
    [lead(22), lead(22), lead(21)],
    [deal({ scheduledAt: '2026-10-12', utmContent: 'APIAI02' }), deal({ status: 'realizada', realized: true, utmContent: '197' }), deal({ scheduledAt: '2026-10-15', utmSource: 'API' })],
    [sale({ amount: 20040 })],
    [app({ at: '2026-10-13T21:00:00' }), app({ at: '2026-10-14T05:59:00' }), app({ at: '2026-10-14T06:01:00' }), app({ at: '2026-10-13T21:30:00', complete: false })],
    { 22: stats({ peak: 50, toPitch: 20 }) },
    { 22: check({ peak: 52 }) },
  );
  const r = t.rows[0];
  assert.deepEqual(
    [r.leads, r.scheduled, r.before, r.onDay, r.after, r.viaApi, r.calls, r.sales, r.revenue, r.peak, r.sheetPeak, r.toPitch, r.applications, r.liveApps, r.liveConversion],
    [2, 3, 1, 1, 1, 3, 1, 1, 20040, 50, 52, 20, 3, 2, 0.1],
  );
  assert.deepEqual([r.attendance, r.attendanceFromSheet], [2500, false]); // sem Visão Geral: pico ÷ leads × 100
  assert.equal(t.total, null);
  const two = webinarTable(
    [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }], [lead(21), lead(22)], [], [], [],
    { 21: null, 22: stats({ toPitch: 10 }) }, { 21: check({ attendance: 12.5 }), 22: null },
  );
  assert.deepEqual([two.rows[0].peak, two.rows[0].attendance, two.rows[0].attendanceFromSheet], [null, 12.5, true]);
  assert.deepEqual([two.total?.leads, two.total?.toPitch, two.total?.peak, two.total?.attendance], [2, 10, null, null]);
});

test('creativeExtras: leads, 5k+ rate, schedules and high-ticket sales per creative family', () => {
  const lc = (utmContent: string, email: string): CaptureRow => ({ ...lead(22), utmContent, email });
  const sv = (email: string, renda: string): SurveyRow => ({ email, at: null, tempo: '', servico: '', renda, fat: '', conhece: '', desafios: '' });
  const x = creativeExtras(
    [lc('webp_vendas_img_10', 'a@x'), lc('img_10', 'b@x'), lc('vid_2', 'c@x')],
    { 'a@x': sv('a@x', '7a10k') },
    [deal({ creative: 'Web3_coleta_img_10' })],
    [sale({ utmContentCapture: 'img_10', product: 'Power Start' }), sale({ utmContentCapture: 'img_10', approved: false, refunded: true })],
    {},
  );
  const img = x.filter(r => r.family === 'img_10')[0];
  assert.deepEqual([img.leads, img.qualified, img.qualifiedRate, img.scheduled, img.sales, img.start, img.power], [2, 1, 0.5, 1, 1, 1, 0]);
  assert.equal(x.filter(r => r.family === 'vid_2')[0].qualifiedRate, 0);
});

test('sortCreatives keeps the old tie-breaks', () => {
  const ex = (family: string, leads: number, qualified: number, scheduled: number, sales: number) =>
    ({ x: { family, leads, qualified, qualifiedRate: null, scheduled, sales, power: 0, start: 0, desafio: 0 } });
  const rows = [ex('a', 10, 1, 2, 1), ex('b', 20, 1, 2, 1), ex('c', 5, 3, 0, 0), ex('d', 20, 0, 0, 2)];
  const ids = (s: 'vendas' | 'agend' | 'qualif' | 'leads') => sortCreatives(rows, s).map(r => r.x.family).join('');
  assert.equal(ids('vendas'), 'dbac');
  assert.equal(ids('agend'), 'badc');
  assert.equal(ids('qualif'), 'cbad');
  assert.equal(ids('leads'), 'dbac');
});
