/**
 * Cliente da API.
 *
 * ⛔ Não existe token aqui. Nada de `localStorage.setItem('token', …)`, nada de header
 * `Authorization`, nada de lógica de renovação — o cookie de sessão é `HttpOnly` e o
 * navegador o envia sozinho. `credentials: 'include'` é tudo que se precisa.
 */

const BASE = '/api';

export type Pergunta = {
  id: string;
  texto: string;
  ordem: number;
};

/** +1 concordo · -1 discordo · 0 não sei */
export type Resposta = 1 | -1 | 0;

export type ParlamentarAfim = {
  pessoaId: number;
  nome: string;
  partido: string;
  uf: string;
  /** ⭐ acordos e comparáveis, nunca percentual — a frase "X de Y" é montada aqui */
  acordos: number;
  comparaveis: number;
};

export type ResultadoAfinidade = {
  casa: string;
  totalPerguntasRespondidas: number;
  maisProximos: ParlamentarAfim[];
  maisDistantes: ParlamentarAfim[];
};

export type Parlamentar = {
  id: number;
  nome: string;
  partido: string;
  uf: string;
  nVotacoes: number;
};

export class RespostasInsuficientesError extends Error {
  readonly minimo: number;

  // ⚠️ sem "parameter property": o projeto usa `erasableSyntaxOnly`, que só aceita
  // sintaxe TypeScript removível sem transformação
  constructor(minimo: number) {
    super('Responda mais perguntas para o resultado ter significado.');
    this.minimo = minimo;
  }
}

export async function obterPerguntas(): Promise<Pergunta[]> {
  return buscar<Pergunta[]>(`${BASE}/afinidade/perguntas`);
}

export async function calcularAfinidade(
  respostas: { perguntaId: string; valor: Resposta }[],
): Promise<ResultadoAfinidade> {
  const resposta = await fetch(`${BASE}/afinidade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respostas }),
    credentials: 'include',
  });

  // 422 é resposta prevista (CT7), não falha de rede
  if (resposta.status === 422) {
    const corpo = await resposta.json().catch(() => ({ minimo: 0 }));
    throw new RespostasInsuficientesError(corpo.minimo ?? 0);
  }

  if (!resposta.ok) throw new Error(`Falha ao calcular afinidade (${resposta.status}).`);

  return resposta.json();
}

export async function listarParlamentares(filtro?: {
  nome?: string;
  partido?: string;
  uf?: string;
}): Promise<Parlamentar[]> {
  const query = new URLSearchParams(
    Object.entries(filtro ?? {}).filter(([, v]) => v) as [string, string][],
  );

  return buscar<Parlamentar[]>(`${BASE}/parlamentares?${query}`);
}

// ═══════════════════════════════════════════════════════════════════

async function buscar<T>(url: string): Promise<T> {
  const resposta = await fetch(url, { credentials: 'include' });
  if (!resposta.ok) throw new Error(`Falha ao consultar ${url} (${resposta.status}).`);

  return resposta.json();
}
