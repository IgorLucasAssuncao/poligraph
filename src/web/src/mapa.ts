import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';

/**
 * As malhas do IBGE e as faixas de cor do mapa das emendas — sem componente, para o
 * teste e a busca por localização usarem sem desenhar nada.
 */

/**
 * Os limites entre as cinco faixas, pelos quantis dos valores positivos.
 *
 * ATENÇÃO: Com poucos valores distintos, limites repetidos são descartados: faixa vazia na
 * legenda afirmaria um intervalo que nenhuma área ocupa.
 */
export function faixasPorQuantil(valores: number[]): number[] {
  const positivos = valores.filter((v) => v > 0).sort((a, b) => a - b);
  if (positivos.length === 0) return [];

  const limites = [0.2, 0.4, 0.6, 0.8].map(
    (q) => positivos[Math.min(positivos.length - 1, Math.floor(q * positivos.length))],
  );
  return [...new Set(limites)].filter((l) => l > positivos[0]);
}

/** 0 = sem pagamento; de 1 à última faixa, pela posição do valor entre os limites. */
export function faixaDe(valor: number | undefined, limites: number[]): number {
  if (!valor || valor <= 0) return 0;
  return 1 + limites.filter((l) => valor >= l).length;
}

/** A área da malha que contém o ponto `[longitude, latitude]`, ou `null`. */
export async function areaQueContem(malha: string, ponto: [number, number]): Promise<string | null> {
  const areas = await carregarMalha(malha);
  const achada = areas.features.find((f) => geoContains(f, ponto));
  return achada ? codigoDa(achada) : null;
}

const malhas = new Map<string, Promise<FeatureCollection>>();

/** Uma vez por arquivo e por visita: a troca de ano não rebaixa a malha. */
export function carregarMalha(nome: string): Promise<FeatureCollection> {
  let pendente = malhas.get(nome);
  if (!pendente) {
    pendente = fetch(`/malhas/${nome}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Malha ${nome} indisponível (${r.status}).`);
        return r.json() as Promise<Topology>;
      })
      .then((topologia) => {
        const objeto = topologia.objects[Object.keys(topologia.objects)[0]];
        return feature(topologia, objeto) as FeatureCollection;
      });
    pendente.catch(() => malhas.delete(nome));
    malhas.set(nome, pendente);
  }
  return pendente;
}

export function codigoDa(area: Feature<Geometry | null>): string {
  return String(area.properties?.codarea ?? '');
}
