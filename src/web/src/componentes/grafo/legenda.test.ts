import { describe, expect, it } from 'vitest';
import type { NoDoGrafo } from '../../api';
import { montarLegenda } from './legenda';

function no(eixoX: number, governismo: number | null, nVotacoes = 800): NoDoGrafo {
  return {
    id: Math.random(),
    nome: 'Fulano',
    partido: 'X',
    uf: 'SP',
    comunidade: 0,
    eixoX,
    eixoY: 0,
    nVotacoes,
    componente1: eixoX,
    componente2: 0,
    urlFoto: null,
    governismo,
  };
}

/**
 * A figura real da 57ª legislatura, em miniatura: um bloco governista fechado, um
 * miolo grande também governista, um lado oposicionista e algumas pontas de suplente.
 */
function camara(espelhado = false) {
  const s = espelhado ? -1 : 1;

  return [
    ...Array.from({ length: 30 }, () => no(s * -0.4, 0.97)),
    ...Array.from({ length: 60 }, () => no(s * 0.05, 0.81)),
    ...Array.from({ length: 35 }, () => no(s * 0.4, 0.29)),
    ...Array.from({ length: 5 }, () => no(s * -0.9, 0.6, 25)),
  ];
}

describe('legenda derivada do desenho', () => {
  it('descreve as quatro faixas', () => {
    const legenda = montarLegenda(camara())!;

    expect(legenda.faixas.map((f) => f.chave)).toEqual([
      'lado-a',
      'centro',
      'lado-b',
      'bordas',
    ]);
    expect(legenda.faixas.map((f) => f.quantos)).toEqual([30, 60, 35, 5]);
  });

  it('🔴 acompanha o espelhamento da figura', () => {
    // O sinal do eixo é arbitrário: a semente é fixa, mas uma reexecução com dado novo
    // pode espelhar o desenho. Uma legenda escrita à mão diria "à esquerda ficam os
    // governistas" e passaria a mentir sem que nada quebrasse.
    const normal = montarLegenda(camara(false))!;
    const espelhada = montarLegenda(camara(true))!;

    const ladoGovernista = (l: typeof normal) =>
      l.faixas.find((f) => f.chave === 'lado-a')!.onde;

    expect(ladoGovernista(normal)).toMatch(/esquerda/);
    expect(ladoGovernista(espelhada)).toMatch(/direita/);

    // ⭐ E o CONTEÚDO é o mesmo: o bloco governista continua sendo o de 30, com 97%.
    for (const legenda of [normal, espelhada]) {
      const lado = legenda.faixas.find((f) => f.chave === 'lado-a')!;
      expect(lado.quantos).toBe(30);
      expect(lado.governismo).toBeCloseTo(0.97, 2);
    }
  });

  it('o lado A é sempre o de MAIOR governismo, não o da esquerda', () => {
    const legenda = montarLegenda(camara())!;
    const a = legenda.faixas.find((f) => f.chave === 'lado-a')!;
    const b = legenda.faixas.find((f) => f.chave === 'lado-b')!;

    expect(a.governismo!).toBeGreaterThan(b.governismo!);
  });

  it('a ponta é reconhecida pela contagem de votações, não pela posição', () => {
    // ⚠️ É o que distingue "extremo por convicção" de "extremo por falta de dado".
    const bordas = montarLegenda(camara())!.faixas.find((f) => f.chave === 'bordas')!;

    expect(bordas.votacoes).toBe(25);
  });

  it('⛔ sem orientação de bancada, a legenda não nomeia lado nenhum', () => {
    // É o caso do Senado: sem orientação publicada, ⛔ não há o que dizer sobre os lados.
    const senado = camara().map((n) => ({ ...n, governismo: null }));

    const legenda = montarLegenda(senado)!;

    expect(legenda.temAlinhamento).toBe(false);
    expect(legenda.faixas.every((f) => f.governismo === null)).toBe(true);
  });

  it('⛔ não inventa legenda para punhado de nó', () => {
    expect(montarLegenda([no(0.1, 0.8), no(-0.1, 0.7)])).toBeNull();
  });

  it('nó sem posição fica de fora da conta', () => {
    const comNulo = [...camara(), { ...no(0, 0.5), eixoX: null }];

    const legenda = montarLegenda(comNulo)!;

    expect(legenda.faixas.reduce((s, f) => s + f.quantos, 0)).toBe(130);
  });
});
