import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { updateEditionFields } from '@/lib/db';
import { getCurrentEditionId } from '@/lib/edition';

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const editionId = getCurrentEditionId();

  const updateData: any = {};
  let hasUpdates = false;

  if (body?.chat_mode !== undefined) {
    updateData.chat_mode = body.chat_mode === 'isolated' ? 'isolated' : 'general';
    hasUpdates = true;
  }
  if (body?.cta_override !== undefined) {
    if (body.cta_override !== 'on' && body.cta_override !== 'off') {
      return NextResponse.json({ error: 'cta_override inválido' }, { status: 400 });
    }
    updateData.cta_override = body.cta_override;
    updateData.cta_override_at = new Date().toISOString();
    hasUpdates = true;
  }

  if (!hasUpdates) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  try {
    await updateEditionFields(editionId, updateData);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao atualizar configurações da edição:', error);
    return NextResponse.json({ error: 'Erro interno ao salvar configurações' }, { status: 500 });
  }
}
