'use client';

import { useEffect, useRef, useState } from 'react';

// Resposta por URL. `query` traz a versão da carga (&v=N), então a mesma URL = mesmos dados:
// voltar a uma aba (o painel desmonta abas fechadas) mostra na hora, sem nova requisição.
// ponytail: guarda só as 40 últimas URLs.
const cache: Record<string, unknown> = {};
const order: string[] = [];
function remember(url: string, data: unknown) {
  if (!(url in cache)) { order.push(url); if (order.length > 40) delete cache[order.shift() as string]; }
  cache[url] = data;
}

export function useTabData<T>(tab: string, query: string, extra = '', enabled = true) {
  const url = `/api/marketing/data?tab=${tab}&${query}${extra}`;
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>(
    () => (url in cache ? { data: cache[url] as T, loading: false, error: '' } : { data: null, loading: enabled, error: '' }),
  );
  const seq = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    if (url in cache) { setState({ data: cache[url] as T, loading: false, error: '' }); return; }
    const id = ++seq.current; // só a última requisição vale
    setState(s => ({ data: s.data, loading: true, error: '' }));
    fetch(url)
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Erro ao carregar');
        // Aba da planilha sem dados: o servidor diz qual; nada de zeros na tela.
        if (body && Array.isArray(body.missing)) throw new Error(`Fonte sem dados: ${body.missing.join(', ')}. Clique em Atualizar.`);
        remember(url, body);
        return body as T;
      })
      .then(data => { if (id === seq.current) setState({ data, loading: false, error: '' }); })
      .catch(e => { if (id === seq.current) setState(s => ({ data: s.data, loading: false, error: (e as Error).message || 'Erro ao carregar' })); });
  }, [url, enabled]);
  return state;
}
