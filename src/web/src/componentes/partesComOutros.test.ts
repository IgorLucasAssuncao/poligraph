import { describe, expect, it } from 'vitest';
import { partesComOutros } from './partesComOutros';

const itens = [
  { nome: 'a', valor: 10 },
  { nome: 'b', valor: 50 },
  { nome: 'c', valor: 30 },
  { nome: 'd', valor: 20 },
  { nome: 'e', valor: 5 },
  { nome: 'f', valor: 1 },
];

describe('partes com outros', () => {
  it('mostra as quatro maiores e soma o resto', () => {
    const partes = partesComOutros(itens, (i) => i.nome, (i) => i.valor, 'outros');

    expect(partes).toEqual([
      { nome: 'b', valor: 50 },
      { nome: 'c', valor: 30 },
      { nome: 'd', valor: 20 },
      { nome: 'a', valor: 10 },
      { nome: 'outros', valor: 6 },
    ]);
  });

  it('com a lista cortada pela API, o resto sai do total do período', () => {
    const partes = partesComOutros(itens, (i) => i.nome, (i) => i.valor, 'outros', 1_000);

    expect(partes.at(-1)).toEqual({ nome: 'outros', valor: 890 });
  });

  it('sem resto, não inventa a parte de outros', () => {
    expect(partesComOutros(itens.slice(0, 3), (i) => i.nome, (i) => i.valor, 'outros')).toHaveLength(3);
  });
});
