import { NextRequest, NextResponse } from 'next/server';
import { getAdminComments } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';
import { getCurrentEditionId } from '@/lib/edition';

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const editionId = req.nextUrl.searchParams.get('edition') || getCurrentEditionId();
  
  try {
    const commentsDec = await getAdminComments(editionId);
    // Para exportação, queremos ordem cronológica crescente (do mais antigo ao mais novo)
    const comments = [...commentsDec].reverse();

    const TYPE_LABELS: Record<string, string> = {
      real_user:          'Usuário real',
      real_staff:         'Staff real',
      simulated_user:     'Sim. plateia',
      simulated_staff:    'Sim. staff',
      simulated_purchase: 'Compra sim.',
    };

    const header = 'id;edition_id;tipo;tipo_label;autor;texto;timestamp_video;fixado;visivel;criado_em';
    const rows = comments.map((c) => {
      const cols = [
        c.id,
        c.edition_id,
        c.type,
        TYPE_LABELS[c.type] || c.type,
        c.author_name,
        c.text,
        c.video_timestamp ?? '',
        c.is_pinned ? 'sim' : 'nao',
        c.visible ? 'sim' : 'nao',
        c.created_at,
      ];
      return cols.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';');
    });

    const csv = [header, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="comentarios-${editionId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Erro ao exportar comentários:', error);
    return NextResponse.json({ error: 'Erro interno ao exportar comentários' }, { status: 500 });
  }
}
