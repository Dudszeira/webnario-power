import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { parseDisparoInput, type DisparoInput } from '@/lib/marketing/disparos';
import { deleteDisparo, insertDisparo, updateDisparo } from '@/lib/marketing/store';

export const dynamic = 'force-dynamic';

// A leitura dos disparos vem de /api/marketing/data?tab=disparos; aqui só escrita.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deny = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
// Erro do banco fica no log do servidor; o navegador recebe só uma mensagem genérica.
const fail = (what: string, e: unknown) => {
  console.error(`marketing disparos ${what}`, e);
  return NextResponse.json({ error: 'Falha ao salvar' }, { status: 500 });
};

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return deny();
  const parsed = parseDisparoInput(await req.json().catch(() => null), false);
  if (!parsed.ok) return bad(parsed.error);
  try { return NextResponse.json({ row: await insertDisparo(parsed.value as DisparoInput) }); } catch (e) { return fail('insert', e); }
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return deny();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('id inválido');
  const parsed = parseDisparoInput(await req.json().catch(() => null), true);
  if (!parsed.ok) return bad(parsed.error);
  if (!Object.keys(parsed.value).length) return bad('Nada para salvar');
  try { await updateDisparo(id, parsed.value); return NextResponse.json({ ok: true }); } catch (e) { return fail('update', e); }
}

// Remove só uma linha de mkt_disparos; nada mais é apagado.
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return deny();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('id inválido');
  try { await deleteDisparo(id); return NextResponse.json({ ok: true }); } catch (e) { return fail('delete', e); }
}
