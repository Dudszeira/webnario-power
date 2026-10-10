import { getAllRegistrations, getLiveEventsForEdition, getEdition } from '@/lib/db';
import { getLiveStartMs } from '@/lib/edition';
import { buildAttendance } from '../matching.ts';
import type { Attendance } from '../types.ts';

const DEFAULT_PITCH_SECONDS = 66 * 60 + 10; // 1:06:10, igual ao dash atual

export async function loadAttendance(liveDate: string): Promise<Attendance[]> {
  const [regs, events, edition] = await Promise.all([
    getAllRegistrations(liveDate),
    getLiveEventsForEdition(liveDate),
    getEdition(liveDate),
  ]);
  return buildAttendance(regs, events, getLiveStartMs(liveDate), edition?.pitch_marker_seconds ?? DEFAULT_PITCH_SECONDS);
}
