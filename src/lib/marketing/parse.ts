export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function toRecords(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const out: Record<string, string>[] = [];
  for (const r of rows.slice(1)) {
    if (r.every(v => v.trim() === '')) continue;
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h && !(h in rec)) rec[h] = r[i] ?? '';
    });
    out.push(rec);
  }
  return out;
}

export function parseBRL(s: string): number {
  let t = (s ?? '').replace(/R\$/g, '').replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : 0;
}

const pad = (n: string | number) => String(n).padStart(2, '0');

export function parseDateTime(s: string): string | null {
  const t = (s ?? '').trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] ?? 0)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}`;
  return null;
}

export function parseDay(s: string): string | null {
  return parseDateTime(s)?.slice(0, 10) ?? null;
}

export function parseEditionNumber(s: string): number | null {
  const m = (s ?? '').match(/#?\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function normEmail(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

// ponytail: últimos 8 dígitos ignora DDI, DDD e o 9º dígito; colisão é rara dentro de uma edição.
export function phoneKey(s: string): string {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function inferLiveDate(dayMonth: string, today: string): string | null {
  const m = (dayMonth ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const year = Number(today.slice(0, 4));
  const t = Date.parse(`${today}T12:00:00Z`);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const y of [year - 1, year, year + 1]) {
    const cand = `${y}-${pad(m[2])}-${pad(m[1])}`;
    const dist = Math.abs(Date.parse(`${cand}T12:00:00Z`) - t);
    if (dist < bestDist) { bestDist = dist; best = cand; }
  }
  return best;
}
