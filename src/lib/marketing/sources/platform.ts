import { supabase, getLiveEventsForEdition, getEdition } from '@/lib/db';
import { getLiveStartMs } from '@/lib/edition';
import { buildAttendance } from '../matching.ts';
import type { Attendance } from '../types.ts';

const DEFAULT_PITCH_SECONDS = 66 * 60 + 10; // 1:06:10, igual ao dash atual

// getAllRegistrations (db.ts) para em 1000 linhas (limite do Supabase): paginamos aqui, só leitura.
async function loadRegistrations(liveDate: string): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('registrations').select('id, email')
      .eq('edition_id', liveDate).order('id').range(start, start + 999);
    if (error) throw new Error(`registrations: ${error.message}`);
    (data ?? []).forEach(r => out.push(r));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadAttendance(liveDate: string): Promise<Attendance[]> {
  const [regs, events, edition] = await Promise.all([
    loadRegistrations(liveDate),
    getLiveEventsForEdition(liveDate),
    getEdition(liveDate),
  ]);
  return buildAttendance(regs, events, getLiveStartMs(liveDate), edition?.pitch_marker_seconds ?? DEFAULT_PITCH_SECONDS);
}
