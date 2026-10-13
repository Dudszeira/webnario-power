import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApplicationRow, CaptureRow } from './types.ts';
import { indexCaptures } from './editions.ts';
import { applicationOrigin, applicationOriginGroup, applicationsTab, buildApplications } from './applications.ts';

const row = (o: Partial<ApplicationRow>): ApplicationRow => ({
  email: '', phone: '', name: '', at: null, product: '', income: '', revenue: '', relation: '', interest: '', scheduled: false,
  utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', ...o,
});
const cap = (email: string, at: string, edition: number): CaptureRow => ({
  email, at, edition, phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: `c${edition}`, funnel: '',
});
const eds = [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }];

test('applicationOrigin labels', () => {
  assert.equal(applicationOrigin('plataforma', '', 'botao'), 'Botão da plataforma (ao vivo)');
  assert.equal(applicationOrigin('plataforma', '', 'comentarios'), 'Comentários (ao vivo)');
  assert.equal(applicationOrigin('whatsapp', 'grupo', '3'), 'Grupo WhatsApp · msg 3');
  assert.equal(applicationOrigin('whats', 'replay', '2'), 'Replay WhatsApp · msg 2');
  assert.equal(applicationOrigin('api', 'apiweb01', '1'), 'API apiweb01 · msg 1');
  assert.equal(applicationOrigin('', '', ''), '(sem utm)');
  assert.equal(applicationOriginGroup('whatsapp', 'replay'), 'Replay WhatsApp');
  assert.equal(applicationOriginGroup('plataforma', ''), 'Plataforma (ao vivo)');
});

test('buildApplications: dedupe by phone digits, latest complete wins, incomplete dropped when the person completed', () => {
  const apps = buildApplications([
    row({ phone: '(51) 99999-0001', email: 'a@x', at: '2026-10-13T21:00:00', product: 'Power', name: 'A' }),
    row({ phone: '+55 51 99999-0001', email: 'outro@x', at: '2026-10-13T22:00:00', product: 'Start', name: 'A' }),
    row({ phone: '51999990001', at: '2026-10-13T20:30:00', name: 'A' }),
    row({ email: 'b@x', at: '2026-10-13T23:00:00', name: 'B' }),
    row({ email: 'b@x', at: '2026-10-13T23:05:00', name: 'B' }),
  ], indexCaptures([]), eds);
  assert.equal(apps.length, 2);
  assert.deepEqual([apps[0].qualif, apps[0].repeats, apps[0].qualified], ['Start', 1, true]);
  assert.deepEqual([apps[1].complete, apps[1].name], [false, 'B']);
});

test('buildApplications: edition by e-mail capture up to the submission, else last live', () => {
  const idx = indexCaptures([cap('a@x', '2026-10-01T10:00:00', 21), cap('a@x', '2026-10-14T10:00:00', 22)]);
  const [a, b] = buildApplications([
    row({ email: 'a@x', at: '2026-10-13T22:30:00', product: 'Power' }),
    row({ email: 'z@x', at: '2026-10-13T22:30:00', product: 'Desafio' }),
  ], idx, eds);
  assert.deepEqual([a.edition, a.editionByEmail, a.creative], [21, true, 'c21']);
  assert.deepEqual([b.edition, b.editionByEmail, b.qualified], [22, false, false]);
});

test('applicationsTab counts per edition and only lists people with lists=1', () => {
  const apps = buildApplications([
    row({ email: 'a@x', at: '2026-10-13T21:00:00', product: 'Power', utmSource: 'plataforma', utmContent: 'botao', scheduled: true }),
    row({ email: 'b@x', at: '2026-10-13T21:10:00', product: 'Desafio', utmSource: 'plataforma', utmContent: 'botao' }),
    row({ email: 'c@x', at: '2026-10-13T21:20:00', name: 'C' }),
    row({ email: 'd@x', at: '2026-10-05T10:00:00', product: 'Start' }),
  ], indexCaptures([]), eds);
  const t = applicationsTab(apps, [22], null, false);
  assert.deepEqual([t.complete, t.qualified, t.power, t.desafio, t.incomplete, t.scheduled, t.noEdition], [2, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(t.originGroups, [{ key: 'Plataforma (ao vivo)', count: 2, qualified: 1 }]);
  assert.equal(t.byEdition[0].edition, 22);
  assert.equal(t.list, null);
  assert.equal(applicationsTab(apps, [22], null, true).list?.incomplete[0], 'C');
});
