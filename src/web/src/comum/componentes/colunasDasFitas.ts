import type { Fita, NoDasFitas } from './GraficoDeFitas';

/** Uma coluna do gráfico de fitas: de onde sai a caixa de cada caminho, o rótulo dela e quantas caixas ficam à vista. */
export type ColunaDasFitas<C> = {
  chave: (caminho: C) => string;
  rotulo: (chave: string) => string;
  /** Quantas caixas ficam à vista, as maiores; as outras se juntam numa só. Sem limite, todas. */
  aVista?: number;
  /** O rótulo da caixa que junta as menores, com quantas são. */
  resto?: (quantas: number) => string;
};

const RESTO = '\u0000resto';

/**
 * As caixas e as fitas de um gráfico de colunas encadeadas: cada caminho passa por uma caixa de cada coluna, e o valor dele
 * vira fita entre colunas vizinhas.
 *
 * Cada coluna soma o mesmo total: a caixa das menores junta o resto, e nenhum caminho sai da conta.
 */
export function montarColunas<C>(
  caminhos: C[],
  valor: (caminho: C) => number,
  colunas: ColunaDasFitas<C>[],
): { nos: NoDasFitas[]; fitas: Fita[] } {
  const chaveNaColuna = colunas.map((coluna) => {
    if (coluna.aVista === undefined) return coluna.chave;
    const somas = new Map<string, number>();
    for (const c of caminhos) somas.set(coluna.chave(c), (somas.get(coluna.chave(c)) ?? 0) + valor(c));
    const ordenadas = [...somas.entries()].sort((a, b) => b[1] - a[1]);
    if (ordenadas.length <= coluna.aVista + 1) return coluna.chave;
    const aVista = new Set(ordenadas.slice(0, coluna.aVista).map(([chave]) => chave));
    return (c: C) => (aVista.has(coluna.chave(c)) ? coluna.chave(c) : RESTO);
  });
  const quantasNoResto = colunas.map((coluna) => {
    if (coluna.aVista === undefined) return 0;
    const distintas = new Set(caminhos.map(coluna.chave)).size;
    return distintas <= coluna.aVista + 1 ? 0 : distintas - coluna.aVista;
  });

  const nos = new Map<string, NoDasFitas>();
  const fitas = new Map<string, Fita>();
  for (const c of caminhos) {
    const ids = colunas.map((coluna, i) => {
      const chave = chaveNaColuna[i](c);
      const id = `${i}:${chave}`;
      if (!nos.has(id)) {
        const rotulo = chave === RESTO ? (coluna.resto?.(quantasNoResto[i]) ?? '') : coluna.rotulo(chave);
        nos.set(id, { id, rotulo, coluna: i });
      }
      return id;
    });
    for (let i = 0; i + 1 < ids.length; i++) {
      const chave = `${ids[i]}→${ids[i + 1]}`;
      const fita = fitas.get(chave) ?? { de: ids[i], para: ids[i + 1], valor: 0 };
      fita.valor += valor(c);
      fitas.set(chave, fita);
    }
  }

  return { nos: [...nos.values()], fitas: [...fitas.values()] };
}
