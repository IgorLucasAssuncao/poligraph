import { describe, expect, it } from 'vitest';
import { linhasDosRotulos, lugaresDosRotulos, type CaixaComRotulo } from '../../../src/comum/componentes/rotulosDasFitas';

const caixa = (id: string, coluna: number, x: number, y: number, nome = id, valor = 'R$ 1 mi'): CaixaComRotulo => ({
  id, coluna, x0: x, x1: x + 12, y0: y - 10, y1: y + 10, nome, valor,
});
const porLetra = (nome: string, valor: string | null) => (valor ? `${nome} ${valor}` : nome).length * 7;

describe('lado dos rótulos nas fitas', () => {
  it('a primeira coluna escreve à direita, a última à esquerda, e a do meio à direita quando cabe', () => {
    const lugares = lugaresDosRotulos([caixa('a', 0, 0, 50), caixa('b', 1, 400, 50), caixa('c', 2, 800, 200)], porLetra);

    expect(lugares.get('a')).toEqual({ lado: 'direita', comValor: true });
    expect(lugares.get('b')).toEqual({ lado: 'direita', comValor: true });
    expect(lugares.get('c')).toEqual({ lado: 'esquerda', comValor: true });
  });

  it('a do meio que bateria na da coluna seguinte passa para a esquerda', () => {
    const nomeComprido = 'Entidades sem fins lucrativos';
    const lugares = lugaresDosRotulos(
      [caixa('a', 0, 0, 200), caixa('meio', 1, 400, 50, 'Educação'), caixa('fim', 2, 750, 52, nomeComprido)],
      porLetra,
    );

    expect(lugares.get('meio')).toEqual({ lado: 'esquerda', comValor: true });
  });

  it('sem espaço dos dois lados, fica à direita só com o nome', () => {
    const lugares = lugaresDosRotulos(
      [caixa('a', 0, 0, 50, 'Bancada de Pernambuco'), caixa('meio', 1, 250, 50, 'Educação'), caixa('fim', 2, 450, 50, 'Entidades')],
      porLetra,
    );

    expect(lugares.get('meio')).toEqual({ lado: 'direita', comValor: false });
  });
});

describe('rótulos no desenho vertical', () => {
  it('os maiores ficam na primeira linha, o que não cabe ao lado desce, e nenhum some', () => {
    const { lugares, linhas } = linhasDosRotulos(
      [
        { id: 'grande', inicio: 0, fim: 200, nome: 'Saúde', valor: 'R$ 144 bi' },
        { id: 'medio', inicio: 200, fim: 300, nome: 'Encargos', valor: 'R$ 33 bi' },
        { id: 'pequeno', inicio: 300, fim: 310, nome: 'Agricultura', valor: 'R$ 7 bi' },
      ],
      porLetra,
      340,
    );

    expect(lugares.get('grande')?.linha).toBe(0);
    expect(lugares.get('pequeno')?.linha).toBeGreaterThan(0);
    expect(lugares.size).toBe(3);
    expect(linhas).toBeGreaterThanOrEqual(2);
    for (const { x } of lugares.values()) expect(x).toBeGreaterThanOrEqual(2);
  });
});
