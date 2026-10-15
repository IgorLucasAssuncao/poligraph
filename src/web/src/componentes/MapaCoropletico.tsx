import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { reaisCompacto } from '../formato';
import { carregarMalha, codigoDa, faixaDe, faixasPorQuantil } from '../mapa';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * Mapa coroplético das malhas do IBGE, servidas pelo próprio site (`public/malhas`).
 *
 * ## Por que assim
 *
 * - **d3-geo + topojson-client, não biblioteca de mapa com fundo.** O mapa é de valor por
 *   área, não de rua: um fundo de azulejos pediria um serviço externo a cada visita — o
 *   mesmo motivo das fontes auto-hospedadas — e não acrescentaria nada.
 * - **Escala quente, de uma família só, em cinco faixas por quantil.** Do areia ao ocre:
 *   lê como "mais" e "menos", e não como lados — não passa pelo vermelho, que lembraria
 *   partido (RNF-16). Quantil, não faixa linear: o dinheiro se concentra em poucas cidades,
 *   e a escala linear pintaria quase tudo da faixa zero.
 * - **Sem valor não é zero.** Área sem pagamento fica só com o contorno.
 *
 * ## Por que é rápido
 *
 * - **As áreas são desenhadas uma vez.** Passar o mouse move só o rótulo; as até 853
 *   cidades de Minas não se redesenham a cada movimento — era o que travava a página.
 * - **Aos poucos.** As áreas entram em lotes, um por quadro, e a página responde enquanto
 *   o estado se desenha.
 * - **Contorno antes do dado.** `valores` nulo desenha o mapa em cinza; as cores entram
 *   quando o dado chega, e a malha não espera por ele.
 *
 * ATENÇÃO: Com `focavel`, cada área recebe foco e responde a Enter — para as 27 UFs. Os
 * municípios não : seriam até 853 paradas de Tab. A lista ao lado do mapa é a alternativa
 * de teclado e de leitor de tela.
 *
 * ATENÇÃO: Quem troca `malha` troca também a `key`: o estado recomeça sem piscar a malha anterior.
 *
 * O código da área sob o evento, pela marca na própria área: um ouvinte só para o mapa todo.
 */
export function MapaCoropleticoComponent({
  malha,
  valores,
  nomes,
  selecionado,
  focavel = false,
  rotulo,
  aoEscolher,
  formatar = reaisCompacto,
}: {
  /** O arquivo em `public/malhas`, sem extensão: `brasil` ou o código da UF. */
  malha: string;
  /** Valor por código IBGE — o `codarea` da malha. Nulo enquanto o dado não chegou. */
  valores: Map<string, number> | null;
  nomes: Map<string, string>;
  selecionado?: string | null;
  focavel?: boolean;
  rotulo: string;
  aoEscolher: (codigoIbge: string) => void;
  /** Como o valor aparece no rótulo e na legenda: reais no total, reais por habitante na outra leitura. */
  formatar?: (valor: number) => string;
}) {
  const [areas, setAreas] = useState<FeatureCollection | null>(null);
  const [erro, setErro] = useState(false);
  const [desenhadas, setDesenhadas] = useState(LOTE);
  const [rotuloFlutuante, setRotuloFlutuante] = useState<{ codigoIbge: string; x: number; y: number } | null>(null);
  const figura = useRef<HTMLElement>(null);

  useEffect(() => {
    let atual = true;

    carregarMalha(malha)
      .then((novas) => atual && setAreas(novas))
      .catch(() => atual && setErro(true));

    return () => {
      atual = false;
    };
  }, [malha]);

  const desenho = useMemo(() => {
    if (!areas) return [];
    const projecao = geoMercator().fitExtent([[4, 4], [LADO - 4, LADO - 4]], areas);
    const caminho = geoPath(projecao);
    return areas.features.map((f) => ({ codigoIbge: codigoDa(f), d: caminho(f) ?? '' }));
  }, [areas]);

  useEffect(() => {
    if (desenhadas >= desenho.length) return;
    const quadro = requestAnimationFrame(() => setDesenhadas((n) => n + LOTE));
    return () => cancelAnimationFrame(quadro);
  }, [desenhadas, desenho.length]);

  const limites = useMemo(() => faixasPorQuantil(valores ? [...valores.values()] : []), [valores]);
  const faixas = useMemo(() => {
    if (!valores) return null;
    return new Map(desenho.map(({ codigoIbge }) => [codigoIbge, faixaDe(valores.get(codigoIbge), limites)]));
  }, [valores, limites, desenho]);

  if (erro) return <p className="erro">{T.mapa.erro}</p>;
  if (!areas) return <div className="mapa-carregando" aria-hidden="true" />;

  const descrever = (codigoIbge: string) => {
    const nome = nomes.get(codigoIbge) ?? '';
    if (!valores) return nome;
    const valor = valores.get(codigoIbge);
    return T.mapa.descricao(nome, valor ? formatar(valor) : null);
  };

  const codigoDoEvento = (elemento: EventTarget) => (elemento as Element).getAttribute?.('data-codigo');

  const posicionar = (codigoIbge: string, x: number, y: number) => {
    const caixa = figura.current?.getBoundingClientRect();
    if (caixa) setRotuloFlutuante({ codigoIbge, x: x - caixa.left, y: y - caixa.top });
  };

  return (
    <figure className="mapa" ref={figura}>
      <svg
        viewBox={`0 0 ${LADO} ${LADO}`}
        role="group"
        aria-label={rotulo}
        aria-busy={desenhadas < desenho.length || !valores}
        onClick={(e) => {
          const codigoIbge = codigoDoEvento(e.target);
          if (codigoIbge) aoEscolher(codigoIbge);
        }}
        onKeyDown={(e) => {
          const codigoIbge = codigoDoEvento(e.target);
          if (focavel && codigoIbge && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            aoEscolher(codigoIbge);
          }
        }}
        onPointerMove={(e) => {
          const codigoIbge = codigoDoEvento(e.target);
          if (codigoIbge) posicionar(codigoIbge, e.clientX, e.clientY);
          else setRotuloFlutuante(null);
        }}
        onPointerLeave={() => setRotuloFlutuante(null)}
        onFocus={(e) => {
          const codigoIbge = codigoDoEvento(e.target);
          const caixa = (e.target as Element).getBoundingClientRect();
          if (codigoIbge) posicionar(codigoIbge, caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
        }}
        onBlur={() => setRotuloFlutuante(null)}
      >
        <AreasComponent
          desenho={desenho}
          desenhadas={desenhadas}
          faixas={faixas}
          selecionado={selecionado ?? null}
          focavel={focavel}
          descrever={focavel ? descrever : null}
        />
      </svg>

      {rotuloFlutuante && (
        <span
          className="mapa-rotulo"
          style={{ left: rotuloFlutuante.x, top: rotuloFlutuante.y }}
          aria-hidden="true"
        >
          {descrever(rotuloFlutuante.codigoIbge)}
        </span>
      )}

      {valores && <LegendaDoMapaComponent limites={limites} formatar={formatar} />}
    </figure>
  );
}

const LADO = 600;

/** Áreas por quadro. 200 cabem num quadro de 16 ms num telefone médio. */
const LOTE = 200;

/**
 * As áreas, que só se redesenham quando muda o que elas mostram — não quando o mouse anda.
 *
 * ATENÇÃO: `descrever` só existe no mapa focável, e ali são 27 áreas: no dos municípios ele é
 * nulo, e o `memo` não perde a comparação a cada desenho do pai.
 */
const AreasComponent = memo(function Areas({
  desenho,
  desenhadas,
  faixas,
  selecionado,
  focavel,
  descrever,
}: {
  desenho: { codigoIbge: string; d: string }[];
  desenhadas: number;
  faixas: Map<string, number> | null;
  selecionado: string | null;
  focavel: boolean;
  descrever: ((codigoIbge: string) => string) | null;
}) {
  return (
    <>
      {desenho.slice(0, desenhadas).map(({ codigoIbge, d }) => (
        <path
          key={codigoIbge}
          d={d}
          data-codigo={codigoIbge}
          className={[
            'mapa-area',
            faixas ? `mapa-faixa-${faixas.get(codigoIbge) ?? 0}` : 'mapa-sem-dado',
            codigoIbge === selecionado ? 'mapa-selecionada' : '',
          ].join(' ')}
          tabIndex={focavel ? 0 : undefined}
          role={focavel ? 'button' : undefined}
          aria-label={descrever ? descrever(codigoIbge) : undefined}
          aria-pressed={focavel ? codigoIbge === selecionado : undefined}
        />
      ))}
    </>
  );
});

function LegendaDoMapaComponent({ limites, formatar }: { limites: number[]; formatar: (valor: number) => string }) {
  if (limites.length === 0) return null;

  const faixas = [0, ...limites].map((limiteInferior, i) => ({
    faixa: i + 1,
    texto: i < limites.length ? T.mapa.faixa(formatar(limiteInferior), formatar(limites[i])) : T.mapa.ouMais(formatar(limiteInferior)),
  }));
  faixas[0].texto = T.mapa.ate(formatar(limites[0]));

  return (
    <figcaption className="mapa-legenda">
      <span className="mapa-legenda-item">
        <span className="mapa-amostra mapa-faixa-0" aria-hidden="true" />
        {T.mapa.semPagamento}
      </span>
      {faixas.map(({ faixa, texto }) => (
        <span key={faixa} className="mapa-legenda-item">
          <span className={`mapa-amostra mapa-faixa-${faixa}`} aria-hidden="true" /> {texto}
        </span>
      ))}
    </figcaption>
  );
}
