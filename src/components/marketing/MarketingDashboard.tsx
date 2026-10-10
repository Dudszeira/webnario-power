'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MarketingView } from '@/lib/marketing/view';
import EditionTab from './EditionTab';
import CreativesTab from './CreativesTab';
import ValidationTab from './ValidationTab';

export default function MarketingDashboard() {
  const [view, setView] = useState<MarketingView | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (eds: number[], r: { from: string; to: string }) => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams();
      if (eds.length) q.set('editions', eds.join(','));
      if (r.from && r.to) { q.set('from', r.from); q.set('to', r.to); }
      const res = await fetch(`/api/marketing/data?${q}`);
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'Erro ao carregar'); return null; }
      setView(body); setSelected(body.selected);
      return body as MarketingView;
    } catch {
      setError('Não foi possível carregar os dados');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/marketing/sync', { method: 'POST', body: JSON.stringify({ metaDays: 7 }) });
      if (!res.ok) setError('Não foi possível atualizar');
    } catch {
      setError('Não foi possível atualizar');
    } finally {
      setSyncing(false);
    }
    await load(selected, range);
  }, [load, selected, range]);

  useEffect(() => {
    load([], { from: '', to: '' }).then(v => { if (v?.stale) sync(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (n: number) => {
    const next = selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n].sort((a, b) => a - b);
    if (next.length) load(next, range);
  };

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Marketing</h1>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
                {syncing ? 'Atualizando…' : 'Atualizar agora'}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          {view && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Edições</span>
              {view.editions.slice(-12).map(e => (
                <Button key={e.number} size="sm" variant={selected.includes(e.number) ? 'default' : 'outline'} onClick={() => toggle(e.number)}>
                  #{String(e.number).padStart(3, '0')}
                </Button>
              ))}
              <span className="ml-4 text-xs uppercase tracking-wide text-muted-foreground">Período</span>
              <input type="date" aria-label="Data inicial" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} />
              <input type="date" aria-label="Data final" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!range.from || !range.to || range.from > range.to} onClick={() => load(selected, range)}>Aplicar</Button>
              {(range.from || range.to) && (
                <Button size="sm" variant="ghost" onClick={() => { const r = { from: '', to: '' }; setRange(r); load(selected, r); }}>Limpar</Button>
              )}
            </div>
          )}

          {view?.sources.filter(s => !s.ok).map(s => (
            <p key={s.source} role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Fonte indisponível — {s.source}: {s.message}
            </p>
          ))}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {loading && !view && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {view && (
            <Tabs defaultValue="edicao">
              <TabsList>
                <TabsTrigger value="edicao">Edição</TabsTrigger>
                <TabsTrigger value="criativos">Criativos</TabsTrigger>
                <TabsTrigger value="validacao">Validação</TabsTrigger>
              </TabsList>
              <TabsContent value="edicao"><EditionTab key={view.selected[0]} view={view} onSaved={() => load(selected, range)} /></TabsContent>
              <TabsContent value="criativos"><CreativesTab view={view} onSaved={() => load(selected, range)} /></TabsContent>
              <TabsContent value="validacao"><ValidationTab view={view} /></TabsContent>
            </Tabs>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
