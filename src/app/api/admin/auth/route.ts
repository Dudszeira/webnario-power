import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = body?.password;

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const token = await createAdminSession();
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set('admin_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  });
  return resp;
}

export async function DELETE() {
  const resp = NextResponse.json({ ok: true });
  resp.cookies.delete('admin_session');
  return resp;
}
