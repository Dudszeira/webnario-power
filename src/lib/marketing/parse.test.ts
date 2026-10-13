import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, toRecords, parseBRL, parseDateTime, parseDay, parseEditionNumber,
  normEmail, phoneKey, inferLiveDate, addDays,
  normHeader, findCol, findColAll, firstCol, parseBR, parseBROrNull, shiftHours, normName,
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

test('normHeader and toRecords collapse spaces and newlines in headers', () => {
  assert.equal(normHeader(' Investimento Total \nAPI '), 'Investimento Total API');
  const recs = toRecords([['Agendamentos  PWR', 'Investimento Total \nAPI'], ['3', '10']]);
  assert.deepEqual(recs, [{ 'Agendamentos PWR': '3', 'Investimento Total API': '10' }]);
});

test('findCol tries needles in order; findColAll needs every needle; firstCol keeps sheet order', () => {
  const h = ['Data de envio', 'Renda familiar', 'Faturamento renda'];
  assert.equal(findCol(h, 'renda familiar', 'renda'), 'Renda familiar');
  assert.equal(findCol(h, 'xyz', 'renda'), 'Renda familiar');
  assert.equal(findCol(h, 'nada'), null);
  assert.equal(findColAll(['Investimento Captação Meta', 'Investimento Total'], 'capta', 'meta'), 'Investimento Captação Meta');
  assert.equal(firstCol(['utm_content_venda', 'utm_content_captacao'], 'utm_content_captacao', 'utm_content_venda'), 'utm_content_venda');
});

test('parseBR reads sheet numbers like the old dashboard (thousand dots, R$, %, formula errors)', () => {
  assert.equal(parseBR('16.788'), 16788);
  assert.equal(parseBR('R$ 1.000'), 1000);
  assert.equal(parseBR('1.997,00'), 1997);
  assert.equal(parseBR('R$ 1.234,56'), 1234.56);
  assert.equal(parseBR('45%'), 45);
  assert.equal(parseBR('9.9'), 9.9);
  assert.equal(parseBR('#DIV/0!'), 0);
  assert.equal(parseBR(''), 0);
  assert.equal(parseBROrNull(''), null);
  assert.equal(parseBROrNull('#N/A'), null);
  assert.equal(parseBROrNull('0'), 0);
});

test('parseDateTime: comma/T separators, 1-digit fields, only years 2021–2099', () => {
  assert.equal(parseDateTime('10/10/2026, 08:57:00'), '2026-10-10T08:57:00');
  assert.equal(parseDateTime('1/2/2026 8:5'), '2026-02-01T08:05:00');
  assert.equal(parseDateTime('2026-10-14T01:30:00.000Z'), '2026-10-14T01:30:00');
  assert.equal(parseDateTime('01/01/0001 00:00'), null);
  assert.equal(parseDateTime('1899-12-30'), null);
  assert.equal(parseDay('0001-01-01'), null);
});

test('shiftHours moves Typeform UTC to Brasília across midnight', () => {
  assert.equal(shiftHours('2026-10-14T01:30:00', -3), '2026-10-13T22:30:00');
  assert.equal(shiftHours(null, -3), null);
});

test('normName drops accents and punctuation', () => {
  assert.equal(normName('  José  da Silva-Jr. '), 'jose da silva jr');
});
