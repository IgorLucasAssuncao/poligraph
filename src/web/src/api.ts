import { BASE_DA_API, CABECALHO_DO_SITE, EVENTO_SEGUIDOS_MUDARAM } from './constantes';
import { TEXTOS_DA_API } from './textos/api';
import { VERSAO_CONSENTIMENTO } from './textos-legais';

/**
 * Cliente da API.
 *
 * Não existe token aqui. Nada de `localStorage.setItem('token', …)`, nada de header
 * `Authorization`, nada de lógica de renovação — o cookie de sessão é `HttpOnly` e o
 * navegador o envia sozinho. `credentials: 'include'` é tudo que se precisa.
 */

const BASE = BASE_DA_API;

/**
 * As duas casas do Congresso. Nunca há um terceiro valor.
 *
 * Tipos
 */
export type Casa = 'CAMARA' | 'SENADO';

export type Usuario = { nome: string | null; fotoUrl: string | null };

export type Parlamentar = {
  /** ATENÇÃO: Vazio quando a pessoa ainda não tem voto — a casa vem do mandato. */
  casa: Casa | '';
  idPessoa: number;
  nome: string;
  partido: string;
  uf: string;
  nVotacoes: number;
  /** RISCO: URL na Câmara — não a imagem não é rehospedada. */
  urlFoto?: string | null;
  /**
   * A última legislatura em que votou — vem na lista e na busca. Menor que a corrente
   * quer dizer que a pessoa já saiu.
   */
  legislatura?: number;
  /**
   * Se está na lista oficial de quem está em exercício: só esses podem ser seguidos (decisão do
   * autor, 2026-10-18). Vem na página da lista; ausente nas listas internas.
   */
  emExercicio?: boolean;
};

/**
 * ATENÇÃO: `orientacaoDoGoverno` é nula com frequência, por TRÊS motivos diferentes que a
 * tela não deve confundir: o Governo não orientou aquela votação, orientou
 * `Obstrução`/`Liberado` — que não são posição de mérito —, ou a casa é o Senado.
 */
export type VotoNaFicha = {
  votacaoId: string;
  data: string;
  /**
   * RISCO: O registro PROCESSUAL — "Aprovado o Substitutivo ao Projeto de Lei nº 4.133".
   * Diz o NÚMERO do projeto e não diz o assunto. Serve de reserva quando falta a ementa.
   */
  descricao: string | null;
  valor: number | null;
  orientacaoDoGoverno: string | null;
  /** DECISÃO: O que o projeto propõe. Nula no Senado inteiro — a ingestão é só da Câmara. */
  ementa: string | null;
  /** "PL 4133/2023" — a etiqueta que permite conferir na fonte. */
  materia: string | null;
  /**
   * RISCO: Sem isto a ementa MENTE. 43,2% das linhas desta lista são PROCEDIMENTAL: a
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
  idPessoa: number;
  nome: string;
  partido: string;
  valor: number;
  comuns: number;
};

/**
 * Com que frequência o parlamentar votou como pediram a ele.
 *
 * ATENÇÃO: Cada proporção vem com a BASE. 80% sobre 15 votações e 80% sobre 900 são
 * afirmações de força muito diferente, e a tela nunca mostra uma sem a outra.
 *
 * Não Nulo no Senado inteiro: lá não existe orientação de bancada publicada.
 */
export type Alinhamento = {
  governismo: number | null;
  baseGovernismo: number;
  disciplina: number | null;
  baseDisciplina: number;
  /** Contra qual sigla a disciplina foi medida — quem trocou de partido tem a do voto mais recente. */
  partidoMedido: string | null;
  /** A mediana da casa no mesmo grafo: a escala do número, sem juízo. */
  medianaGovernismo?: number | null;
  medianaDisciplina?: number | null;
};

export type Ficha = {
  idPessoa: number;
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
  /** PP4 — as redes que o parlamentar publicou. Vazia quando não publicou nenhuma. */
  redesSociais: RedeSocial[];
  /**
   * A legislatura que a ficha mostra: a pedida no endereço, se a pessoa votou nela; senão
   * a última em que votou. ATENÇÃO: não É a corrente do site: o ex-deputado abre na dele.
   */
  legislatura: number | null;
  /** Todas as legislaturas em que votou, da mais recente para a mais antiga. */
  mandatos: Mandato[];
  /** Se está na lista oficial de quem está em exercício: só assim pode ser seguido. */
  emExercicio: boolean;
};

/** Uma legislatura em que a pessoa votou. Partido e UF são os do último voto DELA ali. */
export type Mandato = {
  legislatura: number;
  casa: Casa;
  anoInicial: number;
  partido: string;
  uf: string;
  nRegistrosDeVoto: number;
  /** `"2023-03-14"`. Quem saiu antes do fim ou entrou como suplente não votou a legislatura inteira. */
  primeiroVoto: string;
  ultimoVoto: string;
};

export type TipoRedeSocial = 'INSTAGRAM' | 'FACEBOOK' | 'X' | 'YOUTUBE' | 'TIKTOK' | 'LINKEDIN' | 'OUTRA';

/** `fonte` diz de quando: a da Câmara é a lista atual; a do TSE, a da candidatura. */
export type RedeSocial = { rede: TipoRedeSocial; url: string; fonte: 'CAMARA' | 'TSE' };

export type Pergunta = {
  idPergunta: string;
  texto: string;
  ordem: number;
  /**
   * Comparecimento na votação. NÃO é o placar — revelar a divisão antes de a pessoa
   * responder induziria conformidade. Ver `PerguntaPublica` na API.
   */
  totalVotos: number;
  /** Quantos parlamentares a base tem — o denominador do painel. */
  totalPossivel: number;
};

/** +1 concordo · -1 discordo · 0 não sei */
export type Resposta = 1 | -1 | 0;

export type ParlamentarAfim = {
  idPessoa: number;
  nome: string;
  partido: string;
  uf: string;
  /** DECISÃO: acordos e comparáveis, nunca percentual — a frase "X de Y" é montada aqui */
  acordos: number;
  comparaveis: number;
  /**
   * DECISÃO: Os ids das perguntas que produziram o "X de Y". Sem eles o número não é
   * conferível: não dá para saber se os acordos foram nas perguntas que importam para
   * quem responde ou nas de data comemorativa.
   *
   * ATENÇÃO: Só vêm preenchidos para os que aparecem na tela — calcular para os ~640 do
   * cálculo seria trabalho jogado fora.
   */
  acordou: string[];
  discordou: string[];
};

/**
 * RISCO: `baseDeVotacoes` existe para a tela poder ser franca: a posição do cidadão vale
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
   * lista concordou. Sem ela, "8 de 11" Não diz se é muito.
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
  /** U15: o estado das listas; nulo é o país inteiro. */
  uf?: string | null;
};

/**
 * O rótulo de cada casa na tela. A API devolve a casa; a redação é do front.
 *
 * ATENÇÃO: `nome` é a instituição, `plural`/`singular` são as pessoas. São usos
 * diferentes: “Senado Federal” encabeça a figura, “104 senadores” a descreve.
 */
export const NOME_DA_CASA: Record<
  Casa,
  { nome: string; /** O nome com a preposição: "da Câmara dos Deputados", "do Senado Federal". */ doNome: string; plural: string; singular: string }
> = {
  CAMARA: TEXTOS_DA_API.casas.CAMARA,
  SENADO: TEXTOS_DA_API.casas.SENADO,
};

/** A API pediu o consentimento de seguir (428). */
export class ConsentimentoNecessarioError extends Error {
  constructor() {
    super(TEXTOS_DA_API.erros.faltaConsentimento);
  }
}

export class NaoAutenticadoError extends Error {
  constructor() {
    super(TEXTOS_DA_API.erros.sessaoExpirada);
  }
}

/**
 * ATENÇÃO: sem "parameter property": o projeto usa `erasableSyntaxOnly`
 */
export class RespostasInsuficientesError extends Error {
  readonly minimo: number;

  constructor(minimo: number) {
    super(TEXTOS_DA_API.erros.respostasInsuficientes);
    this.minimo = minimo;
  }
}

/**
 * Devolve o usuário logado, ou `null` se não houver sessão.
 *
 * Sessão
 */
export async function quemSouEu(): Promise<Usuario | null> {
  const resposta = await fetch(`${BASE}/auth/eu`, { credentials: 'include' });

  if (resposta.status === 401) return null;
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.sessaoNaoVerificada);

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
 * ATENÇÃO: Vai SEM identificação: o servidor grava sem `usuario_id`, de propósito.
 * Responde "o instrumento acerta?" sem responder "o que o Fulano pensa?".
 */
export async function registrarAvaliacao(avaliacao: Avaliacao): Promise<void> {
  const resposta = await fetch(`${BASE}/avaliacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
    body: JSON.stringify(avaliacao),
    credentials: 'include',
  });

  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.avaliacao(resposta.status));
}

/** RISCO: LGPD art. 18, VI — apaga conta, lista de acompanhados e consentimentos. */
export async function excluirConta(): Promise<void> {
  await semCorpo(`${BASE}/auth/conta`, 'DELETE');
}

export async function sair(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: 'POST', headers: CABECALHO_DO_SITE, credentials: 'include' });
}

/**
 * Panorama — o tamanho da base
 */
export type PanoramaDaCasa = {
  casa: Casa;
  parlamentares: number;
  /** Só as com voto nominal — as que o cálculo usa (Pendência 68). */
  votacoes: number;
  /** Registradas pela casa sem a lista de quem votou como. Não Entram em `votacoes`. */
  votacoesSemVotoNominal: number;
  /** RISCO: O sigilo do Senado é achado do trabalho, não detalhe: 239 de 421. */
  votacoesSecretas: number;
  votosComPosicao: number;
  comunidades: number;
  ligacoes: number;
  /** As de plenário decididas por votação simbólica, sem voto de cada um. Nula sem contagem (o Senado). */
  votacoesSimbolicas?: number | null;
  /** A votação aberta mais recente, para o painel: comparecimento sobre o número de cadeiras, sem direção. */
  ultima?: { data: string; materia: string | null; ementa: string | null; posicionados: number; cadeiras: number } | null;
};

/** ATENÇÃO: `legislatura` é nula em base sem votação — o estado antes do primeiro ETL. */
export type Panorama = {
  legislatura: number | null;
  /** O poço: todas as perguntas curadas. */
  perguntasAtivas: number;
  porCasa: PanoramaDaCasa[];
  /** Quantas o cidadão responde, tiradas do poço. ATENÇÃO: não é o mesmo número. */
  perguntasNoQuestionario: number;
  /** A cota e o pago em emendas nos anos da legislatura, das duas casas; nulo sem carga. */
  dinheiro: { primeiroAno: number; ultimoAno: number; cota: number; emendasPagas: number } | null;
};

/** Sem legislatura, a corrente. Uma fora da base responde 404. */
export async function obterPanorama(legislatura?: number): Promise<Panorama> {
  return buscar<Panorama>(`${BASE}/panorama${legislatura ? `?legislatura=${legislatura}` : ''}`);
}

/** Uma legislatura da base. Sai das votações: sem votação ingerida, não aparece. */
export type Legislatura = {
  numero: number;
  anoInicial: number;
  anoFinal: number;
  /** A maior da base — a que o site mostra quando ninguém escolhe outra. */
  corrente: boolean;
  casas: Casa[];
};

/** Da mais recente para a mais antiga. */
export async function listarLegislaturas(): Promise<Legislatura[]> {
  return buscar<Legislatura[]>(`${BASE}/legislaturas`);
}

/**
 * Uma página da lista. `total` é o de todos os que passam no filtro; `partidos` e `ufs`
 * são as opções dos filtros, tiradas da lista inteira — não da página.
 *
 * Parlamentares
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
  /** Só quem votou nesta legislatura. Sem ela, a corrente. */
  legislatura?: number;
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

export async function obterFicha(idPessoa: number, legislatura?: number): Promise<Ficha> {
  const filtro = legislatura ? `?legislatura=${legislatura}` : '';
  return buscar<Ficha>(`${BASE}/parlamentares/${idPessoa}${filtro}`);
}

/**
 * Uma página de uma lista maior. `total` é o da lista inteira: a tela diz quantos faltam
 * em vez de cortar calada. `pagina` começa em 1.
 */
export type PaginaDe<T> = { itens: T[]; pagina: number; tamanho: number; total: number };

/**
 * Votos de uma legislatura da pessoa, do mais recente. A página 1 é a que vem na ficha.
 *
 * `busca` procura na ementa, na descrição e na matéria, sem diferença de caixa nem de
 * acento; com ela, `total` é o dos encontrados. Menos de 2 letras não filtram.
 */
export async function listarVotos(
  idPessoa: number,
  pagina: number,
  tamanho: number,
  legislatura?: number | null,
  busca?: string,
  semRito = false,
): Promise<PaginaDe<VotoNaFicha>> {
  const filtro =
    (legislatura ? `&legislatura=${legislatura}` : '') +
    (busca ? `&busca=${encodeURIComponent(busca)}` : '') +
    (semRito ? '&semRito=true' : '');
  return buscar<PaginaDe<VotoNaFicha>>(
    `${BASE}/parlamentares/${idPessoa}/votos?pagina=${pagina}&tamanho=${tamanho}${filtro}`,
  );
}

/**
 * Seguir — RISCO: escreve dado sensível (LGPD art. 5º, II)
 */
export async function listarSeguidos(): Promise<Parlamentar[]> {
  const seguidos = await buscar<
    { idPessoa: number; nome: string; casa: Parlamentar['casa']; partido: string; uf: string; urlFoto: string | null }[]
  >(`${BASE}/seguidos`);

  return seguidos.map((s) => ({ ...s, nVotacoes: 0 }));
}

/** DECISÃO: PUT: seguir duas vezes é o mesmo que seguir uma. */
/**
 * Segue, mandando a versão do texto de consentimento que a tela mostra.
 *
 * Sem consentimento vivo nessa versão a API responde 428, que vira {@link ConsentimentoNecessarioError};
 * a tela pergunta e chama de novo com `aceite`.
 */
export async function seguir(idPessoa: number, aceite = false): Promise<void> {
  const consulta = new URLSearchParams({ versao: VERSAO_CONSENTIMENTO });
  if (aceite) consulta.set('aceite', 'true');
  const url = `${BASE}/seguidos/${idPessoa}?${consulta}`;
  const resposta = await fetch(url, { method: 'PUT', headers: CABECALHO_DO_SITE, credentials: 'include' });

  if (resposta.status === 428) throw new ConsentimentoNecessarioError();
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.falhaEm(url, resposta.status));
  avisarQueSeguidosMudaram();
}

/** Quem saiu da lista de seguidos por ter deixado o mandato, para o aviso do site. */
export type SeguidosEncerrados = {
  /** A legislatura que começou, quando a saída foi na virada; nula em renúncia, cassação ou licença. */
  novaLegislatura: number | null;
  parlamentares: { idPessoa: number; nome: string }[];
};

export async function obterSeguidosEncerrados(): Promise<SeguidosEncerrados> {
  return buscar<SeguidosEncerrados>(`${BASE}/seguidos/encerrados`);
}

/** A pessoa viu o aviso: a API apaga o registro de quem ela seguia. */
export async function dispensarSeguidosEncerrados(): Promise<void> {
  await semCorpo(`${BASE}/seguidos/encerrados`, 'DELETE');
}

/** Revoga o consentimento de seguir; a API apaga a lista junto. */
export async function revogarConsentimentoDeSeguir(): Promise<void> {
  await semCorpo(`${BASE}/seguidos/consentimento`, 'DELETE');
  avisarQueSeguidosMudaram();
}

export async function deixarDeSeguir(idPessoa: number): Promise<void> {
  await semCorpo(`${BASE}/seguidos/${idPessoa}`, 'DELETE');
  avisarQueSeguidosMudaram();
}

/**
 * Avisa quem mostra novidades que a lista mudou (Pendência 89). Sem isso, o sininho guardava as
 * novidades de quando a página abriu, e quem deixava de seguir alguém continuava vendo os fatos dele
 * até recarregar.
 */
function avisarQueSeguidosMudaram(): void {
  window.dispatchEvent(new Event(EVENTO_SEGUIDOS_MUDARAM));
}

/**
 * O bloco de abertura e o tamanho do questionário completo.
 *
 * ATENÇÃO: `total` é MAIOR que `perguntas.length`: o resto vem de {@link obterDesempate},
 * que só pode escolher depois de haver respostas. A barra de progresso usa `total`
 * desde o início — sem isso o denominador saltaria no meio do questionário.
 *
 * Questionário
 */
export async function obterPerguntas(): Promise<{ perguntas: Pergunta[]; total: number }> {
  return buscar<{ perguntas: Pergunta[]; total: number }>(`${BASE}/afinidade/perguntas`);
}

/**
 * As próximas perguntas, escolhidas contra o empate DESTE cidadão.
 *
 * DECISÃO: Medido: 8 de base + 7 escolhidas assim deixam 6 parlamentares empatados no topo;
 * as 15 melhores fixas deixam 14, e 8 + 7 sorteadas deixam 16.
 *
 * Não Devolve `[]` — nunca erro — quando não há mais candidatas. Falhar aqui
 * impediria de concluir um questionário que já está válido.
 */
export async function obterDesempate(
  respostas: { perguntaId: string; valor: Resposta }[],
): Promise<Pergunta[]> {
  try {
    const resposta = await fetch(`${BASE}/afinidade/perguntas/desempate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
      body: JSON.stringify({ respostas }),
      credentials: 'include',
    });

    return resposta.ok ? await resposta.json() : [];
  } catch {
    return [];
  }
}

/**
 * DECISÃO: 422 é resposta prevista (CT7), não falha de rede
 */
export async function calcularAfinidade(
  respostas: { perguntaId: string; valor: Resposta }[],
  uf?: string,
): Promise<ResultadoAfinidade> {
  const resposta = await fetch(`${BASE}/afinidade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
    body: JSON.stringify(uf ? { respostas, uf } : { respostas }),
    credentials: 'include',
  });

  if (resposta.status === 422) {
    const corpo = await resposta.json().catch(() => ({ minimo: 0 }));
    throw new RespostasInsuficientesError(corpo.minimo ?? 0);
  }

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.afinidade(resposta.status));

  return resposta.json();
}

/**
 * Os GET em andamento, por endereço. Quem pede o mesmo endereço antes da resposta chegar recebe a
 * mesma promessa, e o servidor calcula uma vez só.
 *
 * MEDIDO (2026-10-10): toda ficha de parlamentar saía duas vezes, cada uma de 3 a 5 s a frio.
 */
const EM_ANDAMENTO = new Map<string, Promise<unknown>>();

/** GET com credenciais; pedidos simultâneos ao mesmo endereço viram um só. */
function buscar<T>(url: string): Promise<T> {
  const existente = EM_ANDAMENTO.get(url);
  if (existente) {
    return existente as Promise<T>;
  }
  const pedido = buscarUmaVez<T>(url).finally(() => EM_ANDAMENTO.delete(url));
  EM_ANDAMENTO.set(url, pedido);
  return pedido;
}

/** Faz o GET e traduz 401 e erro de status. */
async function buscarUmaVez<T>(url: string): Promise<T> {
  const resposta = await fetch(url, { credentials: 'include' });

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.consulta(url, resposta.status));

  return resposta.json();
}

async function enviar<T>(url: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
    body: JSON.stringify(corpo),
    credentials: 'include',
  });

  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.falhaEm(url, resposta.status));

  return resposta.json();
}

async function semCorpo(url: string, metodo: string): Promise<void> {
  const resposta = await fetch(url, { method: metodo, headers: CABECALHO_DO_SITE, credentials: 'include' });

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.falhaEm(url, resposta.status));
}

/**
 * Grafo (RF-33)
 */
export type NoDoGrafo = {
  idPessoa: number;
  nome: string;
  partido: string;
  uf: string;
  /** ATENÇÃO: Grupo detectado pelo VOTO, não pelo partido — ver `plano/07`. */
  comunidade: number | null;
  /** Posição no DESENHO — layout de molas. Sem interpretação. */
  eixoX: number | null;
  eixoY: number | null;
  nVotacoes: number;
  /** 1ª componente principal (SVD) — DECISÃO: o eixo que SIGNIFICA algo. Ver Pendência 43. */
  componente1: number | null;
  componente2: number | null;
  /** Foto oficial da casa. ATENÇÃO: Nula para quem foi criado a partir do próprio voto. */
  urlFoto: string | null;
  /**
   * DECISÃO: De 0 a 1 — quanto o parlamentar votou como a bancada do Governo orientou.
   *
   * Vai junto para a LEGENDA do grafo ser derivada do dado, não escrita à mão: o
   * sinal do eixo é arbitrário, e uma legenda fixa dizendo "à esquerda ficam os
   * governistas" ficaria errada em silêncio se uma reexecução espelhasse a figura.
   *
   * Não Nulo no Senado.
   */
  governismo: number | null;
};

/**
 * ATENÇÃO: `peso` é a CONCORDÂNCIA, e sozinho ele não se lê: 82% sobre 24 votações e 82%
 * sobre 540 são afirmações de força muito diferente. A tela nunca mostra um sem
 * `votacoesComuns`.
 */
export type ArestaDoGrafo = {
  idPessoaDe: number;
  idPessoaPara: number;
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
   * As legislaturas em que a casa tem grafo, da mais recente. A que não teve dado suficiente
   * Não está aqui, e a tela não a oferece.
   */
  legislaturasComGrafo: number[];
  /** As votações de plenário da legislatura desenhada, e quantas foram secretas. */
  votacoesDePlenario: number;
  secretasDePlenario: number;
  /** A primeira e a última votação aberta de plenário, `YYYY-MM-DD` — o recorte do desenho. */
  abertasDesde: string | null;
  abertasAte: string | null;
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

/**
 * Cota parlamentar (CEAP)
 */
export type GastoPorCategoria = {
  categoria: string;
  total: number;
  lancamentos: number;
};

export type FornecedorDoParlamentar = {
  nome: string;
  total: number;
  lancamentos: number;
  /** ATENÇÃO: Quando `true`, o CNPJ/CPF está hasheado no banco — RNF-13. */
  pessoaFisica: boolean;
};

export type GastoDeCota = {
  anoDaDespesa: number;
  total: number;
  lancamentos: number;
  porCategoria: GastoPorCategoria[];
  maioresFornecedores: FornecedorDoParlamentar[];
};

/** Com `legislatura`, o ano mais recente DENTRO do mandato — a ficha não mistura períodos. */
function doMandato(legislatura?: number | null): string {
  return legislatura ? `?legislatura=${legislatura}` : '';
}

export async function obterGastos(
  idPessoa: number,
  legislatura?: number | null,
  anoDaDespesa?: number,
): Promise<GastoDeCota> {
  const consulta = doMandato(legislatura);
  const doAno = anoDaDespesa ? `${consulta ? '&' : '?'}anoDaDespesa=${anoDaDespesa}` : '';
  return buscar<GastoDeCota>(`${BASE}/parlamentares/${idPessoa}/gastos${consulta}${doAno}`);
}

/**
 * Emendas parlamentares (Portal da Transparência)
 */
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
 * RISCO: `empenhado` e `pago` são coisas DIFERENTES, e a distância entre eles é a
 * informação. Empenhar é reservar; pagar é o dinheiro sair.
 */
export type EmendasDoParlamentar = {
  anoDaEmenda: number;
  empenhado: number;
  pago: number;
  /** Restos a pagar pagos: empenho do ano pago nos anos seguintes. */
  pagoDepois: number;
  quantidade: number;
  porDestino: EmendaPorDestino[];
  porFuncao: EmendaPorFuncao[];
  favorecidos: FavorecidosDaEmenda;
  pagamentosPorMes: PagamentoPorMes[];
  convenios: ConveniosDaEmenda;
  cidades: CidadesDaEmenda;
};

/** As cidades que receberam, pela sede de quem recebeu — não pela localidade declarada. */
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
  /** Pendência 74: o que a cota do mesmo parlamentar pagou ao mesmo CNPJ, no mandato da emenda. Nulo quando nada. */
  tambemNaCota?: number | null;
};

/**
 * Quem recebeu, somado desde o primeiro pagamento — por isso `recebido` pode passar do
 * `pago` do ano: inclui o que foi pago nos anos seguintes. `ultimoMes` diz até quando.
 *
 * RISCO: Intermediário, pessoas e sem identificação ficam FORA de `maiores`, com o valor
 * declarado ao lado. Pessoa não chega com nome: o banco nem o guarda.
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
 * RISCO: `valor` é do convênio INTEIRO, e ele pode receber emendas de vários autores —
 * `emendasQueFinanciam` diz quantas. Somar a lista não dá o que o parlamentar destinou.
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

export async function obterEmendas(idPessoa: number, legislatura?: number | null): Promise<EmendasDoParlamentar> {
  return buscar<EmendasDoParlamentar>(`${BASE}/parlamentares/${idPessoa}/emendas${doMandato(legislatura)}`);
}

/** Uma emenda, somadas as linhas dela, com o link no Portal. */
export type EmendaNaLista = {
  codigoEmenda: string;
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
  idPessoa: number, anoDaEmenda: number, pagina: number, tamanho: number,
): Promise<PaginaDe<EmendaNaLista>> {
  return buscar<PaginaDe<EmendaNaLista>>(
    `${BASE}/parlamentares/${idPessoa}/emendas/lista?anoDaEmenda=${anoDaEmenda}&pagina=${pagina}&tamanho=${tamanho}`,
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
  idPessoa: number, anoDaDespesa: number, pagina: number, tamanho: number,
): Promise<PaginaDe<LancamentoDaCota>> {
  return buscar<PaginaDe<LancamentoDaCota>>(
    `${BASE}/parlamentares/${idPessoa}/gastos/lancamentos?anoDaDespesa=${anoDaDespesa}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

/** Quem recebeu as emendas do ano, em páginas. A página 1 é a da ficha. */
export async function listarFavorecidos(
  idPessoa: number, anoDaEmenda: number, pagina: number, tamanho: number,
): Promise<PaginaDe<FavorecidoDaEmenda>> {
  return buscar<PaginaDe<FavorecidoDaEmenda>>(
    `${BASE}/parlamentares/${idPessoa}/emendas/favorecidos?anoDaEmenda=${anoDaEmenda}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

/** Os convênios das emendas do ano, em páginas. A página 1 é a da ficha. */
export async function listarConvenios(
  idPessoa: number, anoDaEmenda: number, pagina: number, tamanho: number,
): Promise<PaginaDe<ConvenioDaEmenda>> {
  return buscar<PaginaDe<ConvenioDaEmenda>>(
    `${BASE}/parlamentares/${idPessoa}/emendas/convenios?anoDaEmenda=${anoDaEmenda}&pagina=${pagina}&tamanho=${tamanho}`,
  );
}

/**
 * Governo federal — quem governa, de onde veio o dinheiro e para onde foi
 */
export type PessoaDaGestao = { nome: string; nomeDeUrna: string; partido: string };

/** Presidente e vice eleitos, segundo o TSE. O mandato é contado em anos. */
export type Gestao = {
  anoDaEleicao: number;
  primeiroAno: number;
  ultimoAno: number;
  presidente: PessoaDaGestao;
  vice: PessoaDaGestao;
  coligacao: string | null;
};

export type OrigemDaReceita = { origem: string; prevista: number; realizada: number };

/**
 * RISCO: `emissaoDeDivida` não é arrecadação: é dinheiro emprestado, e em 2025 quase iguala
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
  codigoDaFuncao: string;
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
  /** Nulo enquanto a carga do gasto sigiloso ainda não rodou para o período. */
  sigilo: Sigilo | null;
  /** Nulo enquanto a carga do cartão da Defesa Civil não rodou para o período. */
  defesaCivil: DefesaCivil | null;
  /** O cartão de compras centralizadas, por órgão; nulo sem carga. Não se soma ao corporativo. */
  comprasCentralizadas: {
    total: number;
    transacoes: number;
    porOrgao: { orgao: string; valor: number; transacoes: number }[];
    /** Os meses do período que o Portal não publicou, `AAAA-MM`. */
    mesesSemArquivo: string[];
    /** O valor de cada ano do período e quantos meses dele o Portal publicou. */
    porAno: { ano: number; valor: number; meses: number }[];
  } | null;
  porAno: GovernoNoAno[];
  /** Todas as gestões com dado, qualquer que seja o período: os atalhos do seletor. */
  gestoesDisponiveis: Gestao[];
};

/** `gastou` não inclui a rolagem da dívida, que é dívida paga com dívida nova. */
export type GovernoNoAno = { anoDoOrcamento: number; arrecadou: number; gastou: number; pegouEmprestado: number; fechado: boolean };

/**
 * O gasto que o Portal publica sem dizer em quê. Cartão e ação não se somam: o cartão
 * sigiloso esconde quem comprou, de quem e quando; a ação sigilosa esconde a finalidade.
 */
/**
 * O Cartão de Pagamento da Defesa Civil: dinheiro federal que estados e municípios gastam em desastres.
 * Não se soma ao cartão corporativo. `mesesSemArquivo` traz `"2023-01"` para o mês que o Portal não publicou.
 */
export type DefesaCivil = {
  total: number;
  estadual: number;
  naoInformado: number;
  transacoes: number;
  executores: number;
  porAno: { anoDoExtrato: number; valor: number; meses: number }[];
  porUf: { uf: string; valor: number; executores: number }[];
  mesesSemArquivo: string[];
};

export type Sigilo = {
  cartaoSigiloso: number;
  cartaoTotal: number;
  transacoesSigilosas: number;
  acaoSigilosa: number;
  meses: number;
  porOrgao: { orgao: string; cartao: number; cartaoTotal: number; acao: number }[];
  /** O gasto sigiloso de cada ano do período, no cartão e nas ações de caráter sigiloso. */
  porAno: { ano: number; cartao: number; acao: number }[];
};

/** Sem período, todos os anos. `null` quando a carga ainda não rodou. */
/**
 * As viagens a serviço do Executivo federal no período. Hospedagem não tem valor próprio: está nas diárias.
 * `sigiloso` é o que o Portal publica com o órgão "Sigiloso"; `destinos` contam chegadas, não pessoas.
 */
export type ViagensDoGoverno = {
  periodo: Periodo;
  anosDisponiveis: number[];
  gestoesDisponiveis: Gestao[];
  /** O órgão escolhido; nulo mostra todos. `porOrgao` traz sempre todos, para a escolha. */
  orgao: string | null;
  total: number;
  diarias: number;
  passagens: number;
  restituicao: number;
  seguro: number;
  viagens: number;
  urgentes: number;
  naoRealizadas: number;
  /** O que continua sem órgão: o Portal esconde o órgão no pagamento e na viagem. */
  sigiloso: number;
  /** O que o Portal publicou com órgão "Sigiloso" no pagamento e foi para o órgão da viagem. */
  pagoComOrgaoSigiloso: number;
  porAno: { anoDaViagem: number; diarias: number; passagens: number; total: number; viagens: number }[];
  porOrgao: { orgao: string; total: number; diarias: number; passagens: number; viagens: number; urgentes: number }[];
  destinos: DestinoDeViagem[];
  destinosNoExterior: DestinoDeViagem[];
};

/**
 * Os contratos publicados pelo Executivo federal no período. `valor` é o final de cada contrato, salvo
 * quando ele e o inicial divergem mais de 100 vezes: aí entra o menor, e `valorDescartado` diz quanto ficou de fora.
 */
/** Uma sanção do CEIS ou do CNEP. */
export type SancaoDaEntidade = {
  cadastro: 'CEIS' | 'CNEP';
  categoria: string;
  inicio: string | null;
  fim: string | null;
  vigente: boolean;
  orgaoSancionador: string;
  esfera: string | null;
  fundamentacaoLegal: string | null;
  valorDaMulta: number | null;
};

export type ComprasDoGoverno = {
  periodo: Periodo;
  anosDisponiveis: number[];
  gestoesDisponiveis: Gestao[];
  contratos: number;
  valor: number;
  sigilosos: number;
  valorSigiloso: number;
  semModalidade: number;
  divergentes: number;
  valorDescartado: number;
  porAno: { anoDaPublicacao: number; contratos: number; valor: number }[];
  porModalidade: { modalidade: string; contratos: number; valor: number }[];
  porOrgao: { orgao: string; contratos: number; valor: number; sigilosos: number }[];
  contratados: { cnpj: string; nome: string; contratos: number; valor: number }[];
};

export async function obterComprasDoGoverno(periodo?: Periodo): Promise<ComprasDoGoverno | null> {
  const url = periodo
    ? `${BASE}/governo/compras?de=${periodo.primeiroAno}&ate=${periodo.ultimoAno}`
    : `${BASE}/governo/compras`;
  const resposta = await fetch(url, { credentials: 'include' });

  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.consulta(url, resposta.status));

  return resposta.json();
}

/** Um destino no período; `uf` por extenso, nula fora do Brasil. */
export type DestinoDeViagem = { pais: string; uf: string | null; cidade: string; chegadas: number };

export async function obterViagensDoGoverno(periodo?: Periodo, orgao?: string): Promise<ViagensDoGoverno | null> {
  const consulta = new URLSearchParams();
  if (periodo) {
    consulta.set('de', String(periodo.primeiroAno));
    consulta.set('ate', String(periodo.ultimoAno));
  }
  if (orgao) {
    consulta.set('orgao', orgao);
  }
  const url = consulta.size > 0 ? `${BASE}/governo/viagens?${consulta}` : `${BASE}/governo/viagens`;
  const resposta = await fetch(url, { credentials: 'include' });

  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.consulta(url, resposta.status));

  return resposta.json();
}

export async function obterGoverno(periodo?: Periodo): Promise<Governo | null> {
  const url = periodo ? `${BASE}/governo?de=${periodo.primeiroAno}&ate=${periodo.ultimoAno}` : `${BASE}/governo`;
  const resposta = await fetch(url, { credentials: 'include' });

  if (resposta.status === 404) return null;
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.consulta(url, resposta.status));

  return resposta.json();
}

/**
 * Financiamento de campanha (TSE)
 */
export type ReceitaPorFonte = {
  fonte: string;
  total: number;
  lancamentos: number;
};

export type DoadorDoParlamentar = {
  nome: string;
  total: number;
  /** ATENÇÃO: Quando `true`, o documento está hasheado no banco — RNF-13. */
  pessoaFisica: boolean;
};

/**
 * RISCO: `fundoEspecial` (o "fundão", FEFC) e `fundoPartidario` são fundos DIFERENTES.
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

/** Com `legislatura`, a eleição que deu ESTE mandato, e nenhuma outra. */
export async function obterFinanciamento(
  idPessoa: number,
  legislatura?: number | null,
): Promise<FinanciamentoDeCampanha> {
  return buscar<FinanciamentoDeCampanha>(
    `${BASE}/parlamentares/${idPessoa}/financiamento${doMandato(legislatura)}`,
  );
}

/**
 * Metodologia — os parâmetros do método, de onde o cálculo os lê
 */
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

/** "O que mudou" (Pendência 63): os cinco avisos sobre quem a pessoa segue, cada um na janela do dado. */
export type Novidades = {
  /** Os 7 dias que terminam na votação mais recente da base, não no relógio. */
  semana: { de: string; ate: string };
  atualizacoes: { fonte: string; orgao: string; ultimaCarga: string }[];
  votosNaSemana: {
    idPessoa: number; nome: string; casa: Casa; votou: number;
    /** Só o Senado registra ausência; na Câmara vem nulo. */
    ausente: number | null; ausenteJustificado: number | null;
  }[];
  contraOPartido: {
    idPessoa: number; nome: string; votacaoId: string; data: string; proposicao: string | null;
    descricao: string | null; partido: string; bancada: string; orientacao: string; voto: string;
    urlFonte: string | null;
  }[];
  trocasDePartido: {
    idPessoa: number; nome: string; casa: Casa; partidoAnterior: string; partidoNovo: string; primeiroVoto: string;
  }[];
  gastosNaCota: {
    idPessoa: number; nome: string; casa: Casa | null; anoDaDespesa: number; mes: number; total: number;
    maiorCategoria: string; maiorCategoriaValor: number;
  }[];
  emendasPagas: {
    idPessoa: number; nome: string; mes: string; pago: number;
    maiorDestino: string | null; lugarDoMaiorDestino: string | null;
  }[];
};

export async function obterNovidades(): Promise<Novidades> {
  return buscar<Novidades>(`${BASE}/seguidos/novidades`);
}

/**
 * Avisos no navegador (Pendência 89). RISCO: a inscrição diz que a pessoa segue alguém, e tem
 * consentimento próprio: sem ele vivo na versão do texto, a API responde 428.
 */
export type InscricaoDoNavegador = { endereco: string; p256dh: string; auth: string };

export type EstadoDosAvisos = { consentimento: boolean; navegadores: number; esteNavegador: boolean };

/** A chave pública VAPID do servidor; `null` quando o servidor não tem avisos ligados. */
export async function obterChaveDosAvisos(): Promise<string | null> {
  return (await buscar<{ chavePublica: string | null }>(`${BASE}/avisos/chave`)).chavePublica;
}

export async function obterEstadoDosAvisos(endereco: string | null): Promise<EstadoDosAvisos> {
  const consulta = endereco ? `?endereco=${encodeURIComponent(endereco)}` : '';
  return buscar<EstadoDosAvisos>(`${BASE}/avisos${consulta}`);
}

/** Inscreve este navegador. Sem consentimento vivo, {@link ConsentimentoNecessarioError}: a tela pergunta e chama de novo com `aceite`. */
export async function inscreverNavegador(inscricao: InscricaoDoNavegador, aceite = false): Promise<void> {
  const consulta = new URLSearchParams({ versao: VERSAO_CONSENTIMENTO });
  if (aceite) consulta.set('aceite', 'true');
  const url = `${BASE}/avisos/navegador?${consulta}`;
  const resposta = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
    body: JSON.stringify(inscricao),
    credentials: 'include',
  });

  if (resposta.status === 428) throw new ConsentimentoNecessarioError();
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.falhaEm(url, resposta.status));
}

/** Tira este navegador da lista. Os outros da pessoa continuam recebendo. */
export async function tirarNavegador(endereco: string): Promise<void> {
  const url = `${BASE}/avisos/navegador/saida`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CABECALHO_DO_SITE },
    body: JSON.stringify({ endereco }),
    credentials: 'include',
  });

  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.falhaEm(url, resposta.status));
}

/** Revoga o consentimento dos avisos; a API apaga os navegadores e o registro do que já foi avisado. */
export async function revogarAvisos(): Promise<void> {
  await semCorpo(`${BASE}/avisos/consentimento`, 'DELETE');
}

/** O número cuja procedência se pede (Pendência 73). O recorte é o mesmo da tela que o mostra. */
export type ConsultaDeProcedencia = {
  contexto:
    | 'votos' | 'cota' | 'emendas' | 'campanha' | 'patrimonio' | 'painel' | 'pagamentos' | 'entidade'
    | 'governo-gastos' | 'governo-receitas' | 'governo-sigiloso'
    | 'governo-viagens' | 'governo-compras' | 'governo-defesa-civil' | 'governo-compras-centralizadas'
    | 'sancoes' | 'convenios' | 'parlamentar' | 'gestoes' | 'ementas' | 'populacao';
  idPessoa?: number;
  legislatura?: number;
  /** Só em `cota`: um ano de despesa em vez do mandato. */
  anoDaDespesa?: number;
  /** Só em `emendas`: um ano de emenda em vez do mandato. */
  anoDaEmenda?: number;
  /** Só em `campanha` e `patrimonio`: a eleição em vez da que deu o mandato. */
  anoDaEleicao?: number;
  casa?: 'CAMARA' | 'SENADO';
  /** Em `pagamentos`, anos de emenda, como no mapa; nos do governo, anos do orçamento. */
  de?: number;
  ate?: number;
  /** Só em `entidade`. */
  cnpj?: string;
  /** Só em `cota`: uma categoria de despesa. */
  categoria?: string;
  /** Só em `pagamentos`: o que chegou a quem tem sede no estado. */
  uf?: string;
  /** Só em `pagamentos`: o que chegou a quem tem sede na cidade (código IBGE). */
  municipio?: string;
};

/** Uma linha do banco que entrou no número, quando o número é pequeno. */
export type LinhaDaProcedencia = {
  descricao: string;
  detalhe: string | null;
  data: string | null;
  valor: number | null;
  /** O documento na fonte, quando ela publica (a nota fiscal da cota). */
  url: string | null;
};

/** Um arquivo baixado de fonte oficial, com a impressão digital do que veio. */
export type CargaDeProcedencia = {
  idCarga: number;
  fonte: string;
  orgao: string;
  baseLegal: string;
  url: string;
  baixadoEm: string;
  sha256: string;
  bytes: number;
  etagDaFonte: string | null;
  modificadoNaFonte: string | null;
  comando: string;
  /** A versão da ETL que leu o arquivo: o hash dos fontes dela. */
  versao: string | null;
  linhas: number;
};

/** De onde veio um número e como foi contado. */
export type Procedencia = {
  regra: string;
  linhas: number;
  /** Gravadas antes da Pendência 72: não dizem de que arquivo vieram, e a tela diz quantas são. */
  linhasSemCarga: number;
  cargas: CargaDeProcedencia[];
  /** As linhas, uma a uma, quando são até 50; nulo acima disso. */
  lista: LinhaDaProcedencia[] | null;
};

export async function obterProcedencia(consulta: ConsultaDeProcedencia): Promise<Procedencia> {
  const { contexto, ...resto } = consulta;
  const parametros = new URLSearchParams(
    Object.entries(resto)
      .filter(([, valor]) => valor !== undefined)
      .map(([chave, valor]) => [chave, String(valor)]),
  );
  return buscar<Procedencia>(`${BASE}/procedencia/${contexto}?${parametros}`);
}

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

/**
 * Os anos de emenda considerados, inclusive nas duas pontas. Sem dado, `{ de: 0, ate: 0 }`.
 *
 * Mapa das emendas — pela sede de quem recebeu
 */
export type Periodo = { primeiroAno: number; ultimoAno: number };

/** Uma UF no mapa. `codigoUf` é o código IBGE de dois dígitos, o `codarea` da malha. */
export type RecebidoNaUf = {
  uf: string;
  codigoUf: string;
  recebido: number;
  municipios: number;
  /** Estimativa do IBGE somada nos municípios da UF; nula sem a carga `populacao`. */
  populacao?: number | null;
};

/**
 * RISCO: `noMapa` não é `recebido`. O que passou pelo intermediário (Banco do Brasil) e o pago a
 * pessoa ou sem identificação não têm sede, e ficam declarados ao lado do mapa.
 */
export type MapaDoBrasil = {
  periodo: Periodo;
  anosDisponiveis: number[];
  recebido: number;
  noMapa: number;
  viaIntermediario: number;
  semSede: number;
  porUf: RecebidoNaUf[];
  /** O ano da estimativa de população usada na leitura por habitante. */
  anoDaPopulacao?: number | null;
  /** O recebido por ano da emenda, em todos os anos carregados. */
  porAno?: { anoDaEmenda: number; recebido: number }[] | null;
};

export type RecebidoNoMunicipio = { codigoIbge: string; nome: string; recebido: number; populacao?: number | null };

/** TODAS as cidades da UF; a que nada recebeu vem com zero. */
export type MapaDoEstado = {
  uf: string;
  periodo: Periodo;
  recebido: number;
  porMunicipio: RecebidoNoMunicipio[];
};

export type Municipio = { codigoIbge: string; nome: string; uf: string };

/** Um deputado ou senador. Sem `idPessoa`, o autor ainda não foi ligado a uma ficha. */
export type ParlamentarQueMandou = {
  idPessoa: number | null;
  nome: string;
  partido: string | null;
  uf: string | null;
  casa: Casa | null;
  urlFoto: string | null;
  recebido: number;
  emendas: number;
};

export type TipoAutorColetivo = 'BANCADA' | 'COMISSAO' | 'OUTRO';

/** Bancada estadual ou comissão: autor de emenda que não é uma pessoa. */
export type ColetivoQueMandou = { tipo: TipoAutorColetivo; nome: string; recebido: number; emendas: number };

/**
 * ATENÇÃO: `naPropriaCidade` é o que foi à prefeitura ou a órgão municipal; o resto, a entidades
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
 * ATENÇÃO: `aLiberar` soma só os em execução: nos outros a execução acabou, e a diferença não é
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
    busca.set('de', String(periodo.primeiroAno));
    busca.set('ate', String(periodo.ultimoAno));
  }
  const texto = busca.toString();
  return texto ? `${url}?${texto}` : url;
}

export async function obterMapaDoBrasil(periodo?: Periodo): Promise<MapaDoBrasil> {
  return buscar<MapaDoBrasil>(comPeriodo(`${BASE}/mapa/emendas`, periodo));
}

/** Um total de emendas num ano, comparado com o Portal: fonte, base e o que ficou fora, por motivo (Pendência 81). */
export type Reconciliacao = {
  /**
   * `EMENDAS` e `PAGO_X_RECEBIDO` são por ano da emenda; `PAGAMENTOS`, por ano do pagamento; a cota, por ano da despesa.
   * `PAGO_X_RECEBIDO` cruza o pago do arquivo de emendas com o recebido do arquivo de pagamentos.
   */
  conjunto: 'EMENDAS' | 'PAGAMENTOS' | 'PAGO_X_RECEBIDO' | 'COTA_CAMARA' | 'COTA_SENADO';
  medida: 'EMPENHADO' | 'PAGO' | 'RECEBIDO' | 'VALOR_LIQUIDO';
  anoDaFonte: number;
  totalNaFonte: number;
  totalNaBase: number;
  /** A parte da base com a bancada deduzida pelo estado. Já está em `totalNaBase`. */
  totalInferido: number;
  motivos: { motivo: string; valor: number }[];
};

export async function obterReconciliacao(periodo?: Periodo): Promise<Reconciliacao[]> {
  return buscar<Reconciliacao[]>(comPeriodo(`${BASE}/emendas/reconciliacao`, periodo));
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

/**
 * Entidades — quem recebeu emenda, por CNPJ — e a busca do cabeçalho
 */
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
  idPessoa: number;
  nome: string;
  partido: string | null;
  casa: Casa | null;
  total: number;
  lancamentos: number;
};

/** ATENÇÃO: Estar na cota e na emenda não é indício de nada: a tela diz isso ao lado (RNF-16). */
export type CotaDaEntidade = { total: number; lancamentos: number; porParlamentar: ParlamentarNaCota[] };

export type Entidade = EntidadeNaLista & {
  urlFonte: string;
  porAno: { anoDaEmenda: number; recebido: number }[];
  deParlamentares: number;
  parlamentares: PaginaDe<ParlamentarQueMandou>;
  coletivos: ColetivoQueMandou[];
  naCota: CotaDaEntidade | null;
  convenios: PaginaDe<ConvenioDaEntidade>;
  /** CEIS e CNEP, do retrato mais recente. `vigente` compara o fim com hoje; sem fim, vigente. */
  sancoes: SancaoDaEntidade[];
  /** Contratos com o Executivo federal; nulo quando não há. */
  comOGoverno: { contratos: number; valor: number; primeiroAno: number; ultimoAno: number } | null;
};

export type Busca = {
  parlamentares: Parlamentar[];
  municipios: Municipio[];
  entidades: EntidadeNaLista[];
  /** Quem tem outra `legislatura` já saiu. Os em exercício vêm primeiro. */
  legislaturaCorrente?: number | null;
  /** Governadores, prefeitos, deputados estaduais e vices: quem tem mandato no TSE e nunca votou no Congresso. */
  politicos?: PoliticoNaLista[];
};

/** Os cargos eletivos da base, os mesmos tokens de `TipoCargo` no C# e em `tipos.py`. */
export type Cargo =
  | 'PRESIDENTE'
  | 'VICE_PRESIDENTE'
  | 'SENADOR'
  | 'DEPUTADO_FEDERAL'
  | 'GOVERNADOR'
  | 'VICE_GOVERNADOR'
  | 'DEPUTADO_ESTADUAL'
  | 'DEPUTADO_DISTRITAL'
  | 'PREFEITO'
  | 'VICE_PREFEITO';

export type Nivel = 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL';

/** Um mandato do TSE. `municipio` só nos cargos municipais, e nulo quando o município do TSE não casou com o IBGE. */
export type MandatoNoTse = {
  cargo: Cargo;
  nivel: Nivel;
  anoEleicao: number;
  primeiroAno: number;
  ultimoAno: number;
  uf: string | null;
  municipio: Municipio | null;
  partido: string;
};

/** Um político na lista: `mandato` é o mais recente entre os que passam no filtro. */
export type PoliticoNaLista = {
  idPessoa: number;
  nome: string;
  urlFoto: string | null;
  mandato: MandatoNoTse;
  mandatos: number;
  /** Votou na Câmara ou no Senado: a página dele é a do parlamentar. */
  parlamentar: boolean;
};

export type FiltroDePoliticos = {
  busca?: string;
  nivel?: Nivel | null;
  cargo?: Cargo | null;
  uf?: string | null;
  municipio?: string | null;
  pagina?: number;
};

/** Um eleito na gestão; `parlamentar` decide qual ficha abre. */
export type EleitoNaGestao = { idPessoa: number; nome: string; partido: string; parlamentar: boolean };

/** Um mandato municipal: os eleitos, os governadores eleitos nos anos que coincidem e o pago nesses anos. */
export type GestaoDaCidade = {
  primeiroAno: number;
  ultimoAno: number;
  prefeitos: EleitoNaGestao[];
  vices: EleitoNaGestao[];
  governadores: { governador: EleitoNaGestao; deAno: number; ateAno: number }[];
  recebido: number;
  naPrefeitura: number;
  /** Sem ano na base de pagamentos (antes de ago/2015): a tela diz isso, não R$ 0. */
  comPagamento: boolean;
  /** A receita e a despesa da prefeitura nos anos que ela declarou ao Tesouro (Siconfi); `null` sem nenhum ano declarado na base. */
  contas?: { receita: number; despesaPaga: number; anosDeclarados: number; anosNaGestao: number } | null;
};

/** A página da cidade (Pendência 90, fase 4). */
export type GestoesDaCidade = {
  municipio: Municipio;
  populacao: number | null;
  recebido: number;
  naPrefeitura: number;
  gestoes: GestaoDaCidade[];
  porAno: { ano: number; recebido: number; naPrefeitura: number }[];
};

/** `null` quando o código não é município. */
export async function obterGestoesDaCidade(codigoIbge: string): Promise<GestoesDaCidade | null> {
  const resposta = await fetch(`${BASE}/municipios/${codigoIbge}/gestoes`, { credentials: 'include' });
  if (resposta.status === 404) return null;
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.cidade(resposta.status));
  return resposta.json();
}

export type TipoDeMarco = 'ELEITO' | 'TROCOU_DE_PARTIDO' | 'VOTOU' | 'DECLAROU_BENS' | 'GASTOU_NA_COTA' | 'EMENDAS_PAGAS';

/** Um marco da linha do tempo; só os campos do tipo vêm preenchidos. */
export type Marco = {
  tipo: TipoDeMarco;
  mandato?: MandatoNoTse | null;
  partido?: string | null;
  partidoAnterior?: string | null;
  quantidade?: number | null;
  valor?: number | null;
};

/** A linha do tempo, do ano mais recente ao mais antigo (Pendência 92). */
export type LinhaDoTempo = { anos: { ano: number; marcos: Marco[] }[] };

export async function obterLinhaDoTempo(idPessoa: number): Promise<LinhaDoTempo> {
  return buscar<LinhaDoTempo>(`${BASE}/politicos/${idPessoa}/linha-do-tempo`);
}

/** A ficha pelos mandatos do TSE (Pendência 90, fase 3). */
export type FichaDoPolitico = {
  idPessoa: number;
  nome: string;
  nomeCivil: string | null;
  urlFoto: string | null;
  parlamentar: boolean;
  mandatos: MandatoNoTse[];
  redesSociais: RedeSocial[];
};

/** `null` quando a pessoa não tem mandato no TSE: a página diz isso em vez de quebrar. */
export async function obterFichaDoPolitico(idPessoa: number): Promise<FichaDoPolitico | null> {
  const resposta = await fetch(`${BASE}/politicos/${idPessoa}`, { credentials: 'include' });
  if (resposta.status === 404) return null;
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.politico(resposta.status));
  return resposta.json();
}

export async function listarPoliticos(filtro: FiltroDePoliticos): Promise<PaginaDe<PoliticoNaLista>> {
  const busca = new URLSearchParams();
  if (filtro.busca) busca.set('busca', filtro.busca);
  if (filtro.nivel) busca.set('nivel', filtro.nivel);
  if (filtro.cargo) busca.set('cargo', filtro.cargo);
  if (filtro.uf) busca.set('uf', filtro.uf);
  if (filtro.municipio) busca.set('municipio', filtro.municipio);
  if (filtro.pagina) busca.set('pagina', String(filtro.pagina));
  const texto = busca.toString();
  return buscar<PaginaDe<PoliticoNaLista>>(`${BASE}/politicos${texto ? `?${texto}` : ''}`);
}

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

/** `null` quando o CNPJ não recebeu emenda — a página diz isso em vez de quebrar. */
export async function obterEntidade(cnpj: string): Promise<Entidade | null> {
  const resposta = await fetch(`${BASE}/entidades/${cnpj}`, { credentials: 'include' });
  if (resposta.status === 404) return null;
  if (resposta.status === 401) throw new NaoAutenticadoError();
  if (!resposta.ok) throw new Error(TEXTOS_DA_API.erros.entidade(resposta.status));
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

/**
 * RISCO: Só tipo e valor: a descrição de cada bem traz endereço, e não chega aqui.
 *
 * Patrimônio declarado ao TSE (PP3)
 */
export type DeclaracaoDeBens = {
  anoEleicao: number;
  total: number;
  bens: number;
  porTipo: { tipo: string; valor: number; quantidade: number }[];
};

export async function obterPatrimonio(idPessoa: number): Promise<DeclaracaoDeBens[]> {
  const resposta = await buscar<{ declaracoes: DeclaracaoDeBens[] }>(`${BASE}/parlamentares/${idPessoa}/patrimonio`);
  return resposta.declaracoes;
}

/**
 * Em quantas votações de plenário o parlamentar participou. Sempre com a base.
 *
 * ATENÇÃO: Na Câmara, `ausenteJustificado` é nulo: a casa não publica a justificativa no registro
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
  /** A mediana da presença na casa, com a mesma conta: a escala do número. */
  medianaDaCasa?: number | null;
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
