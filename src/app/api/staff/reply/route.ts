import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth';
import { getCommentById, replyToComment } from '@/lib/db';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const staff = await verifyStaffToken(token);
  if (!staff) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const commentId = String(body?.commentId || '').trim();
  const reply = String(body?.reply || '').trim();

  if (!commentId || !reply || reply.length > 500) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  try {
    const comment = await getCommentById(commentId);
    if (!comment) return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });

    await replyToComment(commentId, reply, staff.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro ao responder comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
