import { NextRequest, NextResponse } from 'next/server';
import { deleteRegistration } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  try {
    await deleteRegistration(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir registro' }, { status: 500 });
  }
}
