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
