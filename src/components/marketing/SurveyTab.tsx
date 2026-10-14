'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { LABEL_RENDA, ORDER_RENDA, type Challenges, type SurveyTab as Data } from '@/lib/marketing/survey';
import { useTabData } from './useTabData';
import { DistChart, Kpi, TabState, int, kpiGrid, pct, sectionTitle } from './ui';

const BANDS: [string, string][] = [['3kplus', '3k ou mais'], ['5kplus', '5k ou mais'], ['7kplus', '7k ou mais'], ['10kplus', '10k ou mais'], ['20kplus', '20k ou mais']];

export function ChallengesView({ data }: { data: Challenges }) {
  if (!data.phrases.length) return <p className="text-xs text-muted-foreground">Sem desafios nesta seleção.</p>;
  const max = data.keywords.length ? data.keywords[0].count : 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-3">
        {data.keywords.map(k => (
          <div key={k.word} title={`Ex.: ${k.examples.join(' · ')}`} className="relative overflow-hidden rounded-md border border-border px-3 py-2">
            <div aria-hidden className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${(k.count / max) * 100}%` }} />
            <div className="relative flex items-center justify-between gap-2 text-sm"><span>{k.word}</span><span className="font-semibold tabular-nums">{k.count}</span></div>
          </div>
        ))}
      </div>
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Todas as frases ({data.phrases.length})</summary>
        <ul className="grid max-h-96 gap-2 overflow-auto border-t border-border p-3 sm:grid-cols-2">
          {data.phrases.map((p, i) => (
            <li key={i} className="rounded-md bg-muted/40 px-3 py-2 text-xs">
              “{p.text}”{p.count > 1 && <span className="ml-1 text-muted-foreground">· {p.count}×</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function SurveyTab({ query }: { query: string }) {
  const [renda, setRenda] = useState('all');
  const { data: d, loading, error } = useTabData<Data>('pesquisa', query, `&renda=${renda}`);
  if (!d) return <TabState loading={loading} error={error} />;
  const charts: [keyof Data['charts'], string][] = [['fat', 'Faturamento com fotografia'], ['tempo', 'Tempo de fotografia'], ['servico', 'Serviço carro-chefe'], ['conhece', 'Conhece há quanto tempo']];
  const dist = (k: keyof Data['charts']) => d.charts[k].map(x => ({ label: x.label, count: x.count }));
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="mkt-renda" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Renda familiar</label>
        <select id="mkt-renda" value={renda} onChange={e => setRenda(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
          <option value="all">Todas</option>
          <optgroup label="Acumuladas">{BANDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
          <optgroup label="Faixas">{ORDER_RENDA.map(k => <option key={k} value={k}>{LABEL_RENDA[k]}</option>)}</optgroup>
        </select>
        <span className="text-xs text-muted-foreground">{renda === 'all' ? `${int(d.responses)} respostas` : `${int(d.filtered)} de ${int(d.responses)} respostas`}</span>
      </div>

      <section>
        <h2 className={sectionTitle}>Pesquisa × captação</h2>
        <div className={kpiGrid}>
          <Kpi label="Taxa de resposta" value={pct(d.responseRate)} hint={`${int(d.filtered)} de ${int(d.leads)} leads`} why="Sem leads na seleção" />
          <Kpi label="Qualificados 5k+" value={int(d.qualified)} hint="responderam e têm renda familiar 5k+" />
          <Kpi label="Qualidade" value={pct(d.quality)} hint="dos que responderam, são 5k+" why="Ninguém respondeu" />
        </div>
      </section>

      <section className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className={sectionTitle}>Renda familiar <span className="font-normal normal-case tracking-normal">· verde = qualificado</span></h2>
          <DistChart data={dist('renda')} label="Respostas" colorOf={i => (d.charts.renda[i].qualified ? '#34d399' : '#fbbf24')} />
        </Card>
        {charts.map(([k, title]) => (
          <Card key={k} className="p-4">
            <h2 className={sectionTitle}>{title}</h2>
            <DistChart data={dist(k)} label="Respostas" />
          </Card>
        ))}
      </section>

      <section>
        <h2 className={sectionTitle}>Desafios · palavras-chave mais citadas</h2>
        <ChallengesView data={d.challenges} />
      </section>
    </div>
  );
}
