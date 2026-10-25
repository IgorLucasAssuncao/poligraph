import type { Gestao, Periodo } from '../../nucleo/api';
import { nomeProprio } from '../../nucleo/formato';

/**
 * Os atalhos do seletor de período, um por gestão presidencial com dado: "Lula (2023–2026)".
 *
 * DECISÃO (2026-10-10): orçamento, cartões, compras e viagens oferecem os mesmos atalhos. A ponta
 * da gestão que passa dos anos carregados é trazida para dentro deles.
 */
export function atalhosDasGestoes(dados: {
  anosDisponiveis: number[];
  gestoesDisponiveis: Gestao[];
}): { rotulo: string; periodo: Periodo }[] {
  const primeiro = dados.anosDisponiveis[0];
  const ultimo = dados.anosDisponiveis[dados.anosDisponiveis.length - 1];
  return dados.gestoesDisponiveis.map((g) => ({
    rotulo: `${nomeProprio(g.presidente.nomeDeUrna)} (${g.primeiroAno}–${g.ultimoAno})`,
    periodo: { primeiroAno: Math.max(g.primeiroAno, primeiro), ultimoAno: Math.min(g.ultimoAno, ultimo) },
  }));
}
