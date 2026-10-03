/**
 * Constantes técnicas do front: endereço da API, cabeçalhos, chaves do armazenamento do
 * navegador e limites de lista. O texto de tela fica em `textos/`, um arquivo por tela.
 */

/** A API, na mesma origem do site: o nginx encaminha `/api` ao container da API. */
export const BASE_DA_API = '/api';

/**
 * O cabeçalho que as rotas de escrita exigem (auditoria de 2026-10-03, CSRF). Um formulário de
 * outro site não consegue mandá-lo; a API recusa com 403 o pedido sem ele.
 */
export const CABECALHO_DO_SITE = { 'X-Requested-With': 'poligraph' } as const;

/** ATENÇÃO: a chave guarda o nome antigo, "modo análise": trocá-la apagaria a escolha de quem já ligou. */
export const CHAVE_DO_MODO_AUDITORIA = 'poligraph:modo-analise';

/**
 * O consentimento de medição guardado no navegador, fora do componente do banner.
 *
 * Separado para que outras partes da tela (a oferta do tour, a política de privacidade)
 * leiam e revoguem a escolha sem importar o componente.
 */
export const CHAVE_CONSENTIMENTO = 'poligraph.consentimento';

/** Disparado quando a pessoa responde o banner. */
export const EVENTO_CONSENTIMENTO = 'poligraph:consentimento';

export const CHAVE_MINHA_CIDADE = 'poligraph.minhaCidade';

export const CIDADES_POR_VEZ = 15;

export const ITENS_POR_PAGINA_DA_CIDADE = 10;

export const CHAVE_DO_TEMA = 'poligraph:tema';

export const EVENTO_TEMA = 'poligraph:tema';

export const COLETIVOS_POR_VEZ = 10;

/**
 * Patrimônio declarado (PP3)
 */
export const TIPOS_DE_BEM_A_VISTA = 5;

/** Quantos itens uma lista curta da ficha mostra antes do "Mostrar mais". */
export const A_VISTA = 5;

/**
 * ATENÇÃO: Eram 3, escolhidos entre os 100 primeiros em ordem alfabética — a lista da API
 * cortava ali, e o "mais ativo" era o mais ativo entre esses 100 nomes.
 */
export const SUGESTOES_PARA_SEGUIR = 8;

/** Quantos vizinhos por parlamentar. Além disto a lista vira ruído. */
export const VIZINHOS_NA_LISTA_DO_GRAFO = 5;

export const SUGESTOES_DA_BUSCA_NO_GRAFO = 6;

export const ITENS_POR_PAGINA_DA_ENTIDADE = 20;

/**
 * Quantos por vez. ATENÇÃO: A lista cortava em 100 por ordem alfabética, sem avisar: dos 745
 * parlamentares da 57ª, a tela nunca mostrava os outros 645.
 */
export const PARLAMENTARES_POR_PAGINA = 30;

/** Quantas áreas aparecem pelo nome; as demais viram "outras áreas". */
export const AREAS_DO_ORCAMENTO_NOMEADAS = 6;

/** ATENÇÃO: Só grupos com mais de um membro: 21 isolados virariam 21 linhas de legenda. */
export const MINIMO_PARA_LISTAR_PARTIDO = 2;

export const PARTIDOS_MOSTRADOS_NO_GRAFO = 5;

/** Menos que isto não filtra — a mesma regra do servidor (`TamanhoMinimoDaBusca`). */
export const BUSCA_MINIMA_NOS_VOTOS = 2;

export const VOTOS_POR_PAGINA_DA_BUSCA = 20;

/** Quantos "parecidos" aparecem antes do botão: o bastante para ler o grupo, sem empurrar os votos. */
export const SIMILARES_DE_INICIO = 5;

/**
 * Abaixo disto, a proporção diz pouco: a mesma régua da similaridade, que só compara quem
 * votou junto em 20 votações ou mais (`ck_sim_minimo`).
 */
export const BASE_PEQUENA_DO_ALINHAMENTO = 20;

/** O destino que o Portal escreve quando a emenda se reparte sem dizer onde. */
export const LOCALIDADE_MULTIPLA = 'MÚLTIPLO';

/** O destino que o Portal escreve para emenda de alcance nacional. */
export const LOCALIDADE_NACIONAL = 'Nacional';

/** O sufixo que o Portal põe no destino estadual: "PARANÁ (UF)". */
export const SUFIXO_DE_ESTADO = / \(UF\)$/;

/** Quantos estados a tabela do mapa mostra no celular antes de "Ver os N estados". */
export const ESTADOS_A_VISTA = 10;
