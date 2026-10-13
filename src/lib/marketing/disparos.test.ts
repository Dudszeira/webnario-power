import test from 'node:test';
import assert from 'node:assert/strict';
import { disparoBlock, disparosTab, formatNumberInput, parseDisparoInput, parseNumberInput, type Disparo } from './disparos.ts';

const d = (o: Partial<Disparo>): Disparo => ({
  id: '1', kind: 'convite', ciclo: null, nome: 'Copy 01', data: '2026-09-20', contatos: 1000, agendamentos: 10,
  vendas: 0, faturamento: null, custo: 40, template: null, ...o,
});

test('disparoBlock: budget, rates, ROAS', () => {
  const b = disparoBlock([d({}), d({ agendamentos: 0, vendas: 1, faturamento: 30000, custo: 60 })]);
  assert.deepEqual(b, { count: 2, contatos: 2000, custo: 100, agendamentos: 10, agendRate: 0.005, costPerAgend: 10, vendas: 1, faturamento: 30000, roas: 300 });
  assert.deepEqual([disparoBlock([]).roas, disparoBlock([]).costPerAgend], [null, null]);
});

test('disparosTab: blocks per kind, ranking by agendamentos, period filter by date', () => {
  const rows = [d({ id: 'a', agendamentos: 2 }), d({ id: 'b', agendamentos: 9 }), d({ id: 'c', kind: 'recuperacao', data: '2026-08-01', agendamentos: 1 })];
  const t = disparosTab(rows, null);
  assert.deepEqual(t.ranking.map(r => r.id), ['b', 'a']);
  assert.deepEqual([t.convite.count, t.recuperacao.count, t.total.count], [2, 1, 3]);
  assert.equal(disparosTab(rows, { from: '2026-09-01', to: '2026-09-30' }).total.count, 2);
});

test('parseDisparoInput validates at the trust boundary', () => {
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'Copy 01', contatos: 10, custo: 1.5 }, false).ok, true);
  assert.equal(parseDisparoInput({ kind: 'spam', nome: 'x' }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: '  ' }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', contatos: -1 }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', contatos: 1.5 }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', custo: Number.NaN }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', data: '20/09/2026' }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x'.repeat(121) }, false).ok, false);
  assert.deepEqual(parseDisparoInput({ custo: '' }, true), { ok: true, value: { custo: null } });
  assert.equal(parseDisparoInput(null, true).ok, false);
});

test('editor numbers round-trip without losing decimals', () => {
  assert.equal(parseNumberInput('16,80'), 16.8);
  assert.equal(parseNumberInput('16.8'), 16.8);
  assert.equal(parseNumberInput('1.234,56'), 1234.56);
  assert.equal(parseNumberInput('3213'), 3213);
  assert.equal(parseNumberInput('  '), null);
  assert.ok(Number.isNaN(parseNumberInput('abc')));
  assert.equal(formatNumberInput(16.8), '16,8');
  assert.equal(formatNumberInput(1234.5), '1234,5');
  assert.equal(formatNumberInput(null), '');
  assert.equal(parseNumberInput(formatNumberInput(158.68)), 158.68); // editar sem mudar mantém o valor
});

test('parseNumberInput: dot with exactly 3 digits after is thousands', () => {
  assert.equal(parseNumberInput('1.234'), 1234);
  assert.equal(parseNumberInput('1.500'), 1500);
  assert.equal(parseNumberInput('12.345.678'), 12345678);
  assert.equal(parseNumberInput('16.8'), 16.8);
});

test('disparoBlock: nulls are not zeros; cost per agend only over rows with both values', () => {
  const none = disparoBlock([d({ contatos: null, agendamentos: null, vendas: null, faturamento: null, custo: null })]);
  assert.deepEqual([none.contatos, none.custo, none.agendamentos, none.vendas, none.faturamento, none.costPerAgend, none.roas], [null, null, null, null, null, null, null]);
  const b = disparoBlock([d({ custo: 40, agendamentos: 10 }), d({ custo: 500, agendamentos: null }), d({ custo: null, agendamentos: 90 })]);
  assert.equal(b.costPerAgend, 4);
  assert.equal(b.custo, 540);
  assert.equal(b.agendamentos, 100);
  assert.equal(disparoBlock([]).custo, null);
});
