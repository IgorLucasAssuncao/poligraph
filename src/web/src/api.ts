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

/** As duas casas do Congresso. ⛔ Nunca há um terceiro valor. */
export type Casa = 'CAMARA' | 'SENADO';

export type Usuario = { nome: string | null; fotoUrl: string | null };

export type Parlamentar = {
  /** ⚠️ Vazio quando a pessoa ainda não tem voto — a casa vem do mandato. */
  casa: Casa | '';
  id: number;
  nome: string;
  partido: string;
  uf: string;
  nVotacoes: number;
  /** 🔴 URL na Câmara — ⛔ a imagem não é rehospedada. */
  urlFoto?: string | null;
};

/**
 * ⚠️ `orientacaoDoGoverno` é nula com frequência, por TRÊS motivos diferentes que a
 * tela ⛔ não deve confundir: o Governo não orientou aquela votação, orientou
 * `Obstrução`/`Liberado` — que não são posição de mérito —, ou a casa é o Senado.
 */
export type VotoNaFicha = {
  votacaoId: string;
  data: string;
  descricao: string | null;
  valor: number | null;
  orientacaoDoGoverno: string | null;
};

export type Similar = {
  pessoaId: number;
  nome: string;
  partido: string;
  valor: number;
  comuns: number;
};

/**
 * Com que frequência o parlamentar votou como pediram a ele.
 *
 * ⚠️ Cada proporção vem com a BASE. 80% sobre 15 votações e 80% sobre 900 são
 * afirmações de força muito diferente, e a tela ⛔ nunca mostra uma sem a outra.
 *
 * ⛔ Nulo no Senado inteiro: lá não existe orientação de bancada publicada.
 */
export type Alinhamento = {
  governismo: number | null;
  baseGovernismo: number;
  disciplina: number | null;
  baseDisciplina: number;
  /** Contra qual sigla a disciplina foi medida — quem trocou de partido tem a do voto mais recente. */
  partidoMedido: string | null;
};

export type Ficha = {
  id: number;
  nome: string;
  /** Derivada do voto mais recente — a casa é do mandato, não do cadastro. */
  casa: Casa | '';
  nomeCivil: string;
  partido: string;
  uf: string;
  urlFoto: string | null;
  nVotacoes: number;
  votosRecentes: VotoNaFicha[];
  maisSimilares: Similar[];
  alinhamento: Alinhamento | null;
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
  /**
   * ⭐ Os ids das perguntas que produziram o "X de Y". Sem eles o número não é
   * conferível: não dá para saber se os acordos foram nas perguntas que importam para
   * quem responde ou nas de data comemorativa.
   *
   * ⚠️ Só vêm preenchidos para os que aparecem na tela — calcular para os ~640 do
   * cálculo seria trabalho jogado fora.
   */
  acordou: string[];
  discordou: string[];
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

/**
 * O resultado de UMA casa.
 *
 * `perguntasRespondidas` é o denominador desta casa, não o total: o piso de comparáveis
 * vale por casa, senão um senador — que responde poucas perguntas do Senado — seria
 * filtrado por um piso calculado sobre as perguntas da Câmara.
 */
export type ResultadoPorCasa = {
  casa: Casa;
  perguntasRespondidas: number;
  maisProximos: ParlamentarAfim[];
  maisDistantes: ParlamentarAfim[];
  posicaoNoGrafo: PosicaoDoCidadao | null;
};

/**
 * O cidadão responde um fluxo único e nunca escolhe entre Câmara e Senado (RNF-28).
 * As duas casas votam matérias diferentes, então o resultado se separa depois do
 * questionário — em "Deputados mais próximos" e "Senadores mais próximos".
 */
export type ResultadoAfinidade = {
  totalPerguntasRespondidas: number;
  porCasa: ResultadoPorCasa[];
};

/**
 * O rótulo de cada casa na tela. A API devolve a casa; a redação é do front.
 *
 * ⚠️ `nome` é a instituição, `plural`/`singular` são as pessoas. São usos
 * diferentes: “Senado Federal” encabeça a figura, “104 senadores” a descreve.
 */
export const NOME_DA_CASA: Record<
  Casa,
  { nome: string; plural: string; singular: string }
> = {
  CAMARA: { nome: 'Câmara dos Deputados', plural: 'deputados', singular: 'deputado' },
  SENADO: { nome: 'Senado Federal', plural: 'senadores', singular: 'senador' },
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
// Panorama — o tamanho da base
// ═══════════════════════════════════════════════════════════════════

export type PanoramaDaCasa = {
  casa: Casa;
  parlamentares: number;
  votacoes: number;
  /** 🔴 O sigilo do Senado é achado do trabalho, não detalhe: 239 de 421. */
  votacoesSecretas: number;
  votosComPosicao: number;
  comunidades: number;
  ligacoes: number;
};

/** ⚠️ `legislatura` é nula em base sem votação — o estado antes do primeiro ETL. */
export type Panorama = {
  legislatura: number | null;
  perguntasAtivas: number;
  porCasa: PanoramaDaCasa[];
};

export async function obterPanorama(): Promise<Panorama> {
  return buscar<Panorama>(`${BASE}/panorama`);
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
    { pessoaId: number; nome: string; casa: Parlamentar['casa']; partido: string; uf: string }[]
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

/**
 * O bloco de abertura e o tamanho do questionário completo.
 *
 * ⚠️ `total` é MAIOR que `perguntas.length`: o resto vem de {@link obterDesempate},
 * que só pode escolher depois de haver respostas. A barra de progresso usa `total`
 * desde o início — sem isso o denominador saltaria no meio do questionário.
 */
export async function obterPerguntas(): Promise<{ perguntas: Pergunta[]; total: number }> {
  return buscar<{ perguntas: Pergunta[]; total: number }>(`${BASE}/afinidade/perguntas`);
}

/**
 * As próximas perguntas, escolhidas contra o empate DESTE cidadão.
 *
 * ⭐ Medido: 8 de base + 7 escolhidas assim deixam 6 parlamentares empatados no topo;
 * as 15 melhores fixas deixam 14, e 8 + 7 sorteadas deixam 16.
 *
 * ⛔ Devolve `[]` — ⛔ nunca erro — quando ⛔ não há mais candidatas. Falhar aqui
 * impediria de concluir um questionário que já está válido.
 */
export async function obterDesempate(
  respostas: { perguntaId: string; valor: Resposta }[],
): Promise<Pergunta[]> {
  try {
    const resposta = await fetch(`${BASE}/afinidade/perguntas/desempate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respostas }),
      credentials: 'include',
    });

    return resposta.ok ? await resposta.json() : [];
  } catch {
    return [];
  }
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
  /** Foto oficial da casa. ⚠️ Nula para quem foi criado a partir do próprio voto. */
  urlFoto: string | null;
  /**
   * ⭐ De 0 a 1 — quanto o parlamentar votou como a bancada do Governo orientou.
   *
   * Vai junto para a LEGENDA do grafo ser derivada do dado, ⛔ não escrita à mão: o
   * sinal do eixo é arbitrário, e uma legenda fixa dizendo "à esquerda ficam os
   * governistas" ficaria errada em silêncio se uma reexecução espelhasse a figura.
   *
   * ⛔ Nulo no Senado.
   */
  governismo: number | null;
};

/**
 * ⚠️ `peso` é a CONCORDÂNCIA, e sozinho ele ⛔ não se lê: 82% sobre 24 votações e 82%
 * sobre 540 são afirmações de força muito diferente. A tela ⛔ nunca mostra um sem
 * `votacoesComuns`.
 */
export type ArestaDoGrafo = {
  de: number;
  para: number;
  peso: number;
  votacoesComuns: number;
  /** A outra métrica da RF-18, sobre o mesmo par. */
  cosseno: number | null;
};

export type Grafo = {
  execucaoId: number;
  casa: string;
  legislatura: number;
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
};

/**
 * O grafo de UMA casa.
 *
 * O parâmetro `casa` é permitido aqui e proibido no questionário (RNF-28): a proibição
 * vale onde o *usuário* decidiria. Na tela de resultado o cliente já sabe qual grafo
 * está desenhando, porque a separação veio do servidor.
 */
export async function obterGrafo(casa: Casa = 'CAMARA'): Promise<Grafo> {
  return buscar<Grafo>(`${BASE}/grafo?casa=${casa}`);
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

// ═══════════════════════════════════════════════════════════════════
// Emendas parlamentares (Portal da Transparência)
// ═══════════════════════════════════════════════════════════════════

export type EmendaPorDestino = {
  localidade: string;
  empenhado: number;
  pago: number;
  quantidade: number;
};

export type EmendaPorFuncao = {
  funcao: string;
  empenhado: number;
  pago: number;
};

/**
 * 🔴 `empenhado` e `pago` são coisas DIFERENTES, e a distância entre eles é a
 * informação. Empenhar é reservar; pagar é o dinheiro sair.
 */
export type EmendasDoParlamentar = {
  ano: number;
  empenhado: number;
  pago: number;
  quantidade: number;
  porDestino: EmendaPorDestino[];
  porFuncao: EmendaPorFuncao[];
};

export async function obterEmendas(pessoaId: number): Promise<EmendasDoParlamentar> {
  return buscar<EmendasDoParlamentar>(`${BASE}/parlamentares/${pessoaId}/emendas`);
}

// ═══════════════════════════════════════════════════════════════════
// Financiamento de campanha (TSE)
// ═══════════════════════════════════════════════════════════════════

export type ReceitaPorFonte = {
  fonte: string;
  total: number;
  lancamentos: number;
};

export type DoadorDoParlamentar = {
  nome: string;
  total: number;
  /** ⚠️ Quando `true`, o documento está hasheado no banco — RNF-13. */
  pessoaFisica: boolean;
};

/**
 * 🔴 `fundoEspecial` (o "fundão", FEFC) e `fundoPartidario` são fundos DIFERENTES.
 * A API os entrega separados de propósito; somá-los é uma afirmação, e quem a fizer
 * que a assine.
 */
export type FinanciamentoDeCampanha = {
  anoEleicao: number;
  total: number;
  fundoEspecial: number;
  fundoPartidario: number;
  porFonte: ReceitaPorFonte[];
  maioresDoadores: DoadorDoParlamentar[];
};

export async function obterFinanciamento(
  pessoaId: number,
): Promise<FinanciamentoDeCampanha> {
  return buscar<FinanciamentoDeCampanha>(
    `${BASE}/parlamentares/${pessoaId}/financiamento`,
  );
}
