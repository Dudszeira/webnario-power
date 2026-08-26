'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
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
import { Area, ComposedChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { RefreshCw, Download, Radio, Play, ShoppingCart, Timer, Loader2, Check } from 'lucide-react';

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
type Bucket = { minute: number; count: number; ctaClicks: number };
type SortKey = keyof UserRow;

const chartConfig = {
  // --chart-1/2 store bare oklch() components (no wrapper) — Tailwind's `bg-chart-1`
  // utility wraps it automatically, but a raw var() here needs the wrap ourselves.
  count: { label: 'Espectadores', color: 'oklch(var(--chart-1))' },
  // Amber matches the "Sim" badge already used for CTA clicks in the users table below.
  ctaClicks: { label: 'Cliques no CTA', color: '#f59e0b' },
} satisfies ChartConfig;

// Formats minutes-since-live-start as a clock-like label ("1h05", "45min") instead
// of a raw minute count, so it reads against a known moment (e.g. "o pitch foi às
// 1:06:10") instead of needing mental math from "66min".
function fmtMinuteLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
  return `${m}min`;
}

// The chart's underlying buckets are still 5 minutes wide — the tooltip spells out
// the window so it's clear a hover is the closest bucket, not an exact instant.
function fmtBucketRange(minute: number): string {
  return `${fmtMinuteLabel(minute)}–${fmtMinuteLabel(minute + 5)} de live`;
}

// "1:06:10", "66:10" or a bare "3970" all parse to seconds. Returns null on anything
// that isn't a valid time so the caller can reject bad input instead of saving garbage.
function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  return nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
}

// Seconds → "H:MM:SS" (or "M:SS" under an hour), for prefilling the pitch input.
function fmtHms(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${h > 0 ? String(m).padStart(2, '0') : m}:${String(sec).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

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

  // Manual "Pitch" marker for the chart — independent from the real CTA config.
  const [pitchMarkerSeconds, setPitchMarkerSeconds] = useState<number | null>(null);
  const [ctaStartSeconds, setCtaStartSeconds] = useState(0);
  const [pitchInput, setPitchInput] = useState('');
  const [pitchError, setPitchError] = useState(false);
  const [savingPitch, setSavingPitch] = useState(false);
  const [pitchSaved, setPitchSaved] = useState(false);
  // Only prefill the input once per edition — otherwise the 30s auto-refresh would
  // stomp on whatever the admin is mid-typing.
  const pitchInitializedFor = useRef<string>('');

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
      setPitchMarkerSeconds(d.pitchMarkerSeconds ?? null);
      setCtaStartSeconds(d.ctaStartSeconds ?? 0);
      const editionKey = editionId || 'current';
      if (pitchInitializedFor.current !== editionKey) {
        setPitchInput(fmtHms(d.pitchMarkerSeconds ?? d.ctaStartSeconds ?? 0));
        setPitchError(false);
        pitchInitializedFor.current = editionKey;
      }
      setUpdatedAt(new Date());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  async function savePitchMarker() {
    const parsed = parseTimeToSeconds(pitchInput);
    if (parsed === null) { setPitchError(true); return; }
    setPitchError(false);
    setSavingPitch(true);
    try {
      const qs = selectedEdition ? `?edition=${encodeURIComponent(selectedEdition)}` : '';
      const res = await fetch(`/api/admin/config${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch_marker_seconds: parsed }),
      });
      if (res.ok) {
        setPitchMarkerSeconds(parsed);
        setPitchSaved(true);
        setTimeout(() => setPitchSaved(false), 2000);
      }
    } catch {} finally {
      setSavingPitch(false);
    }
  }

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

  // Denser, explicit ticks instead of recharts' default ~5 auto-ticks — makes it
  // possible to actually locate a known moment (e.g. "o pitch foi 1:06:10") on the axis.
  const maxMinute = timeline.length ? timeline[timeline.length - 1].minute : 0;
  const tickStep = maxMinute > 60 ? 15 : 10;
  const xTicks = Array.from({ length: Math.floor(maxMinute / tickStep) + 1 }, (_, i) => i * tickStep);
  const pitchMinute = pitchMarkerSeconds !== null ? pitchMarkerSeconds / 60 : null;

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
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold">Audiência ao longo da live</p>
                  <p className="text-[11px] text-muted-foreground">Espectadores simultâneos e cliques no CTA, a cada 5min de live</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Marcador do pitch</span>
                  <Input
                    value={pitchInput}
                    onChange={(e) => { setPitchInput(e.target.value); setPitchError(false); }}
                    placeholder="h:mm:ss"
                    className={`h-7 w-24 text-xs ${pitchError ? 'border-destructive' : ''}`}
                  />
                  <Button variant="outline" size="sm" className="h-7" disabled={savingPitch} onClick={savePitchMarker}>
                    {savingPitch ? <Loader2 className="size-3 animate-spin" /> : pitchSaved ? <Check className="size-3" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
              {timeline.length < 2 ? (
                <div className="flex h-[220px] items-center justify-center">
                  <span className="text-xs text-muted-foreground">Aguardando audiência...</span>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
                  <ComposedChart data={timeline}>
                    <defs>
                      <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                    <XAxis
                      dataKey="minute"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      ticks={xTicks}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={fmtMinuteLabel}
                    />
                    <YAxis yAxisId="viewers" tickLine={false} axisLine={false} tickMargin={8} width={28} allowDecimals={false} />
                    <YAxis yAxisId="clicks" orientation="right" tickLine={false} axisLine={false} tickMargin={8} width={28} allowDecimals={false} />
                    {pitchMinute !== null && (
                      <ReferenceLine
                        x={pitchMinute}
                        yAxisId="viewers"
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'Pitch', position: 'insideTopRight', fontSize: 10, fill: 'var(--muted-foreground)' }}
                      />
                    )}
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          // ChartTooltipContent's own `label` arg isn't reliable for a numeric
                          // x-axis (it falls back to the series name, e.g. "Espectadores", giving
                          // "NaNmin–NaNmin"). Read the real minute straight off the hovered point.
                          labelFormatter={(_, payload) => fmtBucketRange((payload?.[0]?.payload as Bucket | undefined)?.minute ?? 0)}
                          indicator="dot"
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {/* Area drawn first so its fill sits behind the CTA-clicks line, not on top of it */}
                    <Area yAxisId="viewers" dataKey="count" type="natural" fill="url(#fillCount)" stroke="var(--color-count)" strokeWidth={2} />
                    <Line yAxisId="clicks" dataKey="ctaClicks" type="monotone" stroke="var(--color-ctaClicks)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ChartContainer>
              )}
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
