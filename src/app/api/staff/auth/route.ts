import { NextRequest, NextResponse } from 'next/server';
import { createStaffToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const password = String(body?.password || '');

  if (!name || !password) {
    return NextResponse.json({ error: 'Nome e senha obrigatórios' }, { status: 400 });
  }

  const staffPassword = process.env.STAFF_PASSWORD || 'staff123';
  if (password !== staffPassword) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const token = await createStaffToken(name);
  return NextResponse.json({ ok: true, token });
}
