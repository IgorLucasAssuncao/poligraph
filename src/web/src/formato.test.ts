import { describe, expect, it } from 'vitest';
import { mesCurto, mesesContinuos, partesDeCem, reaisCompacto } from './formato';

describe('mesesContinuos', () => {
  /** ⚠️ Pular o mês sem pagamento encurtaria a espera no desenho. */
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

describe('formatos', () => {
  /** ⚠️ Pelo texto, ⛔ `Date`: no fuso de Brasília, o dia 1 viraria o último do mês anterior. */
  it('mês curto lê o texto, sem fuso', () => {
    expect(mesCurto('2025-03-01')).toBe('mar/2025');
  });

  it('valor compacto por ordem de grandeza', () => {
    expect(reaisCompacto(185_512_000_000)).toBe('R$ 185,5 bi');
    expect(reaisCompacto(12_300_000)).toBe('R$ 12,3 mi');
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
