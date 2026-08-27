/**
 * Cliente da API.
 *
 * ⛔ Não existe token aqui. Nada de `localStorage.setItem('token', …)`, nada de header
 * `Authorization`, nada de lógica de renovação — o cookie de sessão é `HttpOnly` e o
 * navegador o envia sozinho. `credentials: 'include'` é tudo que se precisa.
 */

const BASE = '/api';

// ═══════════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════════

export type Usuario = { nome: string | null; fotoUrl: string | null };

export type Parlamentar = {
  id: number;
  nome: string;
  partido: string;
  uf: string;
  nVotacoes: number;
  /** 🔴 URL na Câmara — ⛔ a imagem não é rehospedada. */
  urlFoto?: string | null;
};

export type VotoNaFicha = {
  votacaoId: string;
  data: string;
  descricao: string | null;
  valor: number | null;
};

export type Similar = {
  pessoaId: number;
  nome: string;
  partido: string;
  valor: number;
  comuns: number;
};

export type Ficha = {
  id: number;
  nome: string;
  nomeCivil: string;
  partido: string;
  uf: string;
  urlFoto: string | null;
  nVotacoes: number;
  votosRecentes: VotoNaFicha[];
  maisSimilares: Similar[];
};

export type Noticia = {
  id: number;
  url: string;
  titulo: string;
  veiculo: string;
  publicadaEm: string;
  trecho: string | null;
};

export type Pergunta = {
  id: string;
  texto: string;
  ordem: number;
  /**
   * Comparecimento na votação. ⛔ NÃO é o placar — revelar a divisão antes de a pessoa
   * responder induziria conformidade. Ver `PerguntaPublica` na API.
   */
  totalVotos: number;
  /** Quantos parlamentares a base tem — o denominador do painel. */
  totalPossivel: number;
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

/**
 * 🔴 `baseDeVotacoes` existe para a tela poder ser franca: a posição do cidadão vale
 * sobre as perguntas que ele respondeu; a de cada deputado, sobre a legislatura
 * inteira. Não é a mesma medida com o mesmo nome.
 */
export type PosicaoDoCidadao = {
  eixoX: number;
  eixoY: number;
  comunidade: number | null;
  vizinhosUsados: number;
  baseDeVotacoes: number;
};

export type ResultadoAfinidade = {
  casa: string;
  totalPerguntasRespondidas: number;
  maisProximos: ParlamentarAfim[];
  maisDistantes: ParlamentarAfim[];
  posicaoNoGrafo: PosicaoDoCidadao | null;
};

export class NaoAutenticadoError extends Error {
  constructor() {
    super('Sessão expirada.');
  }
}

export class RespostasInsuficientesError extends Error {
  readonly minimo: number;

  // ⚠️ sem "parameter property": o projeto usa `erasableSyntaxOnly`
  constructor(minimo: number) {
    super('Responda mais perguntas para o resultado ter significado.');
    this.minimo = minimo;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Sessão
// ═══════════════════════════════════════════════════════════════════

/** Devolve o usuário logado, ou `null` se não houver sessão. */
export async function quemSouEu(): Promise<Usuario | null> {
  const resposta = await fetch(`${BASE}/auth/eu`, { credentials: 'include' });

  if (resposta.status === 401) return null;
  if (!resposta.ok) throw new Error('Falha ao verificar a sessão.');

  return resposta.json();
}

export async function entrarComGoogle(idToken: string): Promise<Usuario> {
  return enviar<Usuario>(`${BASE}/auth/google`, { idToken });
}

export type Avaliacao = {
  perguntasRespondidas: number;
  acordosDoPrimeiro: number;
  comparaveisDoPrimeiro: number;
  acertou: boolean | null;
  /** -3 (esquerda) a +3 (direita), ou null. */
  posicaoAutodeclarada: number | null;
};

/**
 * ⚠️ Vai SEM identificação: o servidor grava sem `usuario_id`, de propósito.
 * Responde "o instrumento acerta?" sem responder "o que o Fulano pensa?".
 */
export async function registrarAvaliacao(avaliacao: Avaliacao): Promise<void> {
  const resposta = await fetch(`${BASE}/avaliacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(avaliacao),
    credentials: 'include',
  });

  if (!resposta.ok) throw new Error(`Falha ao registrar avaliação (${resposta.status}).`);
}

/** 🔴 LGPD art. 18, VI — apaga conta, lista de acompanhados e consentimentos. */
export async function excluirConta(): Promise<void> {
  await semCorpo(`${BASE}/auth/conta`, 'DELETE');
}

export async function sair(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}

// ═══════════════════════════════════════════════════════════════════
// Parlamentares
// ═══════════════════════════════════════════════════════════════════

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

export async function obterFicha(id: number): Promise<Ficha> {
  return buscar<Ficha>(`${BASE}/parlamentares/${id}`);
}

export async function obterNoticias(id: number): Promise<Noticia[]> {
  return buscar<Noticia[]>(`${BASE}/parlamentares/${id}/noticias`);
}

// ═══════════════════════════════════════════════════════════════════
// Seguir — 🔴 escreve dado sensível (LGPD art. 5º, II)
// ═══════════════════════════════════════════════════════════════════

export async function listarSeguidos(): Promise<Parlamentar[]> {
  const seguidos = await buscar<
    { pessoaId: number; nome: string; partido: string; uf: string }[]
  >(`${BASE}/seguidos`);

  return seguidos.map((s) => ({ ...s, id: s.pessoaId, nVotacoes: 0 }));
}

/** ⭐ PUT: seguir duas vezes é o mesmo que seguir uma. */
export async function seguir(pessoaId: number): Promise<void> {
  await semCorpo(`${BASE}/seguidos/${pessoaId}`, 'PUT');
}

export async function deixarDeSeguir(pessoaId: number): Promise<void> {
  await semCorpo(`${BASE}/seguidos/${pessoaId}`, 'DELETE');
}

// ═══════════════════════════════════════════════════════════════════
// Questionário
// ═══════════════════════════════════════════════════════════════════

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

  // ⭐ 422 é resposta prevista (CT7), não falha de rede
  if (resposta.status === 422) {
    const corpo = await resposta.json().catch(() => ({ minimo: 0 }));
    throw new RespostasInsuficientesError(corpo.minimo ?? 0);
  }

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(`Falha ao calcular afinidade (${resposta.status}).`);

  return resposta.json();
}

// ═══════════════════════════════════════════════════════════════════

async function buscar<T>(url: string): Promise<T> {
  const resposta = await fetch(url, { credentials: 'include' });

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(`Falha ao consultar ${url} (${resposta.status}).`);

  return resposta.json();
}

async function enviar<T>(url: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    credentials: 'include',
  });

  if (!resposta.ok) throw new Error(`Falha em ${url} (${resposta.status}).`);

  return resposta.json();
}

async function semCorpo(url: string, metodo: string): Promise<void> {
  const resposta = await fetch(url, { method: metodo, credentials: 'include' });

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(`Falha em ${url} (${resposta.status}).`);
}

// ═══════════════════════════════════════════════════════════════════
// Grafo (RF-33)
// ═══════════════════════════════════════════════════════════════════

export type NoDoGrafo = {
  id: number;
  nome: string;
  partido: string;
  uf: string;
  /** ⚠️ Grupo detectado pelo VOTO, não pelo partido — ver `plano/07`. */
  comunidade: number | null;
  /** Posição no DESENHO — layout de molas. ⛔ Sem interpretação. */
  eixoX: number | null;
  eixoY: number | null;
  nVotacoes: number;
  /** 1ª componente principal (SVD) — ⭐ o eixo que SIGNIFICA algo. Ver PL43. */
  componente1: number | null;
  componente2: number | null;
};

export type ArestaDoGrafo = { de: number; para: number; peso: number };

export type Grafo = {
  execucaoId: number;
  casa: string;
  legislatura: number;
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
};

export async function obterGrafo(): Promise<Grafo> {
  return buscar<Grafo>(`${BASE}/grafo`);
}

// ═══════════════════════════════════════════════════════════════════
// Cota parlamentar (CEAP)
// ═══════════════════════════════════════════════════════════════════

export type GastoPorCategoria = {
  categoria: string;
  total: number;
  lancamentos: number;
};

export type FornecedorDoParlamentar = {
  nome: string;
  total: number;
  lancamentos: number;
  /** ⚠️ Quando `true`, o CNPJ/CPF está hasheado no banco — RNF-13. */
  pessoaFisica: boolean;
};

export type GastoDeCota = {
  ano: number;
  total: number;
  lancamentos: number;
  porCategoria: GastoPorCategoria[];
  maioresFornecedores: FornecedorDoParlamentar[];
};

export async function obterGastos(pessoaId: number): Promise<GastoDeCota> {
  return buscar<GastoDeCota>(`${BASE}/parlamentares/${pessoaId}/gastos`);
}
