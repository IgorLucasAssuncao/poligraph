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
  /**
   * A última legislatura em que votou — vem na lista e na busca. Menor que a corrente
   * quer dizer que a pessoa já saiu.
   */
  legislatura?: number;
};

/**
 * ⚠️ `orientacaoDoGoverno` é nula com frequência, por TRÊS motivos diferentes que a
 * tela ⛔ não deve confundir: o Governo não orientou aquela votação, orientou
 * `Obstrução`/`Liberado` — que não são posição de mérito —, ou a casa é o Senado.
 */
export type VotoNaFicha = {
  votacaoId: string;
  data: string;
  /**
   * 🔴 O registro PROCESSUAL — "Aprovado o Substitutivo ao Projeto de Lei nº 4.133".
   * Diz o NÚMERO do projeto e não diz o assunto. Serve de reserva quando falta a ementa.
   */
  descricao: string | null;
  valor: number | null;
  orientacaoDoGoverno: string | null;
  /** ⭐ O que o projeto propõe. Nula no Senado inteiro — a ingestão é só da Câmara. */
  ementa: string | null;
  /** "PL 4133/2023" — a etiqueta que permite conferir na fonte. */
  materia: string | null;
  /**
   * 🔴 Sem isto a ementa MENTE. 43,2% das linhas desta lista são PROCEDIMENTAL: a
   * ementa é do projeto em pauta, mas o voto foi num requerimento. "Institui o Imposto
   * sobre Bens e Serviços" ao lado de um "Sim" faria o leitor concluir que a pessoa
   * votou a favor da reforma tributária — e ela votou sobre rito.
   */
  categoria: 'SUBSTANTIVA' | 'DESTAQUE' | 'PROCEDIMENTAL' | 'AUTORIDADE';
  /** A ficha de tramitação da proposição, na casa. */
  urlProposicao: string | null;
  /** O registro nominal da votação, com o voto de cada um. Só na Câmara. */
  urlRegistro: string | null;
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
  /** Todos os registros de voto da legislatura, inclusive sem posição — o total da lista. */
  nRegistrosDeVoto: number;
  votosRecentes: VotoNaFicha[];
  maisSimilares: Similar[];
  alinhamento: Alinhamento | null;
  /** "Ele vai às votações?" Nulo sem voto na legislatura. */
  presenca: Presenca | null;
  /** A página do parlamentar na própria casa. */
  urlFonte: string | null;
  /** PP4 — as redes que o parlamentar publicou. Vazia quando ⛔ publicou nenhuma. */
  redesSociais: RedeSocial[];
  /**
   * A legislatura que a ficha mostra: a pedida no endereço, se a pessoa votou nela; senão
   * a última em que votou. ⚠️ ⛔ É a corrente do site: o ex-deputado abre na dele.
   */
  legislatura: number | null;
  /** Todas as legislaturas em que votou, da mais recente para a mais antiga. */
  mandatos: Mandato[];
};

/** Uma legislatura em que a pessoa votou. Partido e UF são os do último voto DELA ali. */
export type Mandato = {
  legislatura: number;
  casa: Casa;
  anoInicial: number;
  partido: string;
  uf: string;
  nRegistrosDeVoto: number;
};

export type TipoRedeSocial = 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'YOUTUBE' | 'TIKTOK' | 'LINKEDIN' | 'OUTRA';

/** `fonte` diz de quando: a da Câmara é a lista atual; a do TSE, a da candidatura. */
export type RedeSocial = { rede: TipoRedeSocial; url: string; fonte: 'CAMARA' | 'TSE' };

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
  /**
   * A régua do resultado: quantos parlamentares foram comparados, e quanto o do meio da
   * lista concordou. Sem ela, "8 de 11" ⛔ diz se é muito.
   */
  escala: { comparados: number; medianoAcordos: number; medianoComparaveis: number };
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
  /** O poço: todas as perguntas curadas. */
  perguntasAtivas: number;
  porCasa: PanoramaDaCasa[];
  /** Quantas o cidadão responde, tiradas do poço. ⚠️ ⛔ é o mesmo número. */
  perguntasNoQuestionario: number;
};

export async function obterPanorama(): Promise<Panorama> {
  return buscar<Panorama>(`${BASE}/panorama`);
}

// ═══════════════════════════════════════════════════════════════════
// Parlamentares
// ═══════════════════════════════════════════════════════════════════

/**
 * Uma página da lista. `total` é o de todos os que passam no filtro; `partidos` e `ufs`
 * são as opções dos filtros, tiradas da lista inteira — ⛔ da página.
 */
export type PaginaDeParlamentares = {
  itens: Parlamentar[];
  pagina: number;
  tamanho: number;
  total: number;
  partidos: string[];
  ufs: string[];
  /** Quem tem outra em `legislatura` já saiu, e a tela diz de quando era. */
  legislaturaCorrente: number | null;
};

export type FiltroDaLista = {
  nome?: string;
  partido?: string;
  uf?: string;
  casa?: Casa;
  /** Inclui quem só votou em legislaturas passadas, cada um com o último mandato. */
  anteriores?: boolean;
  /** Mais votações registradas primeiro: quem tem mais dado para comparar. */
  ordem?: 'NOME' | 'VOTACOES';
  /** Começa em 1. */
  pagina?: number;
  tamanho?: number;
};

export async function listarParlamentares(filtro: FiltroDaLista = {}): Promise<PaginaDeParlamentares> {
  const query = new URLSearchParams(
    Object.entries(filtro)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  );

  return buscar<PaginaDeParlamentares>(`${BASE}/parlamentares?${query}`);
}

export async function obterFicha(id: number, legislatura?: number): Promise<Ficha> {
  const filtro = legislatura ? `?legislatura=${legislatura}` : '';
  return buscar<Ficha>(`${BASE}/parlamentares/${id}${filtro}`);
}

/**
 * Uma página de uma lista maior. `total` é o da lista inteira: a tela diz quantos faltam
 * em vez de cortar calada. `pagina` começa em 1.
 */
export type PaginaDe<T> = { itens: T[]; pagina: number; tamanho: number; total: number };

export async function obterNoticias(id: number, pagina = 1): Promise<PaginaDe<Noticia>> {
  return buscar<PaginaDe<Noticia>>(`${BASE}/parlamentares/${id}/noticias?pagina=${pagina}`);
}

/** Votos de uma legislatura da pessoa, do mais recente. A página 1 é a que vem na ficha. */
export async function listarVotos(
  id: number,
  pagina: number,
  tamanho: number,
  legislatura?: number | null,
): Promise<PaginaDe<VotoNaFicha>> {
  const filtro = legislatura ? `&legislatura=${legislatura}` : '';
  return buscar<PaginaDe<VotoNaFicha>>(
    `${BASE}/parlamentares/${id}/votos?pagina=${pagina}&tamanho=${tamanho}${filtro}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
// Seguir — 🔴 escreve dado sensível (LGPD art. 5º, II)
// ═══════════════════════════════════════════════════════════════════

/** Uma notícia do feed da página inicial, com quem a trouxe para o feed. */
export type NoticiaDeSeguido = {
  pessoaId: number;
  nome: string;
  urlFoto: string | null;
  noticia: Noticia;
};

/** As notícias de todos os seguidos numa requisição só — eram uma por seguido. */
export async function listarNoticiasDosSeguidos(): Promise<NoticiaDeSeguido[]> {
  return buscar<NoticiaDeSeguido[]>(`${BASE}/seguidos/noticias`);
}

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
  /** Quantas ligações mais fortes cada ponto mantém — o `k` da execução. */
  vizinhosPorNo: number;
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /**
   * As legislaturas em que a casa tem grafo, da mais recente. A que ⛔ teve dado suficiente
   * ⛔ está aqui, e a tela ⛔ a oferece.
   */
  legislaturasComGrafo: number[];
  /** As votações de plenário da legislatura desenhada, e quantas foram secretas. */
  votacoesDePlenario: number;
  secretasDePlenario: number;
};

/**
 * O grafo de UMA casa.
 *
 * O parâmetro `casa` é permitido aqui e proibido no questionário (RNF-28): a proibição
 * vale onde o *usuário* decidiria. Na tela de resultado o cliente já sabe qual grafo
 * está desenhando, porque a separação veio do servidor.
 */
export async function obterGrafo(casa: Casa = 'CAMARA', legislatura?: number): Promise<Grafo> {
  const filtro = legislatura ? `&legislatura=${legislatura}` : '';
  return buscar<Grafo>(`${BASE}/grafo?casa=${casa}${filtro}`);
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
  favorecidos: FavorecidosDaEmenda;
  pagamentosPorMes: PagamentoPorMes[];
  convenios: ConveniosDaEmenda;
  cidades: CidadesDaEmenda;
};

/** As cidades que receberam, pela sede de quem recebeu — ⛔ pela localidade declarada. */
export type CidadesDaEmenda = {
  quantidade: number;
  maiores: { municipio: Municipio; recebido: number }[];
};

export type FavorecidoDaEmenda = {
  nome: string;
  naturezaJuridica: string | null;
  uf: string | null;
  municipio: string | null;
  recebido: number;
  /** Só pessoa jurídica que tem página de entidade; empresário individual e unidade gestora vêm sem. */
  cnpj?: string | null;
};

/**
 * Quem recebeu, somado desde o primeiro pagamento — por isso `recebido` pode passar do
 * `pago` do ano: inclui o que foi pago nos anos seguintes. `ultimoMes` diz até quando.
 *
 * 🔴 Intermediário, pessoas e sem identificação ficam FORA de `maiores`, com o valor
 * declarado ao lado. Pessoa ⛔ chega com nome: o banco nem o guarda.
 */
export type FavorecidosDaEmenda = {
  recebido: number;
  viaIntermediario: number;
  aPessoas: number;
  semIdentificacao: number;
  /** `"2026-09-01"` — o mês, no primeiro dia. */
  ultimoMes: string | null;
  /** Quantos favorecidos a lista teria inteira; `maiores` traz os primeiros. */
  identificados: number;
  maiores: FavorecidoDaEmenda[];
};

export type PagamentoPorMes = {
  /** `"2025-03-01"` — o mês, no primeiro dia. */
  mes: string;
  valor: number;
};

/**
 * 🔴 `valor` é do convênio INTEIRO, e ele pode receber emendas de vários autores —
 * `emendasQueFinanciam` diz quantas. Somar a lista ⛔ dá o que o parlamentar destinou.
 */
export type ConvenioDaEmenda = {
  numero: string;
  convenente: string;
  objeto: string | null;
  dataPublicacao: string;
  valor: number;
  emendasQueFinanciam: number;
  /** O convênio no Portal da Transparência. */
  urlFonte: string;
};

export type ConveniosDaEmenda = {
  quantidade: number;
  maiores: ConvenioDaEmenda[];
};

export async function obterEmendas(pessoaId: number): Promise<EmendasDoParlamentar> {
  return buscar<EmendasDoParlamentar>(`${BASE}/parlamentares/${pessoaId}/emendas`);
}

/** Uma emenda, somadas as linhas dela, com o link no Portal. */
export type EmendaNaLista = {
  codigo: string;
  tipo: string | null;
  localidade: string | null;
  /** Mais de 1 quando a emenda se reparte entre destinos. */
  localidades: number;
  funcao: string | null;
  empenhado: number;
  pago: number;
  urlFonte: string;
};

/** As emendas do ano, uma a uma — o caminho de volta à fonte de cada soma. */
export async function listarEmendas(
  pessoaId: number, ano: number, pagina: number, tamanho: number,
): Promise<PaginaDe<EmendaNaLista>> {
  return buscar<PaginaDe<EmendaNaLista>>(
    `${BASE}/parlamentares/${pessoaId}/emendas/lista?ano=${ano}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

/** Um lançamento da cota, com o documento fiscal quando a casa o publica. */
export type LancamentoDaCota = {
  data: string | null;
  mes: number;
  categoria: string;
  fornecedor: string | null;
  valor: number;
  urlDocumento: string | null;
};

/** Os lançamentos da cota no ano, do mais recente, nota por nota. */
export async function listarLancamentos(
  pessoaId: number, ano: number, pagina: number, tamanho: number,
): Promise<PaginaDe<LancamentoDaCota>> {
  return buscar<PaginaDe<LancamentoDaCota>>(
    `${BASE}/parlamentares/${pessoaId}/gastos/lancamentos?ano=${ano}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

/** Quem recebeu as emendas do ano, em páginas. A página 1 é a da ficha. */
export async function listarFavorecidos(
  pessoaId: number, ano: number, pagina: number, tamanho: number,
): Promise<PaginaDe<FavorecidoDaEmenda>> {
  return buscar<PaginaDe<FavorecidoDaEmenda>>(
    `${BASE}/parlamentares/${pessoaId}/emendas/favorecidos?ano=${ano}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

/** Os convênios das emendas do ano, em páginas. A página 1 é a da ficha. */
export async function listarConvenios(
  pessoaId: number, ano: number, pagina: number, tamanho: number,
): Promise<PaginaDe<ConvenioDaEmenda>> {
  return buscar<PaginaDe<ConvenioDaEmenda>>(
    `${BASE}/parlamentares/${pessoaId}/emendas/convenios?ano=${ano}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

// ═══════════════════════════════════════════════════════════════════
// Governo federal — quem governa, de onde veio o dinheiro e para onde foi
// ═══════════════════════════════════════════════════════════════════

export type PessoaDaGestao = { nome: string; nomeDeUrna: string; partido: string };

/** Presidente e vice eleitos, segundo o TSE. O mandato é contado em anos. */
export type Gestao = {
  eleicao: number;
  primeiroAno: number;
  ultimoAno: number;
  presidente: PessoaDaGestao;
  vice: PessoaDaGestao;
  coligacao: string | null;
};

export type OrigemDaReceita = { origem: string; prevista: number; realizada: number };

/**
 * 🔴 `emissaoDeDivida` ⛔ é arrecadação: é dinheiro emprestado, e em 2025 quase iguala
 * o `arrecadado`. Somar os dois faria a arrecadação parecer o dobro.
 */
export type Arrecadacao = {
  arrecadado: number;
  porOrigem: OrigemDaReceita[];
  emissaoDeDivida: number;
  outrasReceitasDeCapital: number;
};

/**
 * `pago` é o do próprio ano; `restosAPagarPagos`, o de despesas de anos anteriores pago
 * neste. O que saiu no ano é a soma dos dois.
 */
export type AreaDaDespesa = {
  codigo: string;
  nome: string;
  dotacaoAtualizada: number;
  empenhado: number;
  pago: number;
  restosAPagarPagos: number;
  dotacaoCompleta: boolean;
};

export type GrupoDeEncargo = 'TRANSFERENCIAS' | 'SERVICO_DA_DIVIDA' | 'REFINANCIAMENTO' | 'OUTROS';

export type Encargo = { grupo: GrupoDeEncargo; pago: number; restosAPagarPagos: number };

export type Despesa = {
  empenhadoAcimaDaDotacao: number;
  areas: AreaDaDespesa[];
  encargos: Encargo[];
};

/**
 * O governo federal num período. Os totais somam os anos; `porAno` traz os três números
 * de cada um, para comparar sem trocar o filtro.
 */
export type Governo = {
  /** Mais de uma quando o período atravessa uma posse. */
  gestoes: Gestao[];
  periodo: Periodo;
  /** A data em que o Portal gerou os arquivos — até onde vai o dado do ano corrente. */
  geradoEm: string;
  /** O ano do período que ainda está correndo; nulo quando todos estão fechados. */
  emAndamento: number | null;
  anosDisponiveis: number[];
  arrecadacao: Arrecadacao;
  despesa: Despesa;
  /** Nulo enquanto a carga do gasto sigiloso ainda ⛔ rodou para o período. */
  sigilo: Sigilo | null;
  porAno: GovernoNoAno[];
  /** Todas as gestões com dado, qualquer que seja o período: os atalhos do seletor. */
  gestoesDisponiveis: Gestao[];
};

/** `gastou` ⛔ inclui a rolagem da dívida, que é dívida paga com dívida nova. */
export type GovernoNoAno = { ano: number; arrecadou: number; gastou: number; pegouEmprestado: number; fechado: boolean };

/**
 * O gasto que o Portal publica sem dizer em quê. Cartão e ação ⛔ se somam: o cartão
 * sigiloso esconde quem comprou, de quem e quando; a ação sigilosa esconde a finalidade.
 */
export type Sigilo = {
  cartaoSigiloso: number;
  cartaoTotal: number;
  transacoesSigilosas: number;
  acaoSigilosa: number;
  meses: number;
  porOrgao: { orgao: string; cartao: number; cartaoTotal: number; acao: number }[];
};

/** Sem período, todos os anos. `null` quando a carga ainda ⛔ rodou. */
export async function obterGoverno(periodo?: Periodo): Promise<Governo | null> {
  const url = periodo ? `${BASE}/governo?de=${periodo.de}&ate=${periodo.ate}` : `${BASE}/governo`;
  const resposta = await fetch(url, { credentials: 'include' });

  if (resposta.status === 404) return null;
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(`Falha ao consultar ${url} (${resposta.status}).`);

  return resposta.json();
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

// ═══════════════════════════════════════════════════════════════════
// Metodologia — os parâmetros do método, de onde o cálculo os lê
// ═══════════════════════════════════════════════════════════════════

export type CasaNaMetodologia = {
  casa: Casa;
  legislatura: number;
  votacoes: number;
  votacoesSecretas: number;
  analiseConcluidaEm: string | null;
  /** Os parâmetros da execução que desenhou o grafo. Nulos em execução antiga. */
  vizinhosPorNo: number | null;
  minimoVotacoesComuns: number | null;
  razaoRecencia: number | null;
  pesoDestaque: number | null;
  pesoAutoridade: number | null;
};

export type Metodologia = {
  questionario: {
    perguntasDaCamara: number;
    aberturaDaCamara: number;
    desempateDaCamara: number;
    perguntasDoSenado: number;
    fracaoMinimaDeRespostas: number;
    minimoDeRespostas: number;
  };
  afinidade: { quantidadeExibida: number; vizinhosParaPosicionar: number };
  casas: CasaNaMetodologia[];
};

export async function obterMetodologia(): Promise<Metodologia> {
  return buscar<Metodologia>(`${BASE}/metodologia`);
}

/**
 * Se o site pode ser lido sem login. Desligado durante o período eleitoral (RNF-17); a
 * falha também conta como desligado — melhor pedir login a mais que abrir sem querer.
 */
export async function obterAcesso(): Promise<{ leituraPublica: boolean }> {
  try {
    return await buscar<{ leituraPublica: boolean }>(`${BASE}/acesso`);
  } catch {
    return { leituraPublica: false };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Mapa das emendas — pela sede de quem recebeu
// ═══════════════════════════════════════════════════════════════════

/** Os anos de emenda considerados, inclusive nas duas pontas. Sem dado, `{ de: 0, ate: 0 }`. */
export type Periodo = { de: number; ate: number };

/** Uma UF no mapa. `codigoUf` é o código IBGE de dois dígitos, o `codarea` da malha. */
export type RecebidoNaUf = { uf: string; codigoUf: string; recebido: number; municipios: number };

/**
 * 🔴 `noMapa` ⛔ é `recebido`. O que passou pelo intermediário (Banco do Brasil) e o pago a
 * pessoa ou sem identificação ⛔ têm sede, e ficam declarados ao lado do mapa.
 */
export type MapaDoBrasil = {
  periodo: Periodo;
  anosDisponiveis: number[];
  recebido: number;
  noMapa: number;
  viaIntermediario: number;
  semSede: number;
  porUf: RecebidoNaUf[];
};

export type RecebidoNoMunicipio = { codigoIbge: string; nome: string; recebido: number };

/** TODAS as cidades da UF; a que nada recebeu vem com zero. */
export type MapaDoEstado = {
  uf: string;
  periodo: Periodo;
  recebido: number;
  porMunicipio: RecebidoNoMunicipio[];
};

export type Municipio = { codigoIbge: string; nome: string; uf: string };

/** Um deputado ou senador. Sem `pessoaId`, o autor ainda ⛔ foi ligado a uma ficha. */
export type ParlamentarQueMandou = {
  pessoaId: number | null;
  nome: string;
  partido: string | null;
  uf: string | null;
  casa: Casa | null;
  urlFoto: string | null;
  recebido: number;
  emendas: number;
};

export type TipoAutorColetivo = 'BANCADA' | 'COMISSAO' | 'OUTRO';

/** Bancada estadual ou comissão: autor de emenda que ⛔ é uma pessoa. */
export type ColetivoQueMandou = { tipo: TipoAutorColetivo; nome: string; recebido: number; emendas: number };

/**
 * ⚠️ `naPropriaCidade` é o que foi à prefeitura ou a órgão municipal; o resto, a entidades
 * com sede ali. As duas listas longas trazem a primeira página.
 */
export type EmendasDoMunicipio = {
  municipio: Municipio;
  periodo: Periodo;
  anosDisponiveis: number[];
  recebido: number;
  naPropriaCidade: number;
  deParlamentares: number;
  parlamentares: PaginaDe<ParlamentarQueMandou>;
  coletivos: ColetivoQueMandou[];
  favorecidos: PaginaDe<FavorecidoDaEmenda>;
  convenios: ConveniosDaCidade;
};

/**
 * Os convênios de quem tem sede na cidade, das emendas do período.
 *
 * ⚠️ `aLiberar` soma só os em execução: nos outros a execução acabou, e a diferença ⛔ é
 * dinheiro que ainda vai chegar.
 */
export type ConveniosDaCidade = {
  quantidade: number;
  emExecucao: number;
  combinado: number;
  liberado: number;
  aLiberar: number;
  lista: PaginaDe<ConvenioDaCidade>;
};

export type ConvenioDaCidade = {
  numero: string;
  objeto: string | null;
  convenente: string;
  cnpj: string;
  situacao: string | null;
  dataPublicacao: string;
  valor: number;
  valorLiberado: number | null;
  urlFonte: string;
};

/** Sem período, todos os anos. */
function comPeriodo(url: string, periodo?: Periodo, extra?: Record<string, string>): string {
  const busca = new URLSearchParams(extra);
  if (periodo) {
    busca.set('de', String(periodo.de));
    busca.set('ate', String(periodo.ate));
  }
  const texto = busca.toString();
  return texto ? `${url}?${texto}` : url;
}

export async function obterMapaDoBrasil(periodo?: Periodo): Promise<MapaDoBrasil> {
  return buscar<MapaDoBrasil>(comPeriodo(`${BASE}/mapa/emendas`, periodo));
}

export async function obterMapaDoEstado(uf: string, periodo?: Periodo): Promise<MapaDoEstado> {
  return buscar<MapaDoEstado>(comPeriodo(`${BASE}/mapa/emendas/${uf}`, periodo));
}

export async function buscarMunicipios(busca: string): Promise<Municipio[]> {
  return buscar<Municipio[]>(`${BASE}/municipios?busca=${encodeURIComponent(busca)}`);
}

export async function obterEmendasDoMunicipio(codigoIbge: string, periodo?: Periodo): Promise<EmendasDoMunicipio> {
  return buscar<EmendasDoMunicipio>(comPeriodo(`${BASE}/municipios/${codigoIbge}/emendas`, periodo));
}

export async function listarParlamentaresDoMunicipio(
  codigoIbge: string,
  periodo: Periodo | undefined,
  pagina: number,
): Promise<PaginaDe<ParlamentarQueMandou>> {
  return buscar<PaginaDe<ParlamentarQueMandou>>(
    comPeriodo(`${BASE}/municipios/${codigoIbge}/emendas/parlamentares`, periodo, { pagina: String(pagina) }),
  );
}

export async function listarFavorecidosDoMunicipio(
  codigoIbge: string,
  periodo: Periodo | undefined,
  pagina: number,
): Promise<PaginaDe<FavorecidoDaEmenda>> {
  return buscar<PaginaDe<FavorecidoDaEmenda>>(
    comPeriodo(`${BASE}/municipios/${codigoIbge}/emendas/favorecidos`, periodo, { pagina: String(pagina) }),
  );
}

// ═══════════════════════════════════════════════════════════════════
// Entidades — quem recebeu emenda, por CNPJ — e a busca do cabeçalho
// ═══════════════════════════════════════════════════════════════════

export type GrupoDeEntidade = 'MUNICIPIO' | 'ESTADO' | 'SEM_FINS_LUCRATIVOS' | 'EMPRESA' | 'OUTRO';

export type EntidadeNaLista = {
  cnpj: string;
  nome: string;
  naturezaJuridica: string | null;
  grupo: GrupoDeEntidade;
  sede: Municipio | null;
  recebido: number;
  emendas: number;
};

export type ParlamentarNaCota = {
  pessoaId: number;
  nome: string;
  partido: string | null;
  casa: Casa | null;
  total: number;
  lancamentos: number;
};

/** ⚠️ Estar na cota e na emenda ⛔ é indício de nada: a tela diz isso ao lado (RNF-16). */
export type CotaDaEntidade = { total: number; lancamentos: number; porParlamentar: ParlamentarNaCota[] };

export type Entidade = EntidadeNaLista & {
  urlFonte: string;
  porAno: { ano: number; recebido: number }[];
  deParlamentares: number;
  parlamentares: PaginaDe<ParlamentarQueMandou>;
  coletivos: ColetivoQueMandou[];
  naCota: CotaDaEntidade | null;
  convenios: PaginaDe<ConvenioDaEntidade>;
};

export type Busca = {
  parlamentares: Parlamentar[];
  municipios: Municipio[];
  entidades: EntidadeNaLista[];
  /** Quem tem outra `legislatura` já saiu. Os em exercício vêm primeiro. */
  legislaturaCorrente?: number | null;
};

export async function listarEntidades(filtro: {
  busca?: string;
  grupo?: GrupoDeEntidade | null;
  pagina?: number;
}): Promise<PaginaDe<EntidadeNaLista>> {
  const busca = new URLSearchParams();
  if (filtro.busca) busca.set('busca', filtro.busca);
  if (filtro.grupo) busca.set('grupo', filtro.grupo);
  if (filtro.pagina) busca.set('pagina', String(filtro.pagina));
  const texto = busca.toString();
  return buscar<PaginaDe<EntidadeNaLista>>(`${BASE}/entidades${texto ? `?${texto}` : ''}`);
}

/** `null` quando o CNPJ ⛔ recebeu emenda — a página diz isso em vez de quebrar. */
export async function obterEntidade(cnpj: string): Promise<Entidade | null> {
  const resposta = await fetch(`${BASE}/entidades/${cnpj}`, { credentials: 'include' });
  if (resposta.status === 404) return null;
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(`Falha ao consultar a entidade (${resposta.status}).`);
  return resposta.json();
}

export async function listarParlamentaresDaEntidade(
  cnpj: string,
  pagina: number,
): Promise<PaginaDe<ParlamentarQueMandou>> {
  return buscar<PaginaDe<ParlamentarQueMandou>>(`${BASE}/entidades/${cnpj}/parlamentares?pagina=${pagina}`);
}

export async function buscarTudo(termo: string): Promise<Busca> {
  return buscar<Busca>(`${BASE}/busca?q=${encodeURIComponent(termo)}`);
}

/** Um convênio que a entidade assinou: o combinado e quanto já saiu. Ligado pelo CNPJ do convenente. */
export type ConvenioDaEntidade = {
  numero: string;
  objeto: string | null;
  situacao: string | null;
  dataPublicacao: string;
  valor: number;
  valorLiberado: number | null;
  urlFonte: string;
};

export async function listarConveniosDaEntidade(cnpj: string, pagina: number): Promise<PaginaDe<ConvenioDaEntidade>> {
  return buscar<PaginaDe<ConvenioDaEntidade>>(`${BASE}/entidades/${cnpj}/convenios?pagina=${pagina}`);
}

// ═══════════════════════════════════════════════════════════════════
// Patrimônio declarado ao TSE (PP3)
// ═══════════════════════════════════════════════════════════════════

/** 🔴 Só tipo e valor: a descrição de cada bem traz endereço, e ⛔ chega aqui. */
export type DeclaracaoDeBens = {
  anoEleicao: number;
  total: number;
  bens: number;
  porTipo: { tipo: string; valor: number; quantidade: number }[];
};

export async function obterPatrimonio(pessoaId: number): Promise<DeclaracaoDeBens[]> {
  const resposta = await buscar<{ declaracoes: DeclaracaoDeBens[] }>(`${BASE}/parlamentares/${pessoaId}/patrimonio`);
  return resposta.declaracoes;
}

/**
 * Em quantas votações de plenário o parlamentar participou. Sempre com a base.
 *
 * ⚠️ Na Câmara, `ausenteJustificado` é nulo: a casa ⛔ publica a justificativa no registro
 * de votação, e licença (para ser ministro, por exemplo) aparece como ausência.
 */
export type Presenca = {
  presente: number;
  votacoes: number;
  ausente: number;
  ausenteJustificado: number | null;
  justificativaPublicada: boolean;
  desde: string;
  ate: string;
};

export async function listarConveniosDaCidade(
  codigoIbge: string,
  periodo: Periodo | undefined,
  pagina: number,
): Promise<PaginaDe<ConvenioDaCidade>> {
  const resposta = await buscar<ConveniosDaCidade>(
    comPeriodo(`${BASE}/municipios/${codigoIbge}/emendas/convenios`, periodo, { pagina: String(pagina) }),
  );
  return resposta.lista;
}
