import { describe, expect, it } from 'vitest';
import { anosDeCotaDaEmenda, mesCurto, mesesContinuos, noMeioDaFrase, nomeDaCategoriaDaCota, partesDeCem, reais, reaisCompacto, semPontosNoFim } from './formato';

/**
 * ATENÇÃO: Pular o mês sem pagamento encurtaria a espera no desenho.
 */
describe('reaisCompacto na fronteira da escala', () => {
  it('R$ 999.999,99 vira R$ 1 mi, não R$ 1.000 mil', () => {
    expect(reaisCompacto(999_999.99)).toBe('R$ 1 mi');
    expect(reaisCompacto(999_999_999)).toBe('R$ 1 bi');
    expect(reaisCompacto(999_900)).toBe('R$ 999,9 mil');
  });
});

describe('mesesContinuos', () => {
  it('preenche com zero os meses sem pagamento, atravessando o ano', () => {
    const serie = mesesContinuos([
      { mes: '2025-11-01', valor: 10 },
      { mes: '2026-02-01', valor: 5 },
    ]);

    expect(serie).toEqual([
      { mes: '2025-11-01', valor: 10 },
      { mes: '2025-12-01', valor: 0 },
      { mes: '2026-01-01', valor: 0 },
      { mes: '2026-02-01', valor: 5 },
    ]);
  });
});

/**
 * ATENÇÃO: Pelo texto, não `Date`: no fuso de Brasília, o dia 1 viraria o último do mês anterior.
 */
describe('formatos', () => {
  it('mês curto lê o texto, sem fuso', () => {
    expect(mesCurto('2025-03-01')).toBe('mar/2025');
  });

  it('valor compacto por ordem de grandeza', () => {
    expect(reaisCompacto(185_512_000_000)).toBe('R$ 185,5 bi');
    expect(reaisCompacto(12_300_000)).toBe('R$ 12,3 mi');
    expect(reaisCompacto(55_038.11)).toBe('R$ 55 mil');
    expect(reaisCompacto(980.32)).toBe(reais(980.32));
  });
});

describe('partesDeCem', () => {
  it('soma sempre 100, mesmo quando cada parte sozinha arredondaria errado', () => {
    const partes = partesDeCem([1, 1, 1]);

    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(partes.sort()).toEqual([33, 33, 34]);
  });

  it('respeita a proporção', () => {
    expect(partesDeCem([750, 250])).toEqual([75, 25]);
  });

  it('sem total, tudo zero', () => {
    expect(partesDeCem([0, 0])).toEqual([0, 0]);
  });
});

/** Pendência 74: a mesma conta de `Legislaturas.DoAnoDeEmenda` na API, nos dois lados da virada. */
describe('anosDeCotaDaEmenda', () => {
  it('a emenda de um ano é do mandato que tomou posse antes dele', () => {
    expect(anosDeCotaDaEmenda(2025)).toBe('2023–2026');
    expect(anosDeCotaDaEmenda(2024)).toBe('2023–2026');
    expect(anosDeCotaDaEmenda(2027)).toBe('2023–2026');
    expect(anosDeCotaDaEmenda(2023)).toBe('2019–2022');
    expect(anosDeCotaDaEmenda(2028)).toBe('2027–2030');
  });
});

describe('semPontosNoFim', () => {
  it('tira só os pontos do fim, e o texto sem ponto fica igual', () => {
    expect(semPontosNoFim('passagem aérea...')).toBe('passagem aérea');
    expect(semPontosNoFim('a.b.c')).toBe('a.b.c');
    expect(semPontosNoFim('...')).toBe('');
    expect(semPontosNoFim('')).toBe('');
  });
});

describe('nome da categoria da cota', () => {
  it('troca o nome oficial pelo da tabela, com a vírgula e o ponto da fonte', () => {
    expect(nomeDaCategoriaDaCota('HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL.')).toBe('Hotel fora de Brasília');
    expect(nomeDaCategoriaDaCota('Divulgação da atividade parlamentar')).toBe('Divulgação do mandato');
  });

  it('categoria nova sai arrumada, sem ponto no fim e com a vírgula colada', () => {
    expect(nomeDaCategoriaDaCota('DESPESA NOVA ,DE TESTE.')).toBe('Despesa nova, de teste');
  });

  it('no meio da frase, só a primeira letra muda', () => {
    expect(noMeioDaFrase('Hotel fora de Brasília')).toBe('hotel fora de Brasília');
  });
});
