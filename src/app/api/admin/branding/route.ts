import { NextRequest, NextResponse } from 'next/server';
import { supabase, getBrandingSettings, updateBrandingSettings } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';

const ICON_NAMES = [
  'Rocket', 'Zap', 'Tv', 'Video', 'Star', 'Radio', 'Sparkles', 'Flame',
  'Globe', 'Shield', 'Award', 'Target', 'Gem', 'Crown', 'Compass', 'Bolt',
];
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const settings = await getBrandingSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const type = form.get('type');

  if (type === 'letter') {
    const success = await updateBrandingSettings('letter', null);
    if (!success) {
      return NextResponse.json({ error: 'Falha ao salvar configuração' }, { status: 500 });
    }
    return NextResponse.json({ type: 'letter', value: null });
  }

  if (type === 'preset') {
    const value = form.get('value');
    if (typeof value !== 'string' || !ICON_NAMES.includes(value)) {
      return NextResponse.json({ error: 'Ícone inválido' }, { status: 400 });
    }
    const success = await updateBrandingSettings('preset', value);
    if (!success) {
      return NextResponse.json({ error: 'Falha ao salvar configuração' }, { status: 500 });
    }
    return NextResponse.json({ type: 'preset', value });
  }

  if (type === 'upload') {
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de imagem não suportado' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Imagem maior que 2MB' }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload('sidebar-icon', file, { upsert: true, contentType: file.type });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('branding').getPublicUrl('sidebar-icon');
    const value = `${urlData.publicUrl}?t=${Date.now()}`;
    const success = await updateBrandingSettings('upload', value);
    if (!success) {
      return NextResponse.json({ error: 'Falha ao salvar configuração' }, { status: 500 });
    }
    return NextResponse.json({ type: 'upload', value });
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
}
