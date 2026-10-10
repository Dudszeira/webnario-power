export function creativeFamily(raw: string, aliases: Record<string, string> = {}): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return '(sem utm)';
  if (aliases[key]) return aliases[key];
  const matches = key.match(/(img|vid)_\d+/g);
  return matches ? matches[matches.length - 1] : key;
}
