import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendance, matchBuyers } from './matching.ts';
import type { CaptureRow } from './types.ts';

const start = Date.UTC(2026, 9, 13, 23, 0, 0);
const at = (min: number) => new Date(start + min * 60000).toISOString();

test('buildAttendance counts heartbeats, entry, CTA and pitch', () => {
  const att = buildAttendance(
    [{ id: 'r1', email: 'A@x.com' }, { id: 'r2', email: 'b@x.com' }],
    [
      { registration_id: 'r1', type: 'enter_live', created_at: at(1) },
      { registration_id: 'r1', type: 'heartbeat', created_at: at(2) },
      { registration_id: 'r1', type: 'heartbeat', created_at: at(70) },
      { registration_id: 'r1', type: 'cta_click', created_at: at(71) },
      { registration_id: null, type: 'heartbeat', created_at: at(3) },
    ],
    start, 3970,
  );
  const r1 = att.find(a => a.registrationId === 'r1')!;
  assert.equal(r1.email, 'a@x.com');
  assert.equal(r1.entered, true);
  assert.equal(r1.minutesWatched, 2);
  assert.equal(r1.stayedToPitch, true);
  assert.equal(r1.clickedCta, true);
  const r2 = att.find(a => a.registrationId === 'r2')!;
  assert.equal(r2.entered, false);
  assert.equal(r2.stayedToPitch, false);
});

test('matchBuyers: email first, then phone via capture, else unmatched', () => {
  const attendance = [
    { registrationId: 'r1', email: 'a@x.com', entered: true, minutesWatched: 50, stayedToPitch: true, clickedCta: true },
    { registrationId: 'r2', email: 'cadastro@x.com', entered: true, minutesWatched: 10, stayedToPitch: false, clickedCta: false },
  ];
  const captures = [{ email: 'cadastro@x.com', phone: '(51) 99876-5432' } as CaptureRow];
  const m = matchBuyers([
    { email: 'A@x.com', phone: '', product: 'Power', amount: 1 },
    { email: 'outro@x.com', phone: '+55 51 99876-5432', product: 'Power', amount: 1 },
    { email: 'ninguem@x.com', phone: '', product: 'Power', amount: 1 },
  ], attendance, captures);
  assert.deepEqual(m.map(x => x.matchedBy), ['email', 'telefone', null]);
  assert.equal(m[1].minutesWatched, 10);
  assert.equal(m[2].registered, false);
  assert.equal(m[2].entered, false);
});
