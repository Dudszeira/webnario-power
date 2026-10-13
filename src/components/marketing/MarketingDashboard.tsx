'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addDays } from '@/lib/marketing/parse';
import type { MarketingView } from '@/lib/marketing/view';
import EditionTab from './EditionTab';
import CreativesTab from './CreativesTab';
import ValidationTab from './ValidationTab';
import SurveyTab from './SurveyTab';
import ApplicationsTab from './ApplicationsTab';
import LiveTab from './LiveTab';
import DealsTab from './DealsTab';
import SalesTab from './SalesTab';
import BuyersTab from './BuyersTab';
import ApiTab from './ApiTab';
import DisparosTab from './DisparosTab';

type Range = { from: string; to: string };
const NO_RANGE: Range = { from: '', to: '' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const todayBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const ed = (n: number) => `#${String(n).padStart(3, '0')}`;
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Abas em dois níveis (tudo dentro de /admin/marketing, sem itens novos no menu).
const GROUPS: { key: string; label: string; tabs: { key: string; label: string }[] }[] = [
  { key: 'resultado', label: 'Resultado', tabs: [{ key: 'edicao', label: 'Edição' }, { key: 'criativos', label: 'Criativos' }, { key: 'validacao', label: 'Validação' }] },
  { key: 'leads', label: 'Leads', tabs: [{ key: 'pesquisa', label: 'Pesquisa' }, { key: 'aplicacoes', label: 'Aplicações' }, { key: 'aovivo', label: 'Ao vivo' }] },
  { key: 'comercial', label: 'Comercial', tabs: [{ key: 'agendamentos', label: 'Agendamentos' }, { key: 'vendas', label: 'Vendas' }, { key: 'compradores', label: 'Compradores' }] },
  { key: 'canais', label: 'Canais', tabs: [{ key: 'api', label: 'API' }, { key: 'disparos', label: 'Disparos' }] },
];

// label: telas largas · short: notebook · mini: celular
function quickRanges(): { key: string; label: string; short: string; mini: string; range: Range }[] {
  const y = addDays(todayBRT(), -1);
  return [
    { key: 'ontem', label: 'Ontem', short: 'Ontem', mini: 'Ontem', range: { from: y, to: y } },
    { key: '7d', label: 'Últimos 7 dias', short: '7 dias', mini: '7d', range: { from: addDays(y, -6), to: y } },
    { key: 'tudo', label: 'Edição inteira', short: 'Edição inteira', mini: 'Tudo', range: NO_RANGE },
  ];
}

function ago(iso: string | null, now: number): string {
  if (!iso) return 'nunca atualizado';
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!(min >= 1)) return 'atualizado agora';
  if (min < 60) return `atualizado há ${min} min`;
  if (min < 24 * 60) return `atualizado há ${Math.floor(min / 60)} h`;
  return `atualizado em ${new Date(iso).toLocaleDateString('pt-BR')}`;
}

type Source = MarketingView['sources'][number];
const warn = (s: Source) =>
  toast.warning(`Fonte indisponível — ${s.source}`, { id: `${s.source}|${s.message}`, description: s.message, duration: 12_000 });

export default function MarketingDashboard() {
  const [view, setView] = useState<MarketingView | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [range, setRange] = useState<Range>(NO_RANGE);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState(''); // filtros da última carga + versão: as abas refazem a busca quando muda
  const [group, setGroup] = useState('resultado');
  const [tab, setTab] = useState('edicao');
  const seq = useRef(0);
  const warned = useRef<Record<string, true>>({});

  const load = useCallback(async (eds: number[], r: Range) => {
    const id = ++seq.current; // só a última requisição vale: troca rápida de edição não volta atrás
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (eds.length) q.set('editions', eds.join(','));
      if (r.from && r.to) { q.set('from', r.from); q.set('to', r.to); }
      const res = await fetch(`/api/marketing/data?${q}`);
      const body = await res.json();
      if (id !== seq.current) return null;
      if (!res.ok) { toast.error(body.error ?? 'Erro ao carregar'); return null; }
      setView(body); setSelected(body.selected);
      setQuery(`${q.toString()}&v=${id}`);
      return body as MarketingView;
    } catch {
      if (id === seq.current) toast.error('Não foi possível carregar os dados');
      return null;
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/marketing/sync', { method: 'POST', body: JSON.stringify({ metaDays: 7 }) });
      if (!res.ok) toast.error('Não foi possível atualizar');
    } catch {
      toast.error('Não foi possível atualizar');
    } finally {
      setSyncing(false);
    }
    await load(selected, range);
  }, [load, selected, range]);

  useEffect(() => {
    load([], NO_RANGE).then(v => { if (v?.stale) sync(); });
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failing = view ? view.sources.filter(s => !s.ok) : [];
  // Um toast por fonte com problema; a mesma mensagem não reaparece a cada recarga.
  useEffect(() => {
    failing.forEach(s => {
      const k = `${s.source}|${s.message}`;
      if (!warned.current[k]) { warned.current[k] = true; warn(s); }
    });
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastSync = view ? view.sources.reduce<string | null>((m, s) => (!m || s.finished_at > m ? s.finished_at : m), null) : null;

  const toggle = (n: number) => {
    const next = selected.indexOf(n) >= 0 ? selected.filter(x => x !== n) : selected.concat(n).sort((a, b) => a - b);
    if (!next.length) return; // sempre ao menos uma edição
    const prev = selected;
    setSelected(next);
    const p = load(next, range);
    const id = seq.current; // load() já incrementou: esta é a requisição desta troca
    // Falhou (e não foi superada por outra troca): volta a seleção para bater com os dados na tela.
    p.then(v => { if (!v && id === seq.current) setSelected(prev); });
  };

  const applyRange = (r: Range) => {
    setRange(r);
    const full = DAY.test(r.from) && DAY.test(r.to) && r.from <= r.to;
    if (full || (!r.from && !r.to)) load(selected, r);
  };
  const invalid = !!(range.from && range.to && range.from > range.to);
  const quick = quickRanges();

  const editionsDesc = view ? view.editions.slice().reverse() : [];
  const triggerLabel = selected.length === 0 ? 'Edição' : selected.length <= 2 ? selected.map(ed).join(', ') : `${selected.length} edições`;
  const label = 'hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground 2xl:inline';

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Marketing</h1>
          </div>
        </header>

        <div role="toolbar" aria-label="Filtros do painel" className="sticky top-0 z-20 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-background px-4 py-2.5 lg:px-6">
          <div className="order-1 flex items-center gap-2">
            <span className={label}>Edição</span>
            <DropdownMenu>
              <DropdownMenuTrigger disabled={!view} aria-label={`Edição: ${triggerLabel}`} className={buttonVariants({ variant: 'outline', className: 'min-w-[5.5rem] justify-between tabular-nums' })}>
                {triggerLabel}
                <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Edições · mais recentes primeiro</DropdownMenuLabel>
                  {editionsDesc.map(e => (
                    <DropdownMenuCheckboxItem key={e.number} checked={selected.indexOf(e.number) >= 0} onCheckedChange={() => toggle(e.number)} className="tabular-nums">
                      {ed(e.number)} <span className="text-muted-foreground">· {dm(e.liveDate)}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator orientation="vertical" className="order-1 hidden h-5 data-vertical:self-auto sm:block" />

          {/* No celular as datas descem para a 2ª linha; os atalhos ficam na 1ª, ao lado da edição. */}
          <div className="order-4 flex w-full items-center gap-2 sm:order-2 sm:w-auto">
            <span className={label}>Período</span>
            <Input type="date" aria-label="Data inicial" aria-invalid={invalid || undefined} value={range.from} max={range.to || undefined}
              onChange={e => applyRange({ from: e.target.value, to: range.to })} className="h-8 min-w-0 flex-1 px-2 text-xs md:text-xs [color-scheme:dark] sm:w-[8.25rem] sm:flex-none" />
            <span aria-hidden className="text-muted-foreground">–</span>
            <Input type="date" aria-label="Data final" aria-invalid={invalid || undefined} value={range.to} min={range.from || undefined}
              onChange={e => applyRange({ from: range.from, to: e.target.value })} className="h-8 min-w-0 flex-1 px-2 text-xs md:text-xs [color-scheme:dark] sm:w-[8.25rem] sm:flex-none" />
          </div>

          <div role="group" aria-label="Atalhos de período" className="order-2 inline-flex h-8 items-center rounded-lg border border-border bg-input/20 p-0.5 sm:order-3">
            {quick.map(q => {
              const on = q.range.from === range.from && q.range.to === range.to;
              return (
                <button key={q.key} type="button" aria-pressed={on} title={q.label} onClick={() => applyRange(q.range)}
                  className={`h-7 rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 sm:px-2.5 ${on ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  <span className="sm:hidden">{q.mini}</span><span className="hidden sm:inline 2xl:hidden">{q.short}</span><span className="hidden 2xl:inline">{q.label}</span>
                </button>
              );
            })}
          </div>

          <div className="order-3 ml-auto flex shrink-0 items-center gap-2 sm:order-4">
            {view && (failing.length ? (
              <Button variant="outline" onClick={() => failing.forEach(warn)} aria-label={`${failing.length} ${failing.length > 1 ? 'fontes' : 'fonte'} com aviso — ver detalhes`}
                className="border-amber-500/30 text-amber-400 hover:text-amber-300">
                <span aria-hidden className="size-1.5 rounded-full bg-amber-400" />
                <span className="tabular-nums sm:hidden">{failing.length}</span>
                <span className="hidden sm:inline 2xl:hidden">{failing.length} {failing.length > 1 ? 'avisos' : 'aviso'}</span>
                <span className="hidden 2xl:inline">{failing.length} {failing.length > 1 ? 'fontes' : 'fonte'} com aviso</span>
              </Button>
            ) : (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex" title={view.sources.map(s => s.source).join(', ')}>
                <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" /> Fontes ok
              </span>
            ))}
            {view && <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:inline">{ago(lastSync, now)}</span>}
            <Button variant="outline" onClick={sync} disabled={syncing} aria-label="Atualizar dados" title={ago(lastSync, now)}>
              <RefreshCw aria-hidden className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Atualizando…' : 'Atualizar'}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          {!view && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {loading ? 'Carregando…' : 'Sem dados para mostrar. Tente Atualizar.'}
            </p>
          )}

          {view && (
            <div aria-busy={loading} className={`flex flex-col gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <div role="group" aria-label="Grupo de abas" className="inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg border border-border bg-input/20 p-0.5">
                {GROUPS.map(g => (
                  <button key={g.key} type="button" aria-pressed={g.key === group} onClick={() => { setGroup(g.key); setTab(g.tabs[0].key); }}
                    className={`h-8 shrink-0 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${g.key === group ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
              <Tabs value={tab} onValueChange={v => setTab(String(v))}>
                <TabsList variant="line">
                  {GROUPS.filter(g => g.key === group)[0].tabs.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
                </TabsList>
                <TabsContent value="edicao"><EditionTab key={view.selected[0]} view={view} onSaved={() => load(selected, range)} /></TabsContent>
                <TabsContent value="criativos"><CreativesTab view={view} onSaved={() => load(selected, range)} /></TabsContent>
                <TabsContent value="validacao"><ValidationTab view={view} /></TabsContent>
                <TabsContent value="pesquisa"><SurveyTab query={query} /></TabsContent>
                <TabsContent value="aplicacoes"><ApplicationsTab query={query} /></TabsContent>
                <TabsContent value="aovivo"><LiveTab query={query} /></TabsContent>
                <TabsContent value="agendamentos"><DealsTab query={query} /></TabsContent>
                <TabsContent value="vendas"><SalesTab query={query} /></TabsContent>
                <TabsContent value="compradores"><BuyersTab query={query} /></TabsContent>
                <TabsContent value="api"><ApiTab query={query} /></TabsContent>
                <TabsContent value="disparos"><DisparosTab query={query} /></TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SidebarInset>
      {/* ui/sonner usa var(--popover), mas aqui os tokens são canais oklch crus: embrulhar em oklch(). */}
      <Toaster theme="dark" position="bottom-right" closeButton
        style={{ '--normal-bg': 'oklch(var(--popover))', '--normal-text': 'oklch(var(--popover-foreground))', '--normal-border': 'var(--border)', '--border-radius': 'var(--radius)' } as CSSProperties}
        toastOptions={{ classNames: { warning: '[&_[data-icon]]:text-amber-400', error: '[&_[data-icon]]:text-red-400' } }} />
    </SidebarProvider>
  );
}
