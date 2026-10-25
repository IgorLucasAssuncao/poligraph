import type { ParteDoTodo } from './Graficos';

/** Quantas partes a barra de composição mostra por nome; o resto vira uma parte só. */
export const PARTES_NA_BARRA = 4;

/**
 * As maiores partes de uma lista e o resto somado, para a barra de composição.
 *
 * DECISÃO (2026-10-10): quatro partes com nome e uma de resto cabem nos cinco tons da barra e
 * mostram de saída quanto as maiores concentram. A lista completa continua logo abaixo.
 *
 * RISCO: lista cortada pela API (os 15 maiores) passa `total`, o do período inteiro; sem ele o resto
 * somaria só os listados e a barra diria que as maiores pesam mais do que pesam.
 */
export function partesComOutros<T>(
  itens: T[],
  nome: (item: T) => string,
  valor: (item: T) => number,
  rotuloDoResto: string,
  total?: number,
): ParteDoTodo[] {
  const ordenados = [...itens].sort((a, b) => valor(b) - valor(a));
  const maiores = ordenados.slice(0, PARTES_NA_BARRA).map((i) => ({ nome: nome(i), valor: valor(i) }));
  const resto =
    total === undefined
      ? ordenados.slice(PARTES_NA_BARRA).reduce((soma, i) => soma + valor(i), 0)
      : total - maiores.reduce((soma, m) => soma + m.valor, 0);
  return resto > 0 ? [...maiores, { nome: rotuloDoResto, valor: resto }] : maiores;
}
