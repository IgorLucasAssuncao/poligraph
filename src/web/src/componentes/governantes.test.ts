import { describe, expect, it } from 'vitest';
import type { Gestao } from '../api';
import { faixasDosGovernantes, governantesPorAno } from './governantes';

const gestao = (nomeDeUrna: string, primeiroAno: number, ultimoAno: number): Gestao => ({
  anoDaEleicao: primeiroAno - 1, primeiroAno, ultimoAno, presidente: { nome: nomeDeUrna, nomeDeUrna, partido: 'X' }, vice: null, coligacao: null,
});

describe('quem governava cada ano', () => {
  it('no ano da troca fica quem assumiu, e anos seguidos do mesmo nome viram uma faixa', () => {
    const gestoes = [gestao('DILMA', 2015, 2016), gestao('MICHEL TEMER', 2016, 2018), gestao('JAIR BOLSONARO', 2019, 2022), gestao('DILMA', 2011, 2014)];
    const porAno = governantesPorAno(gestoes, [2014, 2015, 2016, 2017, 2018, 2019]);

    expect([...porAno.values()]).toEqual(['Dilma', 'Dilma', 'Michel Temer', 'Michel Temer', 'Michel Temer', 'Jair Bolsonaro']);
    expect(faixasDosGovernantes([2014, 2015, 2016, 2017, 2018, 2019], porAno)).toEqual([
      { nome: 'Dilma', inicio: 0, anos: [2014, 2015] },
      { nome: 'Michel Temer', inicio: 2, anos: [2016, 2017, 2018] },
      { nome: 'Jair Bolsonaro', inicio: 5, anos: [2019] },
    ]);
  });
});
