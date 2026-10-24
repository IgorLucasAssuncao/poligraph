import { useEffect, useMemo, useRef, useState } from "react";
import {
  sankey,
  sankeyJustify,
  sankeyLinkHorizontal,
  type SankeyLink,
  type SankeyNode,
} from "d3-sankey";
import { TEXTOS_DOS_COMPONENTES } from "../textos/componentes";

const T = TEXTOS_DOS_COMPONENTES.fitas;

/** Uma caixa de uma coluna: o id liga as fitas, o rótulo vai na tela. */
export type NoDasFitas = { id: string; rotulo: string; coluna: number };

/** Uma fita: de uma caixa à da coluna seguinte, com o valor que passou por ela. */
export type Fita = { de: string; para: string; valor: number };

type No = SankeyNode<NoDasFitas, Fita>;
type Ligacao = SankeyLink<NoDasFitas, Fita>;

/** A largura antes de medir o espaço da página, e a menor com que o desenho ainda cabe os rótulos. */
const LARGURA_INICIAL = 960;
const LARGURA_MINIMA = 560;
const MARGEM = { esquerda: 8, direita: 8, topo: 28, baixo: 8 };
const LARGURA_DA_CAIXA = 12;
/** Altura mínima por caixa na coluna mais cheia: abaixo disso, os rótulos das caixas pequenas se encavalam. */
const ALTURA_POR_CAIXA = 30;

/**
 * O gráfico de fitas (Sankey): cada coluna divide o mesmo total, e a largura de cada fita é o valor que passou por aquele caminho.
 *
 * DECISÃO (autor, 2026-10-23): fitas, e não linhas finas, para o olho seguir para onde o dinheiro se divide. Uma cor só
 * (RNF-16): a fita diz que o dinheiro passou, e nada além disso.
 *
 * ATENÇÃO: só serve onde a ligação existe no dado, caminho a caminho. Onde as pontas não se ligam (a receita federal e o gasto,
 * que se misturam no caixa), o desenho afirmaria uma ligação que a fonte não tem.
 *
 * Passar o mouse numa caixa realça as fitas dela; o valor de cada fita vem no título, para o leitor de tela e para o toque longo.
 *
 * ATENÇÃO: o desenho tem a largura real do espaço, e não uma fixa que a tela encolhe. Encolhido, o rótulo de 13 px virava 7 na
 * coluna estreita da página da cidade. Abaixo de `LARGURA_MINIMA`, a caixa rola na horizontal em vez de espremer.
 */
export function GraficoDeFitasComponent({
  rotulo,
  colunas,
  nos,
  fitas,
  formatar,
  altura = 460,
}: {
  /** O que o gráfico mostra, para quem não o vê. */
  rotulo: string;
  /** O título de cada coluna, da esquerda para a direita. */
  colunas: readonly string[];
  nos: NoDasFitas[];
  fitas: Fita[];
  formatar: (valor: number) => string;
  altura?: number;
}) {
  const [realce, setRealce] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState(LARGURA_INICIAL);
  const LARGURA = Math.max(LARGURA_MINIMA, medida);
  const rolaDeLado = medida < LARGURA_MINIMA;

  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) =>
      setMedida(Math.round(entrada.contentRect.width)),
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  const maisCheia = Math.max(
    0,
    ...Object.values(
      nos.reduce<Record<number, number>>(
        (c, n) => ({ ...c, [n.coluna]: (c[n.coluna] ?? 0) + 1 }),
        {},
      ),
    ),
  );
  altura = Math.max(
    altura,
    MARGEM.topo + MARGEM.baixo + maisCheia * ALTURA_POR_CAIXA,
  );

  const desenho = useMemo(() => {
    const gerador = sankey<NoDasFitas, Fita>()
      .nodeId((n) => n.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(LARGURA_DA_CAIXA)
      .nodePadding(20)
      .nodeSort(null)
      .extent([
        [MARGEM.esquerda, MARGEM.topo],
        [LARGURA - MARGEM.direita, altura - MARGEM.baixo],
      ]);
    return gerador({
      nodes: nos.map((n) => ({ ...n })),
      links: fitas.map((f) => ({
        ...f,
        source: f.de,
        target: f.para,
        value: f.valor,
      })),
    });
  }, [nos, fitas, altura, LARGURA]);

  const caminho = sankeyLinkHorizontal<No, Ligacao>();
  const ultima = Math.max(...nos.map((n) => n.coluna));
  const xDaColuna = (coluna: number) =>
    desenho.nodes.find((n) => n.coluna === coluna)?.x0 ?? 0;
  const ligada = (l: Ligacao) =>
    realce === null ||
    (l.source as No).id === realce ||
    (l.target as No).id === realce;

  return (
    <>
      {rolaDeLado && (
        <p className="nota-curta grafico-de-fitas-arraste">{T.arraste}</p>
      )}
      <div ref={caixa} className="grafico-de-fitas-caixa">
        <svg
          className="grafico-de-fitas"
          viewBox={`0 0 ${LARGURA} ${altura}`}
          width={LARGURA}
          height={altura}
          role="img"
          aria-label={rotulo}
        >
          {colunas.map((titulo, i) => (
            <text
              key={titulo}
              className="fitas-coluna"
              x={i === ultima ? LARGURA - MARGEM.direita : xDaColuna(i)}
              y={14}
              textAnchor={i === ultima ? "end" : "start"}
            >
              {titulo}
            </text>
          ))}

          <g className="fitas-ligacoes">
            {desenho.links.map((l, i) => (
              <path
                key={i}
                d={caminho(l) ?? undefined}
                className={ligada(l) ? "fita" : "fita fita-apagada"}
                strokeWidth={Math.max(1, l.width ?? 0)}
              >
                <title>
                  {T.fita(
                    (l.source as No).rotulo,
                    (l.target as No).rotulo,
                    formatar(l.value),
                  )}
                </title>
              </path>
            ))}
          </g>

          <g className="fitas-caixas">
            {desenho.nodes.map((n) => {
              const naDireita = n.coluna === ultima;
              return (
                <g
                  key={n.id}
                  onMouseEnter={() => setRealce(n.id)}
                  onMouseLeave={() => setRealce(null)}
                >
                  <rect
                    x={n.x0}
                    y={n.y0}
                    width={(n.x1 ?? 0) - (n.x0 ?? 0)}
                    height={Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))}
                    className="fitas-caixa"
                  >
                    <title>{T.caixa(n.rotulo, formatar(n.value ?? 0))}</title>
                  </rect>
                  <text
                    className="fitas-rotulo"
                    x={naDireita ? (n.x0 ?? 0) - 6 : (n.x1 ?? 0) + 6}
                    y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2}
                    dy="0.35em"
                    textAnchor={naDireita ? "end" : "start"}
                  >
                    {n.rotulo}{" "}
                    <tspan className="fitas-valor">
                      {formatar(n.value ?? 0)}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </>
  );
}
