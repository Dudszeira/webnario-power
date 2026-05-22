import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

const VALID_TYPES = ['simulated_user', 'simulated_staff', 'simulated_purchase', 'usuario_simulado', 'staff_simulado', 'compra_simulada'];

function normalizeType(t: string): string {
  const map: Record<string, string> = {
    usuario_simulado: 'simulated_user',
    staff_simulado: 'simulated_staff',
    compra_simulada: 'simulated_purchase',
    simulated_user: 'simulated_user',
    simulated_staff: 'simulated_staff',
    simulated_purchase: 'simulated_purchase',
  };
  return map[t?.toLowerCase()?.trim()] || '';
}

function parseTimestamp(val: string | number): number | null {
  if (typeof val === 'number') return Math.floor(val);
  if (!val) return null;
  const str = String(val).trim();
  // "HH:MM:SS" or "MM:SS" or plain seconds
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const n = parseInt(str);
  return isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'No form data' }, { status: 400 });

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let rows: Record<string, any>[] = [];

  if (name.endsWith('.csv')) {
    // Parse CSV
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return NextResponse.json({ error: 'CSV vazio' }, { status: 400 });

    const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
      rows.push(row);
    }
  } else {
    // Parse XLSX
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
  }

  const db = getDb();
  const errors: string[] = [];
  const inserted: any[] = [];

  const replace = formData.get('replace') === 'true';
  if (replace) {
    db.prepare(
      `DELETE FROM comments WHERE edition_id = ? AND type IN ('simulated_user','simulated_staff','simulated_purchase')`
    ).run(editionId);
  }

  const insert = db.prepare(
    `INSERT INTO comments (id, edition_id, type, author_name, text, video_timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  rows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const tipo = normalizeType(row.tipo || row.type || '');
    if (!tipo) {
      errors.push(`Linha ${lineNum}: tipo inválido "${row.tipo || row.type}"`);
      return;
    }
    const nome = String(row.nome_exibido || row.nome || row.author_name || '').trim();
    if (!nome) { errors.push(`Linha ${lineNum}: nome_exibido vazio`); return; }

    const texto = String(row.texto || row.text || '').trim();
    if (!texto) { errors.push(`Linha ${lineNum}: texto vazio`); return; }

    const ts = parseTimestamp(row.timestamp || row.minutagem || row.video_timestamp || 0);
    if (ts === null) { errors.push(`Linha ${lineNum}: timestamp inválido`); return; }

    try {
      insert.run(`c_${uuidv4()}`, editionId, tipo, nome, texto, ts);
      inserted.push({ line: lineNum, tipo, nome, ts });
    } catch (e: any) {
      errors.push(`Linha ${lineNum}: ${e.message}`);
    }
  });

  return NextResponse.json({ ok: true, inserted: inserted.length, errors });
}

// GET: List simulated comments for an edition
export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const db = getDb();
  const comments = db
    .prepare(
      `SELECT * FROM comments WHERE edition_id = ? AND type IN ('simulated_user','simulated_staff','simulated_purchase') ORDER BY video_timestamp ASC`
    )
    .all(editionId);
  return NextResponse.json({ comments });
}

// DELETE: Clear simulated comments
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const db = getDb();
  db.prepare(
    `DELETE FROM comments WHERE edition_id = ? AND type IN ('simulated_user','simulated_staff','simulated_purchase')`
  ).run(editionId);
  return NextResponse.json({ ok: true });
}
