import type { LinhaDoTempo, MandatoNoTse } from '../api';

/** Um mandato na linha do tempo: o cargo, o primeiro e o último ano, e a posição dele na fila (para o tom alternar). */
export type Ciclo = { mandato: MandatoNoTse; ordem: number };

/** Um ano da linha, com os marcos dele e o mandato em curso, se houver, e se o ano abre ou fecha esse mandato. */
export type AnoComCiclo = {
  ano: number;
  marcos: LinhaDoTempo['anos'][number]['marcos'];
  ciclo: Ciclo | null;
  inicio: boolean;
  fim: boolean;
};

/**
 * Os anos da linha do tempo, do mais antigo ao mais recente, cada um com o mandato em curso.
 *
 * Os mandatos saem dos marcos "Eleito". O ano de início e o de fim de cada mandato entram mesmo sem marco, para o ciclo ficar
 * à vista de ponta a ponta; ano futuro não entra. Em ano coberto por dois mandatos (o deputado que virou prefeito no meio),
 * vale o que começou por último.
 */
export function anosComCiclos(linha: LinhaDoTempo, anoAtual: number): AnoComCiclo[] {
  const mandatos = linha.anos
    .flatMap((a) => a.marcos)
    .filter((m) => m.tipo === 'ELEITO' && m.mandato)
    .map((m) => m.mandato as MandatoNoTse)
    .sort((a, b) => a.primeiroAno - b.primeiroAno);
  const ciclos: Ciclo[] = mandatos.map((mandato, ordem) => ({ mandato, ordem }));

  const porAno = new Map(linha.anos.map((a) => [a.ano, a.marcos]));
  for (const c of ciclos) {
    for (const ano of [c.mandato.primeiroAno, c.mandato.ultimoAno]) {
      if (ano <= anoAtual && !porAno.has(ano)) porAno.set(ano, []);
    }
  }

  return [...porAno.keys()]
    .sort((a, b) => a - b)
    .map((ano) => {
      const ciclo = ciclos.filter((c) => c.mandato.primeiroAno <= ano && c.mandato.ultimoAno >= ano).at(-1) ?? null;
      return {
        ano,
        marcos: porAno.get(ano) ?? [],
        ciclo,
        inicio: ciclo?.mandato.primeiroAno === ano,
        fim: ciclo?.mandato.ultimoAno === ano,
      };
    });
}
