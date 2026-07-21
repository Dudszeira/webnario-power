'use client';

import { AdminSidebar } from './AdminSidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

const BADGE: Record<string, { label: string }> = {
  ok:         { label: 'Público'  },
  restricted: { label: 'Restrito' },
  admin:      { label: 'Admin'    },
};

const ROUTES = [
  { path:'/espera',              label:'Sala de Espera',   status:'ok'         as const, description:'Cadastro, countdown e redirect automático.', note:'Acessível a qualquer hora.' },
  { path:'/ao-vivo',             label:'Sala Ao Vivo',     status:'restricted' as const, description:'Player + chat ao vivo + contador simulado.',  note:'Acessível só na terça 20h.' },
  { path:'/bloqueado',           label:'Acesso Bloqueado', status:'ok'         as const, description:'IP ou e-mail já usados nesta edição.',          note:'Aceita ?sales=URL.' },
  { path:'/',                    label:'Raiz (/)',          status:'ok'         as const, description:'Redireciona para /espera.',                     note:'Também: /imersao → /espera.' },
  { path:'/admin',               label:'Dashboard',        status:'admin'      as const, description:'Métricas, registros e exportação CSV.',         note:'Exige cookie admin_session.' },
  { path:'/admin/configuracoes', label:'Configurações',    status:'admin'      as const, description:'Vídeo, CTA, chat e viewer count.',             note:'Mudanças imediatas.' },
  { path:'/admin/importar',      label:'Importar Roteiro', status:'admin'      as const, description:'Upload .xlsx/.csv com comentários simulados.',  note:'Template disponível.' },
  { path:'/admin/comentarios',   label:'Moderação',        status:'admin'      as const, description:'Comentários reais, ocultar, fixar e staff.',    note:'Só comentários reais.' },
  { path:'/admin/live',          label:'Monitor Ao Vivo',  status:'admin'      as const, description:'Usuários online, entradas e cliques de CTA.',   note:'Auto-refresh a cada 30s.' },
];

function RouteCard({ route }: { route: typeof ROUTES[0] }) {
  const badge = BADGE[route.status];
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12.5px] font-semibold leading-tight text-foreground">{route.label}</p>
            <code className="text-[10.5px] text-primary">{route.path}</code>
          </div>
          <Badge variant="outline">{badge.label}</Badge>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">{route.description}</p>
        {route.note && (
          <p className="border-t border-border pt-2 text-[10.5px] italic text-muted-foreground/70">{route.note}</p>
        )}
        <a href={route.path} target="_blank" rel="noopener noreferrer"
          className="mt-auto flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
          Abrir <ExternalLink className="size-2.5" />
        </a>
      </CardContent>
    </Card>
  );
}

export default function AdminNavigation() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Navegação</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <p className="text-[12.5px] text-muted-foreground">Todas as páginas da plataforma — públicas e administrativas.</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {ROUTES.map(r => <RouteCard key={r.path} route={r} />)}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
