import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, toRecords, parseBRL, parseDateTime, parseDay, parseEditionNumber,
  normEmail, phoneKey, inferLiveDate, addDays,
} from './parse.ts';

test('parseCsv handles quotes, commas and newlines inside fields', () => {
  const rows = parseCsv('"a","b,c"\r\n"x ""y""","linha\nquebrada"\n');
  assert.deepEqual(rows, [['a', 'b,c'], ['x "y"', 'linha\nquebrada']]);
});

test('toRecords trims headers, drops blank header columns and empty rows', () => {
  const recs = toRecords([[' STATUS ', '', 'Produto'], ['Aprovada', 'lixo', 'Power'], ['', '', '']]);
  assert.deepEqual(recs, [{ STATUS: 'Aprovada', Produto: 'Power' }]);
});

test('parseBRL reads Brazilian money', () => {
  assert.equal(parseBRL('9.990,00'), 9990);
  assert.equal(parseBRL('R$ 119,96'), 119.96);
  assert.equal(parseBRL('9.9'), 9.9);
  assert.equal(parseBRL(''), 0);
  assert.equal(parseBRL('abc'), 0);
});

test('parseDateTime and parseDay accept BR and ISO formats', () => {
  assert.equal(parseDateTime('10/10/2026 08:57:00'), '2026-10-10T08:57:00');
  assert.equal(parseDateTime('08/10/2026 19:01'), '2026-10-08T19:01:00');
  assert.equal(parseDateTime('2026-09-29'), '2026-09-29T00:00:00');
  assert.equal(parseDateTime(''), null);
  assert.equal(parseDay('17/09/2026 15:01:08'), '2026-09-17');
  assert.equal(parseDay('lixo'), null);
});

test('parseEditionNumber', () => {
  assert.equal(parseEditionNumber('#022'), 22);
  assert.equal(parseEditionNumber(' #9 '), 9);
  assert.equal(parseEditionNumber(''), null);
});

test('normEmail and phoneKey', () => {
  assert.equal(normEmail('  Ana@Gmail.COM '), 'ana@gmail.com');
  assert.equal(phoneKey('+55 (51) 99876-5432'), '98765432');
  assert.equal(phoneKey('(51) 9876-5432'), '98765432');
  assert.equal(phoneKey('123'), '');
});

test('inferLiveDate picks the year closest to today', () => {
  assert.equal(inferLiveDate('13/10', '2026-10-10'), '2026-10-13');
  assert.equal(inferLiveDate('30/12', '2027-01-05'), '2026-12-30');
  assert.equal(inferLiveDate('05/01', '2026-12-28'), '2027-01-05');
  assert.equal(inferLiveDate('xx', '2026-10-10'), null);
});

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-01', -1), '2026-09-30');
});
