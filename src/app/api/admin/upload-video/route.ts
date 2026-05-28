import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { writeFile, unlink, readdir } from 'fs/promises';
import path from 'path';

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'videos');
const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Formato não suportado. Use: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 });
  }

  // Delete all existing videos before saving the new one
  try {
    const existing = await readdir(VIDEOS_DIR);
    await Promise.all(
      existing
        .filter(f => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
        .map(f => unlink(path.join(VIDEOS_DIR, f)).catch(() => {}))
    );
  } catch { /* directory may be empty */ }

  const filename = `live${ext}`;
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(VIDEOS_DIR, filename), Buffer.from(bytes));

  return NextResponse.json({ ok: true, url: `/videos/${filename}` });
}
