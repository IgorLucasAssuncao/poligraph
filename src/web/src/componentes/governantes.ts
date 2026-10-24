import type { Gestao } from '../api';
import { nomeProprio } from '../formato';

/**
 * Quem governou cada ano: o presidente da gestão que começou por último até ele. No ano da troca, o que assumiu fica com o
 * ano, porque governou a maior parte dele (Temer em 2016, Lula em 2023).
 */
export function governantesPorAno(gestoes: Gestao[], anos: number[]): Map<number, string> {
  const ordenadas = [...gestoes].sort((a, b) => a.primeiroAno - b.primeiroAno);
  const porAno = new Map<number, string>();
  for (const ano of anos) {
    const gestao = ordenadas.filter((g) => g.primeiroAno <= ano && g.ultimoAno >= ano).at(-1);
    if (gestao) porAno.set(ano, nomeProprio(gestao.presidente.nomeDeUrna));
  }
  return porAno;
}

/** Os anos seguidos do mesmo governante, com a posição do primeiro na fila de colunas. Ano sem governante fica sem faixa. */
export function faixasDosGovernantes(
  anos: number[],
  governantes: ReadonlyMap<number, string>,
): { nome: string; inicio: number; anos: number[] }[] {
  const faixas: { nome: string; inicio: number; anos: number[] }[] = [];
  anos.forEach((ano, i) => {
    const nome = governantes.get(ano);
    if (!nome) return;
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.nome === nome && ultima.inicio + ultima.anos.length === i) ultima.anos.push(ano);
    else faixas.push({ nome, inicio: i, anos: [ano] });
  });
  return faixas;
}
