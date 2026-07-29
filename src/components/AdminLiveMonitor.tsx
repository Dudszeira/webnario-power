'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { RefreshCw, Download, Radio, Play, ShoppingCart, Timer, Loader2 } from 'lucide-react';

type UserRow = {
  id: string;
  name: string;
  email: string;
  enteredAt: string | null;
  watchSeconds: number;
  ctaClicked: boolean;
  commented: boolean;
  commentCount: number;
  lastSeenAt: string | null;
  online: boolean;
};

type Summary = { online: number; totalEntered: number; ctaClicks: number; avgWatchSeconds: number };
type Bucket = { bucket: string; count: number };
type SortKey = keyof UserRow;

function fmtDuration(secs: number): string {
  if (secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function downloadCSV(users: UserRow[], editionId: string) {
  const header = 'Nome,Email,Entrou,Tempo assistido,Clicou CTA,Comentou,Comentários,Visto por último';
  const rows = users.map(u => [
    `"${u.name.replace(/"/g, '""')}"`,
    `"${u.email.replace(/"/g, '""')}"`,
    u.enteredAt ? new Date(u.enteredAt).toLocaleString('pt-BR') : '',
    fmtDuration(u.watchSeconds),
    u.ctaClicked ? 'Sim' : 'Não',
    u.commented ? 'Sim' : 'Não',
    u.commentCount,
    u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('pt-BR') : '',
  ].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `live-${editionId || new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

// SVG line chart — kept as a hand-rolled chart (not recharts) to preserve the
// exact behavior of the original; only the color literals changed.
function LineChart({ data }: { data: Bucket[] }) {
  if (data.length < 2) return (
    <div className="flex h-[100px] items-center justify-center">
      <span className="text-xs text-muted-foreground">Aguardando audiência...</span>
    </div>
  );
  const W = 600, H = 110;
  const PAD = { t: 8, r: 16, b: 22, l: 28 };
  const GRID = 'rgba(255,255,255,0.1)';
  const TEXT = '#8a8a8a';
  const LINE = '#e5e5e5';
  const AREA = 'rgba(229,229,229,0.12)';
  const maxY = Math.max(...data.map(d => d.count), 1);
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r),
    y: H - PAD.b - (d.count / maxY) * (H - PAD.t - PAD.b),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H - PAD.b} L${pts[0].x},${H - PAD.b} Z`;
  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        {[0, 0.5, 1].map((v, i) => {
          const y = PAD.t + (1 - v) * (H - PAD.t - PAD.b);
          return (
            <g key={i}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={PAD.l - 4} y={y + 4} fontSize={8} fill={TEXT} textAnchor="end">{Math.round(v * maxY)}</text>
            </g>
          );
        })}
        <path d={areaPath} fill={AREA} />
        <path d={linePath} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={LINE} />)}
        {data.map((d, i) => {
          if (data.length > 10 && i % Math.ceil(data.length / 8) !== 0) return null;
          return <text key={i} x={pts[i].x} y={H - PAD.b + 14} fontSize={8} fill={TEXT} textAnchor="middle">{d.bucket}</text>;
        })}
      </svg>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: number | string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">{label}</CardDescription>
        <CardTitle className="text-2xl font-bold leading-none tracking-tight text-primary">{value}</CardTitle>
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

export default function AdminLiveMonitor() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [timeline, setTimeline] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('online');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [allEditions, setAllEditions] = useState<{ editionId: string }[]>([]);
  const [currentEdition, setCurrentEdition] = useState<string>('');
  const [selectedEdition, setSelectedEdition] = useState<string>('');

  const fetchData = useCallback(async (editionId?: string) => {
    try {
      const qs = editionId ? `?edition=${encodeURIComponent(editionId)}` : '';
      const res = await fetch(`/api/admin/live-metrics${qs}`);
      if (res.status === 401) { window.location.replace('/admin/login'); return; }
      if (!res.ok) return;
      const d = await res.json();
      setSummary(d.summary);
      setUsers(d.users);
      setTimeline(d.timeline);
      setUpdatedAt(new Date());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // Edition list for the "which live" filter — reuses the same endpoint the dashboard uses.
  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setAllEditions(d.allEditions || []);
        setCurrentEdition(d.currentEdition || '');
        setSelectedEdition(d.currentEdition || '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedEdition) return;
    fetchData(selectedEdition);
    // Only auto-refresh while watching the current live — a past edition's data is static.
    if (selectedEdition !== currentEdition) return;
    const t = setInterval(() => fetchData(selectedEdition), 30000);
    return () => clearInterval(t);
  }, [fetchData, selectedEdition, currentEdition]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sorted = [...users].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    const mul = sortDir === 'asc' ? 1 : -1;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'boolean') return (va === vb ? 0 : va ? -1 : 1) * mul;
    if (typeof va === 'number') return ((va as number) - (vb as number)) * mul;
    return (String(va) > String(vb) ? 1 : -1) * mul;
  });

  const S = summary;

  if (loading) return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const sortableHead = (key: SortKey, label: string) => (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${sortKey === key ? 'text-foreground' : ''}`}
      onClick={() => toggleSort(key)}
    >
      {label}{arrow(key)}
    </TableHead>
  );

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Monitor Ao Vivo</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedEdition === currentEdition
                ? (updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR')} · Auto-refresh a cada 30s` : 'Auto-refresh a cada 30s')
                : 'Edição encerrada — dados estáticos'}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {allEditions.length > 0 && (
                <Select value={selectedEdition} onValueChange={(v) => v && setSelectedEdition(v)}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allEditions.map((e) => (
                      <SelectItem key={e.editionId} value={e.editionId}>{e.editionId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={() => fetchData(selectedEdition)}>
                <RefreshCw className="size-3.5" /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadCSV(users, selectedEdition)}>
                <Download className="size-3.5" /> Exportar CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard label="Online agora" value={S?.online ?? 0} sub="últimos 3 min" icon={Radio} />
            <StatCard label="Entraram ao vivo" value={S?.totalEntered ?? 0} sub="total" icon={Play} />
            <StatCard label="Clicaram no CTA" value={S?.ctaClicks ?? 0} sub="conversões" icon={ShoppingCart} />
            <StatCard label="Tempo médio" value={fmtDuration(S?.avgWatchSeconds ?? 0)} sub="por usuário" icon={Timer} />
          </div>

          <Card>
            <CardContent>
              <p className="mb-3 text-xs font-semibold">Audiência ativa ao longo do tempo</p>
              <LineChart data={timeline} />
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center gap-2 border-b border-border px-[18px] py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Usuários na live</p>
              {users.length > 0 && <Badge variant="secondary">{users.length}</Badge>}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  {sortableHead('watchSeconds', 'Tempo')}
                  {sortableHead('ctaClicked', 'CTA')}
                  {sortableHead('commentCount', 'Chat')}
                  {sortableHead('online', 'Status')}
                  {sortableHead('lastSeenAt', 'Último acesso')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="max-w-[160px] truncate font-medium">{u.name}</TableCell>
                    <TableCell><code className="text-[11px] text-muted-foreground">{u.email}</code></TableCell>
                    <TableCell className="text-muted-foreground">{fmtDuration(u.watchSeconds)}</TableCell>
                    <TableCell>
                      {u.ctaClicked
                        ? <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">Sim</Badge>
                        : <span className="text-[10px] text-muted-foreground/70">—</span>}
                    </TableCell>
                    <TableCell className={u.commentCount > 0 ? 'font-semibold text-emerald-400' : 'text-muted-foreground/70'}>
                      {u.commentCount > 0 ? u.commentCount : '—'}
                    </TableCell>
                    <TableCell>
                      {u.online ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                          <span className="pulse-live inline-block size-1.5 shrink-0 rounded-full bg-emerald-400" />
                          Online
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/70">Offline</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground/70">{fmtTime(u.lastSeenAt)}</TableCell>
                  </TableRow>
                ))}
                {!sorted.length && (
                  <TableRow><TableCell colSpan={7} className="py-6 text-center italic text-muted-foreground/70">Nenhum usuário na live ainda</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
