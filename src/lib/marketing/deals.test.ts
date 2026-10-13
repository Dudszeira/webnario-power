import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SaleRow, ScheduleRow } from './types.ts';
import { indexCaptures } from './editions.ts';
import { buildDeals, dealStatus, dealsTab, type Deal } from './deals.ts';

const eds = [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }];
const st = (o: Partial<Parameters<typeof dealStatus>[0]>) =>
  dealStatus({ won: false, saleOk: false, saleRefunded: false, lostReason: '', realizedRaw: '', callDate: null, ...o }, '2026-10-13');
const sch = (o: Partial<ScheduleRow>): ScheduleRow => ({
  lostReason: '', closer: 'Ana', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-16', wonAt: null, done: false,
  email: '', edition: null, title: 'WB - Pessoa', personName: '', emails: [], via: '', realizedRaw: '', productRaw: '',
  income: '', value: 0, utmSource: '', utmCampaign: '', utmMedium: '', ...o,
});
const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 22, ...o,
});
const cap = (email: string, at: string, edition: number, utmContent: string): CaptureRow => ({
  email, at, edition, phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent, funnel: '',
});

test('dealStatus follows the old rules, with "today" in Brasília passed in', () => {
  assert.equal(st({ saleOk: true, lostReason: 'x' }), 'ganho');
  assert.equal(st({ won: true, saleRefunded: true }), 'reembolsado');
  assert.equal(st({ won: true }), 'ganho');
  assert.equal(st({ lostReason: 'Sem dinheiro', realizedRaw: 'sim' }), 'perdido');
  assert.equal(st({ realizedRaw: 'Sim' }), 'realizada');
  assert.equal(st({ realizedRaw: 'reagendada' }), 'reagendada');
  assert.equal(st({ realizedRaw: 'Cancelou' }), 'cancelada');
  assert.equal(st({ realizedRaw: 'no show' }), 'nao_realizada');
  assert.equal(st({ realizedRaw: 'Não', callDate: '2026-10-13' }), 'agendada'); // call hoje ainda vai acontecer
  assert.equal(st({ realizedRaw: 'Não', callDate: '2026-10-12' }), 'nao_realizada');
  assert.equal(st({ callDate: '2026-10-12' }), 'sem_registro');
  assert.equal(st({ callDate: '2026-10-13' }), 'agendada');
  assert.equal(st({}), 'agendada');
});

test('buildDeals: sale by e-mail, edition from sheet > e-mail > date, alerts', () => {
  const idx = indexCaptures([cap('b@x', '2026-10-10T10:00:00', 22, 'vid_3')]);
  const ds = buildDeals([
    sch({ emails: ['a@x'], edition: 21, via: 'Sim, Automático', realizedRaw: 'sim' }),
    sch({ emails: ['b@x'], title: 'SE - Fulano', closer: '', callDate: '2026-11-30' }),
    sch({ title: 'WB - Sem Email', scheduledAt: '2026-10-08', callDate: '2026-10-07', personName: 'Beltrano' }),
  ], [sale({ email: 'a@x', product: 'Power', amount: 20040, edition: 21 })], idx, {}, eds, '2026-10-13');
  assert.deepEqual([ds[0].status, ds[0].edition, ds[0].editionBy, ds[0].value, ds[0].via, ds[0].product], ['ganho', 21, 'planilha', 20040, 'Automático', 'Power']);
  assert.deepEqual([ds[1].edition, ds[1].editionBy, ds[1].creative, ds[1].type, ds[1].product, ds[1].name], [22, 'email', 'vid_3', 'SE', 'Start', 'Fulano']);
  assert.ok(ds[1].alerts.some(a => a.includes('dias depois')));
  assert.ok(ds[1].alerts.indexOf('sem closer') >= 0);
  assert.deepEqual([ds[2].edition, ds[2].editionBy, ds[2].name], [21, 'data', 'Beltrano']);
  assert.ok(ds[2].alerts.indexOf('call antes do agendamento') >= 0);
});

test('buildDeals matches a sale by normalized name when there is no e-mail', () => {
  const [d] = buildDeals([sch({ personName: 'José da Silva' })], [sale({ name: 'jose  DA silva', product: 'Power Start' })], indexCaptures([]), {}, eds, '2026-10-13');
  assert.deepEqual([d.status, d.value], ['ganho', 1997]);
});

test('buildDeals: an NF10K deal only matches #015–#020 sales; a paid deal only paid sales', () => {
  const ds = buildDeals([
    sch({ emails: ['a@x'], edition: 18 }),
    sch({ emails: ['b@x'], edition: 22 }),
  ], [sale({ email: 'a@x', edition: 22 }), sale({ email: 'b@x', edition: 22, amount: 20040 })], indexCaptures([]), {}, eds, '2026-10-13');
  assert.deepEqual([ds[0].status, ds[0].value], ['agendada', 0]);
  assert.deepEqual([ds[1].status, ds[1].value], ['ganho', 20040]);
  const [nf] = buildDeals([sch({ emails: ['a@x'], edition: 18 })], [sale({ email: 'a@x', edition: 18, product: 'Power Start' })], indexCaptures([]), {}, eds, '2026-10-13');
  assert.equal(nf.status, 'ganho');
});

test('dealsTab: KPIs, moment buckets, losing creatives (n ≥ 3), cost per call', () => {
  const mk = (o: Partial<Deal>): Deal => ({
    name: 'x', type: 'WB', closer: 'Ana', via: 'Automático', product: 'Power', scheduledAt: '2026-10-13', callDate: '2026-10-15',
    realized: false, lostReason: '', status: 'agendada', alerts: [], income: '', value: 0, edition: 22, editionBy: 'planilha',
    creative: 'vid_1', utmContent: '', utmSource: '', ...o,
  });
  const deals = [
    mk({ status: 'ganho', realized: true, value: 20040, scheduledAt: '2026-10-12' }),
    mk({ status: 'perdido', realized: true, lostReason: 'Preço' }),
    mk({ status: 'nao_realizada', product: 'Start', scheduledAt: '2026-10-14' }),
    mk({ status: 'cancelada', creative: 'vid_2' }),
    mk({ status: 'agendada', edition: 21 }),
  ];
  const t = dealsTab(deals, [{ number: 22, liveDate: '2026-10-13' }], { 22: 400 }, null, false);
  assert.deepEqual([t.total, t.power, t.start, t.realized, t.noShow, t.won, t.wonRevenue, t.lost], [4, 3, 1, 2, 1, 1, 20040, 1]);
  assert.equal(t.attendance, 2 / 3);
  assert.deepEqual(t.lostByReason, [{ key: 'Preço', count: 1 }]);
  const m = t.moment[0];
  assert.deepEqual([m.before.ganho, m.onDay.perdCall, m.onDay.perdSem, m.after.perdSem, m.onDay.total], [1, 1, 1, 1, 2]);
  assert.deepEqual(t.losingCreatives.map(c => [c.creative, c.n, c.lost, c.tone]), [['vid_1', 3, 1, 'green']]);
  const r = t.costPerCall.rows[0];
  assert.deepEqual([r.cost, r.costPower, r.costStart], [100, 400 / 3, 400]);
  assert.equal(t.list, null);
  assert.equal(dealsTab(deals, [{ number: 22, liveDate: '2026-10-13' }], { 22: null }, null, true).costPerCall.rows[0].cost, null);
});

test('dealsTab: with a period set, cost per call still uses all deals of the edition', () => {
  const mk = (scheduledAt: string): Deal => ({
    name: 'x', type: 'WB', closer: 'Ana', via: 'Automático', product: 'Power', scheduledAt, callDate: null,
    realized: false, lostReason: '', status: 'agendada', alerts: [], income: '', value: 0, edition: 22, editionBy: 'planilha',
    creative: 'vid_1', utmContent: '', utmSource: '',
  });
  const deals = [mk('2026-10-10'), mk('2026-10-11'), mk('2026-10-14'), mk('2026-10-15')];
  const t = dealsTab(deals, [{ number: 22, liveDate: '2026-10-13' }], { 22: 400 }, { from: '2026-10-14', to: '2026-10-15' }, false);
  assert.equal(t.total, 2);
  assert.deepEqual([t.costPerCall.rows[0].n, t.costPerCall.rows[0].cost], [4, 100]);
}
);
