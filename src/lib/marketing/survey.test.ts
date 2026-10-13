import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SurveyRow } from './types.ts';
import { challenges, distribution, filterIncome, latestSurveys, qualified5k, surveyTab } from './survey.ts';

const sv = (email: string, renda: string, at: string | null, extra: Partial<SurveyRow> = {}): SurveyRow =>
  ({ email, at, tempo: '', servico: '', renda, fat: '', conhece: '', desafios: '', ...extra });

test('latestSurveys keeps the most recent answer of the cycle', () => {
  const m = latestSurveys([
    sv('a@x', '1a3k', '2026-09-01T10:00:00'), sv('a@x', '5a7k', '2026-09-05T10:00:00'), sv('a@x', 'mais50k', '2026-09-03T10:00:00'),
    sv('b@x', '5a7k', '2026-07-01T00:00:00'), sv('', '5a7k', null),
  ], '2026-08-24T10:00:00');
  assert.equal(m['a@x'].renda, '5a7k');
  assert.equal(m['b@x'], undefined);
  assert.deepEqual(Object.keys(m), ['a@x']);
});

test('latestSurveys: an undated row never overwrites a dated answer', () => {
  const m = latestSurveys([sv('a@x', '5a7k', '2026-09-05T10:00:00'), sv('a@x', '1a3k', null), sv('b@x', '1a3k', null), sv('b@x', '7a10k', '2026-09-06T10:00:00')], null);
  assert.equal(m['a@x'].renda, '5a7k');
  assert.equal(m['b@x'].renda, '7a10k');
});

test('qualified5k and income filters', () => {
  assert.equal(qualified5k('5a7k'), true);
  assert.equal(qualified5k('3a5k'), false);
  const xs = [sv('a', '3a5k', null), sv('b', '7a10k', null), sv('c', 'mais50k', null)];
  assert.equal(filterIncome(xs, '5kplus').length, 2);
  assert.equal(filterIncome(xs, '3a5k').length, 1);
  assert.equal(filterIncome(xs, 'all').length, 3);
  assert.equal(filterIncome(xs, 'constructor').length, 0);
});

test('distribution follows the fixed order, labels, marks qualified, keeps unknown answers last', () => {
  const d = distribution([sv('a', '7a10k', null), sv('b', 'zero', null), sv('c', '7a10k', null), sv('d', 'outra coisa', null), sv('e', '', null)], 'renda');
  assert.deepEqual(d.map(x => [x.label, x.count, x.qualified]), [['Zero', 1, false], ['R$7k a 10k', 2, true], ['outra coisa', 1, false]]);
});

test('challenges: phrases normalized and counted; bigrams skip short words, stopwords and vague-verb pairs', () => {
  const c = challenges([
    sv('a', '', null, { desafios: 'Conseguir clientes novos.' }),
    sv('b', '', null, { desafios: 'conseguir   clientes novos' }),
    sv('c', '', null, { desafios: 'Precificação dos ensaios' }),
    sv('d', '', null, { desafios: 'conseguir buscar' }),
    sv('e', '', null, { desafios: 'x' }),
  ]);
  assert.deepEqual(c.phrases.map(p => [p.text, p.count]), [['Conseguir clientes novos.', 2], ['Precificação dos ensaios', 1], ['conseguir buscar', 1]]);
  assert.deepEqual(c.keywords.map(k => [k.word, k.count]), [['conseguir clientes', 2], ['clientes novos', 2]]);
  assert.deepEqual(c.keywords[0].examples, ['Conseguir clientes novos.']);
});

test('surveyTab joins survey to leads by e-mail and computes rates', () => {
  const leads = [{ email: 'a@x' }, { email: 'a@x' }, { email: 'b@x' }, { email: 'c@x' }] as CaptureRow[];
  const t = surveyTab(leads, { 'a@x': sv('a@x', '5a7k', null), 'b@x': sv('b@x', '1a3k', null), 'z@x': sv('z@x', 'mais50k', null) }, 'all');
  assert.deepEqual([t.leads, t.responses, t.filtered, t.qualified, t.responseRate, t.quality], [4, 2, 2, 1, 0.5, 0.5]);
  assert.equal(t.charts.renda.length, 2);
  assert.equal(surveyTab(leads, {}, 'all').quality, null);
});
