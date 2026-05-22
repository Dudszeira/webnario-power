// São Paulo is UTC-3 (no DST since 2019)
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const LIVE_HOUR_LOCAL = 20; // 20:00 BRT
const LIVE_HOUR_UTC = LIVE_HOUR_LOCAL + 3; // = 23 UTC

export function getNowBRT(now: Date = new Date()): Date {
  return new Date(now.getTime() + BRT_OFFSET_MS);
}

// Returns the edition ID = the live Tuesday's date (YYYY-MM-DD)
export function getCurrentEditionId(now: Date = new Date()): string {
  const local = getNowBRT(now);
  const dow = local.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, ..., 6=Sat
  // Days until next (or current) Tuesday
  const daysUntilTue = (2 - dow + 7) % 7;

  const tuesday = new Date(local);
  tuesday.setUTCDate(tuesday.getUTCDate() + daysUntilTue);

  const y = tuesday.getUTCFullYear();
  const m = String(tuesday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tuesday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Returns the UTC timestamp (ms) for live start (Tuesday 20:00 BRT = 23:00 UTC)
export function getLiveStartMs(editionId: string): number {
  const [y, m, d] = editionId.split('-').map(Number);
  return Date.UTC(y, m - 1, d, LIVE_HOUR_UTC, 0, 0);
}

export function getLiveEndMs(editionId: string, videoDurationSecs: number): number {
  return getLiveStartMs(editionId) + videoDurationSecs * 1000;
}

export function isLiveActive(editionId: string, videoDurationSecs: number, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= getLiveStartMs(editionId) && t <= getLiveEndMs(editionId, videoDurationSecs);
}

export function isLiveOver(editionId: string, videoDurationSecs: number, now: Date = new Date()): boolean {
  return now.getTime() > getLiveEndMs(editionId, videoDurationSecs);
}

// Seconds elapsed since live start (for sync)
export function getVideoOffset(editionId: string, now: Date = new Date()): number {
  const elapsed = now.getTime() - getLiveStartMs(editionId);
  return Math.max(0, Math.floor(elapsed / 1000));
}

// Format seconds → "HH:MM:SS"
export function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

// Next Tuesday 20:00 BRT as a Date object (in UTC)
export function getNextLiveDate(now: Date = new Date()): Date {
  return new Date(getLiveStartMs(getCurrentEditionId(now)));
}

export function getSimulatedNow(
  edition: { test_mode?: number; test_time?: string | null } | null,
  realNow: Date = new Date()
): Date {
  if (edition && edition.test_mode === 1 && edition.test_time) {
    return new Date(edition.test_time);
  }
  return realNow;
}
