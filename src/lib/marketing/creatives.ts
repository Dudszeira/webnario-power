export function creativeFamily(raw: string, aliases: Record<string, string> = {}): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return '(sem utm)';
  const matches = key.match(/(img|vid)_\d+/g);
  const derived = matches ? matches[matches.length - 1] : key;
  return aliases[key] ?? aliases[derived] ?? derived;
}
