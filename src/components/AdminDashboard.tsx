'use client';

import { useEffect, useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Play,
  MousePointerClick,
  MessageSquare,
  FileText,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react';

type Metrics = {
  registrations: number; consumed: number; enterLive: number;
  realComments: number; ctaClicks: number; simulatedComments: number;
};

type LiveStatus = 'waiting' | 'live' | 'over' | 'test';

const STATUS_CFG: Record<LiveStatus, { label: string; dot: string; color: string }> = {
  waiting: { label: 'Aguardando', dot: '#f59e0b', color: '#f59e0b' },
  live:    { label: 'Ao Vivo',    dot: '#00ff9d', color: '#00ff9d' },
  over:    { label: 'Encerrada',  dot: '#6a9ab8', color: '#6a9ab8' },
  test:    { label: 'Teste',      dot: '#a78bfa', color: '#a78bfa' },
};

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: number | string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">{label}</CardDescription>
        <CardTitle className="text-[28px] font-bold leading-none tracking-tight text-primary">{value}</CardTitle>
        <CardAction>
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </div>
        </CardAction>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentRegs, setRecentRegs] = useState<any[]>([]);
  const [allEditions, setAllEditions] = useState<any[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEditionFilter, setSelectedEditionFilter] = useState<string>('');
  const [filteredRegs, setFilteredRegs] = useState<any[]>([]);
  const [filteredEditionLoading, setFilteredEditionLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setData(d);
        setRecentRegs(d.recentRegs || []);
        setFilteredRegs(d.recentRegs || []);
        setAllEditions(d.allEditions || []);
        setSelectedEditionFilter(d.currentEdition || '');
      })
      .catch(() => {/* errors: loading stops, data stays null */})
      .finally(() => setLoading(false));
  }, []);

  async function changeEditionFilter(editionId: string) {
    setSelectedEditionFilter(editionId);
    if (editionId === data?.currentEdition) {
      setFilteredRegs(recentRegs);
      return;
    }
    setFilteredEditionLoading(true);
    try {
      const res = await fetch(`/api/admin/metrics?edition=${encodeURIComponent(editionId)}`);
      const d = await res.json();
      setFilteredRegs(d.recentRegs || []);
    } catch { setFilteredRegs([]); }
    setFilteredEditionLoading(false);
  }

  async function deleteReg(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setRecentRegs(prev => prev.filter(r => r.id !== id));
        setFilteredRegs(prev => prev.filter(r => r.id !== id));
      }
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function deleteEdition(editionId: string) {
    setDeletingId(editionId);
    try {
      const res = await fetch(`/api/admin/editions?id=${encodeURIComponent(editionId)}`, { method: 'DELETE' });
      if (res.ok) setAllEditions(prev => prev.filter(e => e.editionId !== editionId));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  if (loading) return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-7 animate-spin text-primary" />
            <span className="text-[13px] text-muted-foreground">Carregando...</span>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  const m: Metrics = data?.currentMetrics || {};
  const liveStatus: LiveStatus = data?.liveStatus || 'waiting';
  const sc = STATUS_CFG[liveStatus];
  const cfg = data?.editionConfig || {};
  const liveDate = data?.liveStartMs
    ? new Date(data.liveStartMs).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Dashboard</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
          {/* Header info row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-[12.5px] text-muted-foreground">
              Edição{' '}
              <code className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                {data?.currentEdition ?? '—'}
              </code>
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              {liveDate}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5" style={{ background: `${sc.color}14` }}>
                <span className={liveStatus === 'live' ? 'pulse-live inline-block size-1.5 rounded-full' : 'inline-block size-1.5 rounded-full'} style={{ background: sc.dot }} />
                <span className="text-[11px] font-bold" style={{ color: sc.color }}>{sc.label}</span>
              </div>
              <Button variant="outline" size="sm" render={<a href={data?.currentEdition ? `/api/admin/export?edition=${data.currentEdition}` : '#'} />}>
                <Download className="size-3.5" /> CSV
              </Button>
            </div>
          </div>

          {/* Config summary */}
          <Card>
            <CardContent>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configuração da edição</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Vídeo', value: cfg.video_source === 'youtube' ? 'YouTube' : 'Upload', sub: cfg.video_url || '—' },
                  { label: 'Duração', value: cfg.video_duration ? `${Math.floor(cfg.video_duration/3600)}h ${Math.floor((cfg.video_duration%3600)/60)}min` : '—', sub: '' },
                  { label: 'Chat', value: cfg.chat_enabled ? 'Habilitado' : 'Desabilitado', muted: !cfg.chat_enabled, sub: cfg.chat_mode === 'isolated' ? 'Isolado' : 'Geral' },
                  { label: 'CTA', value: cfg.cta_auto_enabled
                      ? 'Automático'
                      : cfg.cta_override === 'on' ? 'Forçado ligado'
                      : cfg.cta_override === 'off' ? 'Forçado desligado'
                      : 'Manual (staff)',
                    muted: !cfg.cta_auto_enabled && cfg.cta_override !== 'on',
                    sub: cfg.cta_url || '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="mb-0.5 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">{item.label}</p>
                    <p className={`text-[13px] font-semibold ${(item as any).muted ? 'text-muted-foreground' : 'text-foreground'}`}>{item.value}</p>
                    {item.sub && <p className="truncate text-[10.5px] text-muted-foreground/70">{item.sub}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <StatCard label="Cadastros" value={m.registrations||0} icon={Users} />
            <StatCard label="Ao vivo" value={m.enterLive||0} sub={`${m.consumed||0} consumidos`} icon={Play} />
            <StatCard label="Cliques CTA" value={m.ctaClicks||0} sub="conversões" icon={MousePointerClick} />
            <StatCard label="Comentários" value={m.realComments||0} sub="reais" icon={MessageSquare} />
            <StatCard label="Simulados" value={m.simulatedComments||0} sub="importados" icon={FileText} />
          </div>

          {/* Recent registrations */}
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[18px] py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[3px] text-muted-foreground">Histórico de acessos</h2>
                {filteredRegs.length > 0 && (
                  <Badge variant="secondary">{filteredRegs.length}</Badge>
                )}
                {filteredEditionLoading && <Loader2 className="size-3.5 animate-spin text-primary" />}
              </div>
              {allEditions.length > 0 && (
                <Select value={selectedEditionFilter} onValueChange={(v) => v && changeEditionFilter(v)}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allEditions.map((e: any) => (
                      <SelectItem key={e.editionId} value={e.editionId}>{e.editionId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Acessou live</TableHead>
                  <TableHead>Data cadastro</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegs.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><code className="text-[11.5px] text-muted-foreground">{r.email}</code></TableCell>
                    <TableCell><code className="text-[11.5px] text-muted-foreground">{r.ip}</code></TableCell>
                    <TableCell>
                      {r.consumed
                        ? <Badge variant="secondary">Sim</Badge>
                        : <span className="text-[10.5px] text-muted-foreground/70">Não</span>}
                    </TableCell>
                    <TableCell className="text-[11.5px] text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      {confirmId === r.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10.5px] font-semibold text-destructive">Apagar?</span>
                          <Button variant="destructive" size="sm" className="h-6 px-2 text-[10.5px]" disabled={deletingId === r.id} onClick={() => deleteReg(r.id)}>
                            {deletingId === r.id ? '...' : 'Sim'}
                          </Button>
                          <Button variant="secondary" size="sm" className="h-6 px-2 text-[10.5px]" onClick={() => setConfirmId(null)}>Não</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" title="Excluir registro" onClick={() => setConfirmId(r.id)}>
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredRegs.length && (
                  <TableRow><TableCell colSpan={6} className="py-6 text-center italic text-muted-foreground/70">Nenhum registro ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* All editions */}
          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b border-border px-[18px] py-3">
              <h2 className="text-[11px] font-bold uppercase tracking-[3px] text-muted-foreground">Histórico perpétuo</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Edição</TableHead>
                  <TableHead>Cadastros</TableHead>
                  <TableHead>Ao vivo</TableHead>
                  <TableHead>Consumidos</TableHead>
                  <TableHead>Cliques CTA</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEditions.map((e: any) => (
                  <TableRow key={e.editionId}>
                    <TableCell><code className="text-xs text-primary">{e.editionId}</code></TableCell>
                    <TableCell>{e.registrations}</TableCell>
                    <TableCell>{e.enterLive}</TableCell>
                    <TableCell>{e.consumed}</TableCell>
                    <TableCell>{e.ctaClicks}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="h-6 gap-1 border-emerald-500/20 bg-emerald-500/10 px-2 text-[11px] text-emerald-400 hover:bg-emerald-500/20" render={<a href={`/api/admin/export-comments?edition=${e.editionId}`} />}>
                          <Download className="size-2.5" /> Chat
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 gap-1 border-sky-500/20 bg-sky-500/10 px-2 text-[11px] text-sky-400 hover:bg-sky-500/20" render={<a href={`/api/admin/export?edition=${e.editionId}`} />}>
                          <Download className="size-2.5" /> Dados
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {confirmId === e.editionId ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-[10.5px] font-semibold text-destructive">Apagar tudo?</span>
                          <Button variant="destructive" size="sm" className="h-6 px-2 text-[10.5px]" disabled={deletingId === e.editionId} onClick={() => deleteEdition(e.editionId)}>
                            {deletingId === e.editionId ? '...' : 'Sim'}
                          </Button>
                          <Button variant="secondary" size="sm" className="h-6 px-2 text-[10.5px]" onClick={() => setConfirmId(null)}>Não</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" title="Excluir edição completa" onClick={() => setConfirmId(e.editionId)}>
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!allEditions.length && (
                  <TableRow><TableCell colSpan={7} className="py-6 text-center italic text-muted-foreground/70">Sem histórico</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
