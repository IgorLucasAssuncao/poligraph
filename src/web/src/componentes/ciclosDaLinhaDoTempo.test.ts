import { describe, expect, it } from 'vitest';
import type { LinhaDoTempo, MandatoNoTse } from '../api';
import { anosComCiclos, raiasDosCiclos } from './ciclosDaLinhaDoTempo';

const mandato = (cargo: MandatoNoTse['cargo'], primeiroAno: number, ultimoAno: number): MandatoNoTse => ({
  cargo, nivel: 'FEDERAL', anoEleicao: primeiroAno - 1, primeiroAno, ultimoAno, uf: 'RJ', municipio: null, partido: 'X',
});

describe('ciclos da linha do tempo', () => {
  it('do mais antigo ao mais recente, com início e fim de cada mandato, e o ano de início entra mesmo sem marco', () => {
    const linha: LinhaDoTempo = {
      anos: [
        { ano: 2018, marcos: [{ tipo: 'ELEITO', mandato: mandato('PRESIDENTE', 2019, 2022) }] },
        { ano: 2016, marcos: [{ tipo: 'VOTOU', quantidade: 3 }] },
        { ano: 2014, marcos: [{ tipo: 'ELEITO', mandato: mandato('DEPUTADO_FEDERAL', 2015, 2018) }] },
      ],
    };

    const anos = anosComCiclos(linha, 2026);

    expect(anos.map((a) => a.ano)).toEqual([2014, 2015, 2016, 2018, 2019, 2022]);
    expect(anos.find((a) => a.ano === 2015)).toMatchObject({ inicio: true, fim: false });
    expect(anos.find((a) => a.ano === 2018)?.fim).toBe(true);
    expect(anos.find((a) => a.ano === 2019)?.ciclo?.mandato.cargo).toBe('PRESIDENTE');
    expect(anos.find((a) => a.ano === 2014)?.ciclo).toBeNull();
  });

  it('o fim de um mandato que ainda não chegou fica de fora', () => {
    const linha: LinhaDoTempo = { anos: [{ ano: 2022, marcos: [{ tipo: 'ELEITO', mandato: mandato('PRESIDENTE', 2023, 2026) }] }] };

    expect(anosComCiclos(linha, 2025).map((a) => a.ano)).toEqual([2022, 2023]);
  });

  it('mandatos que se cruzam vão para raias diferentes, e o seguinte volta à primeira', () => {
    const estadual = { mandato: mandato('DEPUTADO_ESTADUAL', 2019, 2022), ordem: 0 };
    const prefeito = { mandato: mandato('PREFEITO', 2021, 2024), ordem: 1 };
    const federal = { mandato: mandato('DEPUTADO_FEDERAL', 2025, 2028), ordem: 2 };

    const { raias, total } = raiasDosCiclos([estadual, prefeito, federal], 2026);

    expect([raias.get(estadual), raias.get(prefeito), raias.get(federal)]).toEqual([0, 1, 0]);
    expect(total).toBe(2);
  });
});
