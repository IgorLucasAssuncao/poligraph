import { describe, expect, it } from 'vitest';
import { montarColunas } from '../../../src/comum/componentes/colunasDasFitas';

type Caminho = { autor: string; area: string; valor: number };

const CAMINHOS: Caminho[] = [
  { autor: 'A', area: 'Saúde', valor: 50 },
  { autor: 'B', area: 'Saúde', valor: 30 },
  { autor: 'C', area: 'Educação', valor: 10 },
  { autor: 'D', area: 'Educação', valor: 6 },
  { autor: 'E', area: 'Cultura', valor: 4 },
];

const colunas = (aVista: number) => [
  { chave: (c: Caminho) => c.autor, rotulo: (a: string) => a, aVista, resto: (n: number) => `Outros ${n}` },
  { chave: (c: Caminho) => c.area, rotulo: (a: string) => a },
];

describe('colunas das fitas', () => {
  it('junta as menores numa caixa que diz quantas são, e cada coluna soma o mesmo total', () => {
    const { nos, fitas } = montarColunas(CAMINHOS, (c) => c.valor, colunas(2));

    expect(nos.filter((n) => n.coluna === 0).map((n) => n.rotulo)).toEqual(['A', 'B', 'Outros 3']);
    const saindo = fitas.filter((f) => f.de.startsWith('0:')).reduce((s, f) => s + f.valor, 0);
    expect(saindo).toBe(100);
    expect(fitas.find((f) => f.de.endsWith('resto') && f.para === '1:Educação')?.valor).toBe(16);
  });

  it('uma só a mais aparece pelo nome, e não como "Outros 1"', () => {
    const { nos } = montarColunas(CAMINHOS, (c) => c.valor, colunas(4));

    expect(nos.filter((n) => n.coluna === 0).map((n) => n.rotulo)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
