import type { CaptureRow, SurveyRow } from './types.ts';

export const ORDER_RENDA = ['zero', 'menos1k', '1a3k', '3a5k', '5a7k', '7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'];
export const ORDER_TEMPO = ['nunca', 'menos1', '1a3', '3a5', '5a10', 'mais10'];
export const ORDER_CONHECE = ['agora', 'menos3m', '3a6m', '6a12m', 'mais1a', 'mais2a', 'mais3a'];
export const ORDER_SERVICO = ['estudio', 'ensaios-ext', 'casamentos', 'formaturas', 'esporte', 'outro', 'nunca'];
export const QUALIFIED_RENDA = ['5a7k', '7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'];
export const LABEL_RENDA: Record<string, string> = {
  zero: 'Zero', menos1k: '< R$1k', '1a3k': 'R$1k a 3k', '3a5k': 'R$3k a 5k', '5a7k': 'R$5k a 7k', '7a10k': 'R$7k a 10k',
  '10a15k': 'R$10k a 15k', '15a20k': 'R$15k a 20k', '20a30k': 'R$20k a 30k', '30a50k': 'R$30k a 50k', mais50k: '> R$50k',
};
const LABEL_TEMPO: Record<string, string> = { nunca: 'Nunca', menos1: '< 1 ano', '1a3': '1 a 3 anos', '3a5': '3 a 5 anos', '5a10': '5 a 10 anos', mais10: '> 10 anos' };
const LABEL_CONHECE: Record<string, string> = { agora: 'Agora', menos3m: '< 3 meses', '3a6m': '3 a 6 meses', '6a12m': '6 a 12 meses', mais1a: '> 1 ano', mais2a: '> 2 anos', mais3a: '> 3 anos' };
const LABEL_SERVICO: Record<string, string> = { estudio: 'Estúdio', 'ensaios-ext': 'Ensaios externos', casamentos: 'Casamentos', formaturas: 'Formaturas', esporte: 'Esporte', outro: 'Outro', nunca: 'Nunca atuou' };

export type SurveyField = 'renda' | 'fat' | 'tempo' | 'servico' | 'conhece';
const ORDER: Record<SurveyField, string[]> = { renda: ORDER_RENDA, fat: ORDER_RENDA, tempo: ORDER_TEMPO, servico: ORDER_SERVICO, conhece: ORDER_CONHECE };
const LABEL: Record<SurveyField, Record<string, string>> = { renda: LABEL_RENDA, fat: LABEL_RENDA, tempo: LABEL_TEMPO, servico: LABEL_SERVICO, conhece: LABEL_CONHECE };
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const surveyLabel = (field: SurveyField, v: string) => (own(LABEL[field], v) ? LABEL[field][v] : v);
export const qualified5k = (renda: string) => QUALIFIED_RENDA.indexOf(renda) >= 0;

// Uma resposta por e-mail: a mais recente do ciclo.
export function latestSurveys(rows: SurveyRow[], cycleStart: string | null): Record<string, SurveyRow> {
  const out: Record<string, SurveyRow> = Object.create(null);
  rows.forEach(r => {
    if (!r.email) return;
    if (cycleStart && r.at && r.at < cycleStart) return; // resposta de ciclo anterior
    const prev = out[r.email];
    // Fica a mais recente; resposta sem data não substitui uma datada.
    if (prev && (!r.at || (prev.at && r.at <= prev.at))) return;
    out[r.email] = r;
  });
  return out;
}

export type DistItem = { key: string; label: string; count: number; qualified: boolean };

export function distribution(items: SurveyRow[], field: SurveyField): DistItem[] {
  const counts: Record<string, number> = Object.create(null);
  const extras: string[] = [];
  items.forEach(x => {
    const k = x[field] || '';
    if (counts[k] === undefined) { counts[k] = 0; if (k && ORDER[field].indexOf(k) < 0) extras.push(k); }
    counts[k]++;
  });
  return ORDER[field].filter(k => counts[k] !== undefined).concat(extras)
    .map(k => ({ key: k, label: surveyLabel(field, k), count: counts[k], qualified: field === 'renda' && qualified5k(k) }));
}

export const INCOME_FILTERS: Record<string, string[]> = {
  '3kplus': ['3a5k', '5a7k', '7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'],
  '5kplus': QUALIFIED_RENDA,
  '7kplus': ['7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'],
  '10kplus': ['10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'],
  '20kplus': ['20a30k', '30a50k', 'mais50k'],
};

export function filterIncome(items: SurveyRow[], f: string): SurveyRow[] {
  if (!f || f === 'all') return items;
  if (own(INCOME_FILTERS, f)) { const set = INCOME_FILTERS[f]; return items.filter(p => set.indexOf(p.renda) >= 0); }
  return items.filter(p => p.renda === f);
}

// Listas do dash antigo, comparadas sem acento.
const STOPWORDS_RAW = ['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'é', 'ser', 'ter', 'tem', 'tenho', 'tenha', 'não', 'sim', 'mas', 'ou', 'como', 'onde', 'quando', 'porque', 'porquê', 'muito', 'mais', 'menos', 'já', 'ainda', 'só', 'apenas', 'também', 'sobre', 'me', 'meu', 'minha', 'meus', 'minhas', 'eu', 'você', 'vocês', 'estou', 'está', 'estar', 'estava', 'vou', 'vai', 'ia', 'foi', 'fazer', 'faço', 'faz', 'fiz', 'fazia', 'quero', 'queria', 'preciso', 'precisa', 'precisar', 'pode', 'poder', 'posso', 'sei', 'sabe', 'saber', 'ao', 'à', 'às', 'aos', 'tá', 'tô', 'ficar', 'fica', 'fico', 'ficou', 'vem', 'ir', 'indo', 'nao', 'os', 'as', 'esta', 'isso', 'aquilo', 'todo', 'toda', 'todos', 'todas', 'cada', 'esse', 'essa', 'esses', 'essas', 'este', 'isto', 'estes', 'estas', 'coisa', 'coisas', 'forma', 'jeito', 'vez', 'vezes', 'hora', 'horas', 'tempo', 'tempos', 'pouco', 'pouca', 'pouquinho', 'realmente', 'quase', 'mesmo', 'mesma', 'além', 'tudo', 'nada', 'qualquer', 'tipo', 'tipos', 'fim', 'conta', 'muitas', 'muitos', 'entao', 'então', 'assim', 'pois', 'porem', 'porém', 'antes', 'depois'];
const VAGUE_VERBS_RAW = ['conseguir', 'conseguindo', 'consigo', 'consegue', 'conseguido', 'conseguiu', 'chamar', 'chamando', 'chama', 'chamam', 'chamado', 'entender', 'entendendo', 'entendo', 'entende', 'entendido', 'buscar', 'buscando', 'busco', 'busca', 'aprender', 'aprendendo', 'aprendo', 'aprende', 'aprendido', 'começar', 'começando', 'começo', 'começa', 'comecei', 'ganhar', 'ganhando', 'ganho', 'ganha', 'ganhei', 'ganhou', 'ver', 'vendo', 'vejo', 'vê', 'vi', 'melhorar', 'melhorando', 'melhoro', 'melhora', 'melhorei', 'crescer', 'crescendo', 'cresço', 'cresce', 'cresceu', 'gerar', 'gerando', 'gera', 'gerou', 'trazer', 'trazendo', 'trago', 'traz', 'trouxe', 'dar', 'dando', 'dou', 'dá', 'deu', 'fazendo', 'fez', 'colocar', 'colocando', 'coloco', 'coloca', 'coloquei', 'tendo', 'teve', 'teria', 'organizar', 'organizando', 'organizo', 'organiza', 'trabalhar', 'trabalhando', 'trabalho', 'trabalha', 'trabalhei'];
const deaccent = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const toSet = (words: string[]) => { const o: Record<string, true> = Object.create(null); words.forEach(w => { o[deaccent(w)] = true; }); return o; };
const STOPWORDS = toSet(STOPWORDS_RAW);
const VAGUE_VERBS = toSet(VAGUE_VERBS_RAW);

export type Challenges = { keywords: { word: string; count: number; examples: string[] }[]; phrases: { text: string; count: number }[] };

export function challenges(items: SurveyRow[]): Challenges {
  const byNorm: Record<string, { text: string; count: number }> = Object.create(null);
  const phrases: { text: string; count: number }[] = [];
  items.forEach(p => {
    const raw = (p.desafios || '').trim();
    if (raw.length < 2) return;
    const k = raw.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '').trim();
    if (!byNorm[k]) { byNorm[k] = { text: raw, count: 0 }; phrases.push(byNorm[k]); }
    byNorm[k].count++;
  });
  phrases.sort((a, b) => b.count - a.count || b.text.length - a.text.length);

  // Palavras-chave = pares de palavras vizinhas (≥ 4 letras, sem stopword, não dois verbos vagos).
  const grams: Record<string, { word: string; count: number; examples: string[] }> = Object.create(null);
  const list: { word: string; count: number; examples: string[] }[] = [];
  phrases.forEach(d => {
    const tokens = d.text.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúüç\s]/gi, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i], b = tokens[i + 1], nA = deaccent(a), nB = deaccent(b);
      if (nA.length < 4 || nB.length < 4) continue;
      if (STOPWORDS[nA] || STOPWORDS[nB]) continue;
      if (VAGUE_VERBS[nA] && VAGUE_VERBS[nB]) continue;
      const key = `${nA} ${nB}`;
      let g = grams[key];
      if (!g) { g = grams[key] = { word: `${a} ${b}`, count: 0, examples: [] }; list.push(g); }
      g.count += d.count;
      if (g.examples.length < 3 && g.examples.indexOf(d.text) < 0) g.examples.push(d.text);
    }
  });
  list.sort((a, b) => b.count - a.count);
  return { keywords: list.slice(0, 15), phrases };
}

export type SurveyTab = {
  leads: number; responses: number; filtered: number; qualified: number;
  responseRate: number | null; quality: number | null; filter: string;
  charts: Record<SurveyField, DistItem[]>;
  challenges: Challenges;
};

// leads = linhas da Captação das edições/período; a pesquisa liga por e-mail.
export function surveyTab(leads: CaptureRow[], surveys: Record<string, SurveyRow>, filter: string): SurveyTab {
  const seen: Record<string, true> = Object.create(null);
  const answered: SurveyRow[] = [];
  leads.forEach(l => {
    const s = l.email ? surveys[l.email] : undefined;
    if (s && !seen[l.email]) { seen[l.email] = true; answered.push(s); }
  });
  const items = filterIncome(answered, filter);
  const qualified = items.filter(p => qualified5k(p.renda)).length;
  return {
    leads: leads.length, responses: answered.length, filtered: items.length, qualified,
    responseRate: leads.length ? items.length / leads.length : null,
    quality: items.length ? qualified / items.length : null,
    filter: filter || 'all',
    charts: {
      renda: distribution(items, 'renda'), fat: distribution(items, 'fat'), tempo: distribution(items, 'tempo'),
      servico: distribution(items, 'servico'), conhece: distribution(items, 'conhece'),
    },
    challenges: challenges(items),
  };
}
