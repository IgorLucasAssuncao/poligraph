import { useEffect, useMemo, useRef, useState } from "react";
import {
  sankey,
  sankeyJustify,
  sankeyLinkHorizontal,
  type SankeyLink,
  type SankeyNode,
} from "d3-sankey";
import { TEXTOS_DOS_COMPONENTES } from "../textos/componentes";
import {
  linhasDosRotulos,
  lugaresDosRotulos,
  medidorDeRotulo,
} from "./rotulosDasFitas";

const T = TEXTOS_DOS_COMPONENTES.fitas;

/** Uma caixa de uma coluna: o id liga as fitas, o rótulo vai na tela. */
export type NoDasFitas = { id: string; rotulo: string; coluna: number };

/** Uma fita: de uma caixa à da coluna seguinte, com o valor que passou por ela. */
export type Fita = { de: string; para: string; valor: number };

type No = SankeyNode<NoDasFitas, Fita>;
type Ligacao = SankeyLink<NoDasFitas, Fita>;

/** A largura antes de medir o espaço da página, e a menor com que o desenho deitado ainda cabe os rótulos. */
const LARGURA_INICIAL = 960;
const LARGURA_MINIMA = 560;
/** O desenho em pé, do celular: a margem do lado, a espessura de cada faixa, a altura de uma linha de rótulo, do título e das fitas. */
const VERTICAL = { lateral: 4, faixa: 12, linha: 17, titulo: 20, fluxo: 84 };
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
 * coluna estreita da página da cidade.
 *
 * DECISÃO (2026-10-23): abaixo de `LARGURA_MINIMA` o desenho fica em pé. Cada coluna vira uma faixa da largura da tela, de
 * cima para baixo, e os nomes vão embaixo dela. Deitado, ele rolava de lado no celular: três colunas em 358 px não cabem os
 * nomes.
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
  const emPe = medida < LARGURA_MINIMA;

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

  const lugares = useMemo(
    () =>
      lugaresDosRotulos(
        desenho.nodes.map((n) => ({
          id: n.id,
          coluna: n.coluna,
          x0: n.x0 ?? 0,
          x1: n.x1 ?? 0,
          y0: n.y0 ?? 0,
          y1: n.y1 ?? 0,
          nome: n.rotulo,
          valor: formatar(n.value ?? 0),
        })),
        medidorDeRotulo(),
      ),
    [desenho, formatar],
  );
  const caminho = sankeyLinkHorizontal<No, Ligacao>();
  const ultima = Math.max(...nos.map((n) => n.coluna));
  const xDaColuna = (coluna: number) =>
    desenho.nodes.find((n) => n.coluna === coluna)?.x0 ?? 0;
  const ligada = (l: Ligacao) =>
    realce === null ||
    (l.source as No).id === realce ||
    (l.target as No).id === realce;

  if (emPe) {
    return (
      <div ref={caixa} className="grafico-de-fitas-caixa">
        <FitasEmPeComponent
          rotulo={rotulo}
          colunas={colunas}
          nos={nos}
          fitas={fitas}
          formatar={formatar}
          largura={Math.max(260, medida)}
          realce={realce}
          aoRealcar={setRealce}
        />
      </div>
    );
  }

  return (
    <>
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
              const lugar = lugares.get(n.id);
              const naEsquerda = lugar?.lado === "esquerda";
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
                    x={naEsquerda ? (n.x0 ?? 0) - 6 : (n.x1 ?? 0) + 6}
                    y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2}
                    dy="0.35em"
                    textAnchor={naEsquerda ? "end" : "start"}
                  >
                    {n.rotulo}
                    {lugar?.comValor !== false && (
                      <>
                        {" "}
                        <tspan className="fitas-valor">
                          {formatar(n.value ?? 0)}
                        </tspan>
                      </>
                    )}
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

/**
 * O gráfico de fitas em pé, para a tela estreita: as colunas viram faixas de cima para baixo, e as fitas descem de uma à outra.
 *
 * Os nomes ficam embaixo de cada faixa, centrados no pedaço; o que não cabe ao lado de outro desce uma linha e ganha um traço
 * até o pedaço (`linhasDosRotulos`).
 */
function FitasEmPeComponent({
  rotulo,
  colunas,
  nos,
  fitas,
  formatar,
  largura,
  realce,
  aoRealcar,
}: {
  rotulo: string;
  colunas: readonly string[];
  nos: NoDasFitas[];
  fitas: Fita[];
  formatar: (valor: number) => string;
  largura: number;
  realce: string | null;
  aoRealcar: (id: string | null) => void;
}) {
  const V = VERTICAL;
  const desenho = useMemo(() => {
    const gerador = sankey<NoDasFitas, Fita>()
      .nodeId((n) => n.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(V.faixa)
      .nodePadding(6)
      .nodeSort(null)
      .extent([
        [0, V.lateral],
        [100, largura - V.lateral],
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
  }, [nos, fitas, largura, V.faixa, V.lateral]);

  const ultima = Math.max(...nos.map((n) => n.coluna));
  const medir = useMemo(() => medidorDeRotulo(), []);
  const porColuna = useMemo(
    () =>
      Array.from({ length: ultima + 1 }, (_, coluna) =>
        linhasDosRotulos(
          desenho.nodes
            .filter((n) => n.coluna === coluna)
            .map((n) => ({
              id: n.id,
              inicio: n.y0 ?? 0,
              fim: n.y1 ?? 0,
              nome: n.rotulo,
              valor: formatar(n.value ?? 0),
            })),
          medir,
          largura,
        ),
      ),
    [desenho, ultima, formatar, medir, largura],
  );

  const topo: number[] = [];
  porColuna.forEach((_, i) => {
    topo.push(
      i === 0
        ? V.titulo
        : topo[i - 1] +
            V.faixa +
            porColuna[i - 1].linhas * V.linha +
            V.fluxo +
            V.titulo,
    );
  });
  const altura =
    topo[ultima] + V.faixa + porColuna[ultima].linhas * V.linha + 6;
  const ligada = (l: Ligacao) =>
    realce === null ||
    (l.source as No).id === realce ||
    (l.target as No).id === realce;

  return (
    <svg
      className="grafico-de-fitas em-pe"
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura}
      height={altura}
      role="img"
      aria-label={rotulo}
    >
      <g className="fitas-ligacoes">
        {desenho.links.map((l, i) => {
          const de = l.source as No;
          const para = l.target as No;
          const y0 = topo[de.coluna] + V.faixa;
          const y1 = topo[para.coluna];
          const meio = (y0 + y1) / 2;
          return (
            <path
              key={i}
              d={`M${l.y0},${y0}C${l.y0},${meio} ${l.y1},${meio} ${l.y1},${y1}`}
              className={ligada(l) ? "fita" : "fita fita-apagada"}
              strokeWidth={Math.max(1, l.width ?? 0)}
            >
              <title>{T.fita(de.rotulo, para.rotulo, formatar(l.value))}</title>
            </path>
          );
        })}
      </g>

      {colunas.map((titulo, i) => (
        <text
          key={titulo}
          className="fitas-coluna"
          x={V.lateral}
          y={topo[i] - 6}
        >
          {titulo}
        </text>
      ))}

      <g className="fitas-caixas">
        {desenho.nodes.map((n) => {
          const lugar = porColuna[n.coluna].lugares.get(n.id);
          const baseDaFaixa = topo[n.coluna] + V.faixa;
          const y = baseDaFaixa + 13 + (lugar?.linha ?? 0) * V.linha;
          const centro = ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2;
          return (
            <g
              key={n.id}
              onMouseEnter={() => aoRealcar(n.id)}
              onMouseLeave={() => aoRealcar(null)}
            >
              <rect
                x={n.y0}
                y={topo[n.coluna]}
                width={Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))}
                height={V.faixa}
                className="fitas-caixa"
              >
                <title>{T.caixa(n.rotulo, formatar(n.value ?? 0))}</title>
              </rect>
              {(lugar?.linha ?? 0) > 0 && (
                <line
                  className="fitas-guia"
                  x1={centro}
                  y1={baseDaFaixa + 1}
                  x2={centro}
                  y2={y - 11}
                />
              )}
              <text className="fitas-rotulo" x={lugar?.x ?? 0} y={y}>
                {n.rotulo}{" "}
                <tspan className="fitas-valor">{formatar(n.value ?? 0)}</tspan>
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
