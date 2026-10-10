import type { Attendance, CaptureRow } from './types.ts';
import { normEmail, phoneKey } from './parse.ts';

export function buildAttendance(
  regs: { id: string; email: string }[],
  events: { registration_id: string | null; type: string; created_at: string }[],
  liveStartMs: number,
  pitchSeconds: number,
): Attendance[] {
  const pitchMs = liveStartMs + pitchSeconds * 1000;
  const entered = new Set<string>();
  const cta = new Set<string>();
  const beats = new Map<string, number>();
  const last = new Map<string, number>();
  for (const e of events) {
    const id = e.registration_id;
    if (!id) continue;
    const t = Date.parse(e.created_at);
    if (t > (last.get(id) ?? 0)) last.set(id, t);
    if (e.type === 'enter_live') entered.add(id);
    else if (e.type === 'cta_click') cta.add(id);
    else if (e.type === 'heartbeat') beats.set(id, (beats.get(id) ?? 0) + 1);
  }
  return regs.map(r => ({
    registrationId: r.id,
    email: normEmail(r.email),
    entered: entered.has(r.id),
    minutesWatched: beats.get(r.id) ?? 0,
    stayedToPitch: (last.get(r.id) ?? 0) >= pitchMs,
    clickedCta: cta.has(r.id),
  }));
}

export type BuyerMatch = {
  email: string; product: string; amount: number; matchedBy: 'email' | 'telefone' | null;
  registered: boolean; entered: boolean; minutesWatched: number; stayedToPitch: boolean; clickedCta: boolean;
};

export function matchBuyers(
  buyers: { email: string; phone: string; product: string; amount: number }[],
  attendance: Attendance[],
  captures: CaptureRow[],
): BuyerMatch[] {
  const byEmail = new Map(attendance.map(a => [a.email, a]));
  const emailByPhone = new Map<string, string>();
  for (const c of captures) {
    const k = phoneKey(c.phone);
    if (k && byEmail.has(normEmail(c.email))) emailByPhone.set(k, normEmail(c.email));
  }
  return buyers.map(b => {
    const email = normEmail(b.email);
    let a = byEmail.get(email);
    let matchedBy: BuyerMatch['matchedBy'] = a ? 'email' : null;
    if (!a) {
      const viaPhone = emailByPhone.get(phoneKey(b.phone));
      if (viaPhone) { a = byEmail.get(viaPhone); matchedBy = 'telefone'; }
    }
    return {
      email, product: b.product, amount: b.amount, matchedBy,
      registered: !!a, entered: a?.entered ?? false, minutesWatched: a?.minutesWatched ?? 0,
      stayedToPitch: a?.stayedToPitch ?? false, clickedCta: a?.clickedCta ?? false,
    };
  });
}
