import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { runSync } from '@/lib/marketing/sync';

export const maxDuration = 300;

// Cron diário da Vercel (Hobby permite 1×/dia).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ results: await runSync({ metaDays: 7 }) });
}

// Botão "Atualizar agora" e atualização automática ao abrir o painel.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const metaDays = Math.min(Math.max(Number(body?.metaDays) || 7, 1), 180);
  return NextResponse.json({ results: await runSync({ metaDays }) });
}
