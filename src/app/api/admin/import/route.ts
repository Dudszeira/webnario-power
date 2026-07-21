import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { clearSimulatedComments, insertCommentsBatch, getSimulatedComments } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

// RFC4180-aware CSV tokenizer: respects quoted fields, so commas/semicolons/tabs
// and even newlines inside a quoted value (e.g. "Boa Noite, cheguei") don't
// split or truncate the field. A naive text.split(',') would cut those in half.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += char; i++; continue;
    }
    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ',' || char === ';' || char === '\t') { row.push(field); field = ''; i++; continue; }
    if (char === '\r') { i++; continue; }
    if (char === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
    field += char; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normalizeType(t: string): string {
  const map: Record<string, string> = {
    usuario_simulado: 'simulated_user',
    usuario: 'simulated_user',
    user: 'simulated_user',
    simulated_user: 'simulated_user',
    staff_simulado: 'simulated_staff',
    staff: 'simulated_staff',
    host: 'simulated_staff',
    simulated_staff: 'simulated_staff',
    compra_simulada: 'simulated_purchase',
    compra: 'simulated_purchase',
    purchase: 'simulated_purchase',
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
    // Parse CSV — strip UTF-8 BOM if present
    const text = buffer.toString('utf-8').replace(/^﻿/, '');
    const parsedRows = parseCsv(text);
    if (parsedRows.length < 2) return NextResponse.json({ error: 'CSV vazio' }, { status: 400 });

    const headers = parsedRows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    for (let i = 1; i < parsedRows.length; i++) {
      const cells = parsedRows[i].map((c) => c.trim());
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

  const errors: string[] = [];
  const inserted: any[] = [];
  const commentsToInsert: any[] = [];

  const replace = formData.get('replace') === 'true';
  if (replace) {
    await clearSimulatedComments(editionId);
  }

  // Detect webinar export format (Hour, Minute, Second, Name, Role, Message)
  const isWebinarFormat = rows.length > 0 && ('hour' in rows[0] || 'minute' in rows[0]);

  rows.forEach((row, idx) => {
    const lineNum = idx + 2;

    let tipo: string;
    let nome: string;
    let texto: string;
    let tsRaw: any;

    if (isWebinarFormat) {
      // Map Role to type: Admin/Host/Panelist → staff, everything else → user
      const role = String(row.role || row.tipo || '').trim().toLowerCase();
      tipo = ['admin', 'host', 'panelist', 'moderator', 'staff'].includes(role)
        ? 'simulated_staff' : 'simulated_user';
      nome = String(row.name || row.nome || '').trim();
      texto = String(row.message || row.messages || row.texto || '').replace(/\s+/g, ' ').trim();
      const h = Number(row.hour || row.hora || 0);
      const m = Number(row.minute || row.minuto || 0);
      const s = Number(row.second || row.segundo || 0);
      tsRaw = h * 3600 + m * 60 + s;
    } else {
      const tipoRaw = row.tipo || row.type || row.categoria || row.category || '';
      tipo = normalizeType(tipoRaw);
      if (!tipo) {
        errors.push(`Linha ${lineNum}: tipo inválido "${tipoRaw}" (use: usuario_simulado, staff_simulado, compra_simulada)`);
        return;
      }
      nome = String(row.nome_exibido || row.nome || row.author_name || row.autor || row.name || '').trim();
      texto = String(row.texto || row.text || row.mensagem || row.message || row.comentario || '').replace(/\s+/g, ' ').trim();
      tsRaw = row.timestamp || row.minutagem || row.video_timestamp || row.tempo || row.minuto || 0;
    }

    if (!nome) { errors.push(`Linha ${lineNum}: nome vazio`); return; }
    if (!texto) { errors.push(`Linha ${lineNum}: texto vazio`); return; }

    const ts = isWebinarFormat ? tsRaw as number : parseTimestamp(tsRaw);
    if (ts === null) { errors.push(`Linha ${lineNum}: timestamp inválido`); return; }

    commentsToInsert.push({
      id: `c_${uuidv4()}`,
      edition_id: editionId,
      registration_id: null,
      type: tipo,
      author_name: nome,
      text: texto,
      video_timestamp: ts,
      is_pinned: 0,
      pin_start_seconds: null,
      pin_end_seconds: null,
      visible: 1,
      reply: null,
      reply_author: null
    });
    inserted.push({ line: lineNum, tipo, nome, ts });
  });

  if (commentsToInsert.length > 0) {
    try {
      await insertCommentsBatch(commentsToInsert);
    } catch (e: any) {
      errors.push(`Erro geral na inserção em lote: ${e.message}`);
    }
  }

  return NextResponse.json({ ok: true, inserted: inserted.length, errors });
}

// GET: List simulated comments for an edition
export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  const comments = await getSimulatedComments(editionId);
  return NextResponse.json({ comments });
}

// DELETE: Clear simulated comments
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  await clearSimulatedComments(editionId);
  return NextResponse.json({ ok: true });
}
