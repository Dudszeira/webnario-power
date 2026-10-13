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
  const header = rows[0].map(normHeader);
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

// Aceita "DD/MM/AAAA HH:MM[:SS]" (separador espaço, vírgula ou T) e ISO. Só anos 2021–2099:
// o "01/01/0001" do Typeform (sem data) e datas absurdas viram null.
export function parseDateTime(s: string): string | null {
  const t = (s ?? '').trim();
  const time = '(?:[\\s,T]+(\\d{1,2}):(\\d{1,2})(?::(\\d{1,2}))?)?';
  let m = t.match(new RegExp(`^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})${time}`));
  let out: string | null = null;
  if (m) out = `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] ?? 0)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
  else {
    m = t.match(new RegExp(`^(\\d{4})-(\\d{2})-(\\d{2})${time}`));
    if (m) out = `${m[1]}-${m[2]}-${m[3]}T${pad(m[4] ?? 0)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
  }
  if (!out) return null;
  const year = Number(out.slice(0, 4));
  return year >= 2021 && year <= 2099 ? out : null;
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

// Cabeçalho da planilha: a Visão Geral tem "Investimento Total \nAPI" e espaços duplos.
export function normHeader(h: string): string {
  return (h ?? '').replace(/\s+/g, ' ').trim();
}

// findCol do dash antigo: para cada agulha, em ordem, a 1ª coluna que a contém (sem caixa).
export function findCol(headers: string[], ...needles: string[]): string | null {
  const low = headers.map(h => (h ?? '').toLowerCase().trim());
  for (let n = 0; n < needles.length; n++) {
    const needle = needles[n].toLowerCase();
    for (let i = 0; i < low.length; i++) if (low[i].includes(needle)) return headers[i];
  }
  return null;
}

// Coluna que contém todas as agulhas.
export function findColAll(headers: string[], ...needles: string[]): string | null {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase();
    if (needles.every(n => h.includes(n.toLowerCase()))) return headers[i];
  }
  return null;
}

// 1ª coluna, na ordem da planilha, que contém qualquer agulha.
export function firstCol(headers: string[], ...needles: string[]): string | null {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase();
    if (needles.some(n => h.includes(n.toLowerCase()))) return headers[i];
  }
  return null;
}

// parseBR do dash antigo: tira R$, espaços e %, pontos de milhar ("16.788" = 16788), vírgula = decimal;
// vazio e erro de fórmula ("#DIV/0!") = 0.
export function parseBR(v: string): number {
  const s = String(v ?? '').trim();
  if (!s || s.startsWith('#')) return 0;
  const n = parseFloat(s.replace(/[R$\s%]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Igual ao parseBR, mas célula vazia ou erro de fórmula = null ("—" na tela).
export function parseBROrNull(v: string): number | null {
  const s = String(v ?? '').trim();
  return !s || s.startsWith('#') ? null : parseBR(s);
}

export function shiftHours(at: string | null, hours: number): string | null {
  if (!at) return null;
  const d = new Date(`${at}Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 19);
}

// Nome para casar pessoas entre abas: minúsculo, sem acento, só letras.
export function normName(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}
