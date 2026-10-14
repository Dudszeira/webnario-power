'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { LiveStats, LiveTab as Data } from '@/lib/marketing/live';
import { useTabData } from './useTabData';
import { DistChart, Kpi, TabState, dm, ed, int, kpiGrid, mins, pct, ratio, sectionTitle } from './ui';

const COLORS = ['oklch(var(--chart-1))', 'oklch(var(--chart-2))', 'oklch(var(--chart-3))', 'oklch(var(--chart-4))', 'oklch(var(--chart-5))'];

export default function LiveTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('aovivo', query);
  if (!d) return <TabState loading={loading} error={error} />;
  const t = d.totals;
  const withData = d.editions.filter(e => e.stats) as { edition: number; liveDate: string; stats: LiveStats }[];
  if (!t || !withData.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem presença registrada na plataforma para as edições selecionadas.</p>;
  }
  const one = withData.length === 1;
  const config: ChartConfig = {};
  withData.forEach((e, i) => { config[`e${e.edition}`] = { label: `${ed(e.edition)} (${dm(e.liveDate)})`, color: COLORS[i % COLORS.length] }; });
  const len = withData.reduce((m, e) => Math.max(m, e.stats.curve.length), 0);
  const rows = Array.from({ length: len }, (_, minute) => {
    const r: Record<string, number> = { minute };
    withData.forEach(e => { const v = e.stats.curve[minute]; if (v !== undefined) r[`e${e.edition}`] = v; });
    return r;
  });
  const pitch = withData[withData.length - 1].stats.pitchMinute;

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Presença na plataforma</h2>
        <div className={kpiGrid}>
          <Kpi label="Pessoas no ao vivo" value={int(t.people)} hint={one ? ed(withData[0].edition) : `${t.editions} lives · média ${int(Math.round(t.people / t.editions))}`} />
          <Kpi label="Tempo médio" value={mins(t.mean)} hint={`mediana ${mins(t.median)} · só quem assistiu`} why="Ninguém assistiu" />
          <Kpi label="Pico simultâneo" value={int(t.peak)} hint={one ? `aos ${t.peakMinute} min das 20h` : `média por live · maior ${int(t.peakMax)}`} />
          <Kpi label="Até o pitch" value={int(t.toPitch)} hint={`${pct(ratio(t.toPitch, t.people))} das pessoas`} />
          <Kpi label="30 min ou mais" value={pct(ratio(t.min30, t.people))} hint={`${int(t.min30)} pessoas · 60+ min: ${int(t.min60)}`} />
          <Kpi label="Clicaram no CTA" value={int(t.cta)} hint={`${pct(ratio(t.cta, t.people))} das pessoas`} />
        </div>
      </section>

      <Card className="p-4">
        <h2 className={sectionTitle}>Audiência por minuto desde as 20h</h2>
        <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
          <LineChart data={rows}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
            <XAxis dataKey="minute" type="number" domain={[0, 'dataMax']} tickLine={false} axisLine={false} tickFormatter={v => `${v} min`} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ReferenceLine x={pitch} stroke="oklch(var(--muted-foreground))" strokeDasharray="4 4"
              label={{ value: 'Pitch', position: 'insideTopRight', fontSize: 10, fill: 'oklch(var(--muted-foreground))' }} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => `minuto ${(p?.[0]?.payload as { minute?: number } | undefined)?.minute ?? 0}`} />} />
            <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
            {withData.map(e => <Line key={e.edition} dataKey={`e${e.edition}`} type="monotone" stroke={`var(--color-e${e.edition})`} strokeWidth={2} dot={false} connectNulls={false} />)}
          </LineChart>
        </ChartContainer>
      </Card>

      <Card className="p-4">
        <h2 className={sectionTitle}>Tempo assistido</h2>
        <DistChart data={t.histogram} label="Pessoas" colorOf={i => (i < 2 ? '#f87171' : i < 4 ? '#fbbf24' : '#34d399')} />
      </Card>

      <section className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-3">
        {d.editions.map(e => (
          <Card key={e.edition} size="sm" className="gap-1 px-4">
            <p className="text-xs font-semibold">{ed(e.edition)} <span className="font-normal text-muted-foreground">· {dm(e.liveDate)}</span></p>
            {e.stats ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Pessoas</dt><dd className="text-right tabular-nums">{int(e.stats.people)}</dd>
                <dt className="text-muted-foreground">Tempo médio</dt><dd className="text-right tabular-nums">{mins(e.stats.mean)}</dd>
                <dt className="text-muted-foreground">Mediana</dt><dd className="text-right tabular-nums">{mins(e.stats.median)}</dd>
                <dt className="text-muted-foreground">Pico</dt><dd className="text-right tabular-nums">{int(e.stats.peak)} <span className="text-muted-foreground">aos {e.stats.peakMinute} min</span></dd>
                <dt className="text-muted-foreground">Até o pitch</dt><dd className="text-right tabular-nums">{int(e.stats.toPitch)}</dd>
                <dt className="text-muted-foreground">30+ / 60+ min</dt><dd className="text-right tabular-nums">{int(e.stats.min30)} / {int(e.stats.min60)}</dd>
                <dt className="text-muted-foreground">CTA</dt><dd className="text-right tabular-nums">{int(e.stats.cta)}</dd>
              </dl>
            ) : <p className="text-xs text-muted-foreground" title="Nenhum evento de presença nesta live">—</p>}
          </Card>
        ))}
      </section>
    </div>
  );
}
