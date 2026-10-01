import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { reaisCompacto } from '../formato';
import { carregarMalha, codigoDa, faixaDe, faixasPorQuantil } from '../mapa';

/**
 * Mapa coroplético das malhas do IBGE, servidas pelo próprio site (`public/malhas`).
 *
 * ## Por que assim
 *
 * - **d3-geo + topojson-client, ⛔ biblioteca de mapa com fundo.** O mapa é de valor por
 *   área, ⛔ de rua: um fundo de azulejos pediria um serviço externo a cada visita — o
 *   mesmo motivo das fontes auto-hospedadas — e ⛔ acrescentaria nada.
 * - **Escala quente, de uma família só, em cinco faixas por quantil.** Do areia ao ocre:
 *   lê como "mais" e "menos", e ⛔ como lados — ⛔ passa pelo vermelho, que lembraria
 *   partido (RNF-16). Quantil, ⛔ faixa linear: o dinheiro se concentra em poucas cidades,
 *   e a escala linear pintaria quase tudo da faixa zero.
 * - **Sem valor ⛔ é zero.** Área sem pagamento fica só com o contorno.
 *
 * ## Por que é rápido
 *
 * - **As áreas são desenhadas uma vez.** Passar o mouse move só o rótulo; as até 853
 *   cidades de Minas ⛔ se redesenham a cada movimento — era o que travava a página.
 * - **Aos poucos.** As áreas entram em lotes, um por quadro, e a página responde enquanto
 *   o estado se desenha.
 * - **Contorno antes do dado.** `valores` nulo desenha o mapa em cinza; as cores entram
 *   quando o dado chega, e a malha ⛔ espera por ele.
 *
 * ⚠️ Com `focavel`, cada área recebe foco e responde a Enter — para as 27 UFs. Os
 * municípios ⛔: seriam até 853 paradas de Tab. A lista ao lado do mapa é a alternativa
 * de teclado e de leitor de tela.
 *
 * ⚠️ Quem troca `malha` troca também a `key`: o estado recomeça sem piscar a malha anterior.
 */
export function MapaCoropletico({
  malha,
  valores,
  nomes,
  selecionado,
  focavel = false,
  rotulo,
  aoEscolher,
}: {
  /** O arquivo em `public/malhas`, sem extensão: `brasil` ou o código da UF. */
  malha: string;
  /** Valor por código IBGE — o `codarea` da malha. Nulo enquanto o dado ⛔ chegou. */
  valores: Map<string, number> | null;
  nomes: Map<string, string>;
  selecionado?: string | null;
  focavel?: boolean;
  rotulo: string;
  aoEscolher: (codigo: string) => void;
}) {
  const [areas, setAreas] = useState<FeatureCollection | null>(null);
  const [erro, setErro] = useState(false);
  const [desenhadas, setDesenhadas] = useState(LOTE);
  const [rotuloFlutuante, setRotuloFlutuante] = useState<{ codigo: string; x: number; y: number } | null>(null);
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
    return areas.features.map((f) => ({ codigo: codigoDa(f), d: caminho(f) ?? '' }));
  }, [areas]);

  useEffect(() => {
    if (desenhadas >= desenho.length) return;
    const quadro = requestAnimationFrame(() => setDesenhadas((n) => n + LOTE));
    return () => cancelAnimationFrame(quadro);
  }, [desenhadas, desenho.length]);

  const limites = useMemo(() => faixasPorQuantil(valores ? [...valores.values()] : []), [valores]);
  const faixas = useMemo(() => {
    if (!valores) return null;
    return new Map(desenho.map(({ codigo }) => [codigo, faixaDe(valores.get(codigo), limites)]));
  }, [valores, limites, desenho]);

  if (erro) return <p className="erro">Não foi possível carregar o mapa.</p>;
  if (!areas) return <div className="mapa-carregando" aria-hidden="true" />;

  const descrever = (codigo: string) => {
    const nome = nomes.get(codigo) ?? '';
    if (!valores) return nome;
    const valor = valores.get(codigo);
    return `${nome}: ${valor ? reaisCompacto(valor) : 'nenhum pagamento'}`;
  };

  /** O código da área sob o evento, pela marca na própria área: um ouvinte só para o mapa todo. */
  const codigoDoEvento = (alvo: EventTarget) => (alvo as Element).getAttribute?.('data-codigo');

  const posicionar = (codigo: string, x: number, y: number) => {
    const caixa = figura.current?.getBoundingClientRect();
    if (caixa) setRotuloFlutuante({ codigo, x: x - caixa.left, y: y - caixa.top });
  };

  return (
    <figure className="mapa" ref={figura}>
      <svg
        viewBox={`0 0 ${LADO} ${LADO}`}
        role="group"
        aria-label={rotulo}
        aria-busy={desenhadas < desenho.length || !valores}
        onClick={(e) => {
          const codigo = codigoDoEvento(e.target);
          if (codigo) aoEscolher(codigo);
        }}
        onKeyDown={(e) => {
          const codigo = codigoDoEvento(e.target);
          if (focavel && codigo && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            aoEscolher(codigo);
          }
        }}
        onPointerMove={(e) => {
          const codigo = codigoDoEvento(e.target);
          if (codigo) posicionar(codigo, e.clientX, e.clientY);
          else setRotuloFlutuante(null);
        }}
        onPointerLeave={() => setRotuloFlutuante(null)}
        onFocus={(e) => {
          const codigo = codigoDoEvento(e.target);
          const caixa = (e.target as Element).getBoundingClientRect();
          if (codigo) posicionar(codigo, caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
        }}
        onBlur={() => setRotuloFlutuante(null)}
      >
        <Areas
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
          {descrever(rotuloFlutuante.codigo)}
        </span>
      )}

      {valores && <LegendaDoMapa limites={limites} />}
    </figure>
  );
}

// ═══════════════════════════════════════════════════════════════════

const LADO = 600;

/** Áreas por quadro. 200 cabem num quadro de 16 ms num telefone médio. */
const LOTE = 200;

/**
 * As áreas, que só se redesenham quando muda o que elas mostram — ⛔ quando o mouse anda.
 *
 * ⚠️ `descrever` só existe no mapa focável, e ali são 27 áreas: no dos municípios ele é
 * nulo, e o `memo` ⛔ perde a comparação a cada desenho do pai.
 */
const Areas = memo(function Areas({
  desenho,
  desenhadas,
  faixas,
  selecionado,
  focavel,
  descrever,
}: {
  desenho: { codigo: string; d: string }[];
  desenhadas: number;
  faixas: Map<string, number> | null;
  selecionado: string | null;
  focavel: boolean;
  descrever: ((codigo: string) => string) | null;
}) {
  return (
    <>
      {desenho.slice(0, desenhadas).map(({ codigo, d }) => (
        <path
          key={codigo}
          d={d}
          data-codigo={codigo}
          className={[
            'mapa-area',
            faixas ? `mapa-faixa-${faixas.get(codigo) ?? 0}` : 'mapa-sem-dado',
            codigo === selecionado ? 'mapa-selecionada' : '',
          ].join(' ')}
          tabIndex={focavel ? 0 : undefined}
          role={focavel ? 'button' : undefined}
          aria-label={descrever ? descrever(codigo) : undefined}
          aria-pressed={focavel ? codigo === selecionado : undefined}
        />
      ))}
    </>
  );
});

function LegendaDoMapa({ limites }: { limites: number[] }) {
  if (limites.length === 0) return null;

  const faixas = [0, ...limites].map((de, i) => ({
    faixa: i + 1,
    texto: i < limites.length ? `${reaisCompacto(de)} a ${reaisCompacto(limites[i])}` : `${reaisCompacto(de)} ou mais`,
  }));
  faixas[0].texto = `até ${reaisCompacto(limites[0])}`;

  return (
    <figcaption className="mapa-legenda">
      <span className="mapa-legenda-item">
        <span className="mapa-amostra mapa-faixa-0" aria-hidden="true" /> sem pagamento
      </span>
      {faixas.map(({ faixa, texto }) => (
        <span key={faixa} className="mapa-legenda-item">
          <span className={`mapa-amostra mapa-faixa-${faixa}`} aria-hidden="true" /> {texto}
        </span>
      ))}
    </figcaption>
  );
}
