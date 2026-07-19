import { NextRequest, NextResponse } from 'next/server';
import { deleteEditionData } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  if (id === getCurrentEditionId()) {
    // Never delete the active edition's row — it holds the config the live session is using.
    return NextResponse.json({ error: 'Não é possível excluir a edição atual' }, { status: 400 });
  }
  try {
    await deleteEditionData(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir edição' }, { status: 500 });
  }
}
