import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArestaDoGrafo, Grafo, NoDoGrafo } from '../api';

/**
 * O grafo desenhado (RF-33).
 *
 * ⚠️ **Canvas, não SVG.** São 655 nós e 5.268 arestas: em SVG cada aresta vira um nó do
 * DOM, e mexer no limiar refaz 6 mil elementos a cada quadro. Em Canvas é um laço.
 *
 * 🔴 As cores identificam COMUNIDADE e não têm significado político (RNF-16). A paleta
 * é categórica de propósito — nada de vermelho a azul, que o olho lê como espectro. A
 * legenda diz de quem é cada cor, e o número da comunidade é só um rótulo: quem manda é
 * a composição partidária, mostrada ao lado.
 */
export function TelaDoGrafo({
  grafo,
  cidadao,
  aoSelecionar,
}: {
  grafo: Grafo;
  /** Posição do cidadão, quando ele já respondeu o questionário. */
  cidadao?: { x: number; y: number; comunidade: number | null } | null;
  aoSelecionar?: (no: NoDoGrafo) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [limiar, setLimiar] = useState(0);
  const [sobre, setSobre] = useState<NoDoGrafo | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 800, altura: 600 });

  const posicionados = useMemo(
    () => grafo.nos.filter((n) => n.eixoX !== null && n.eixoY !== null),
    [grafo.nos],
  );

  const visiveis = useMemo(
    () => grafo.arestas.filter((a) => a.peso >= limiar),
    [grafo.arestas, limiar],
  );

  // ⚠️ Mapa por id: procurar num array de 655 a cada aresta seria O(n²).
  const porId = useMemo(
    () => new Map(posicionados.map((n) => [n.id, n])),
    [posicionados],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observador = new ResizeObserver(([entrada]) => {
      const { width } = entrada.contentRect;
      setTamanho({ largura: width, altura: Math.max(420, Math.round(width * 0.62)) });
    });

    observador.observe(canvas.parentElement!);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    desenhar(ctx, canvas, { nos: posicionados, arestas: visiveis, porId, sobre, cidadao });
  }, [posicionados, visiveis, porId, sobre, cidadao, tamanho]);

  return (
    <div className="grafo">
      <div className="grafo-tela">
        <canvas
          ref={canvasRef}
          width={tamanho.largura * DENSIDADE}
          height={tamanho.altura * DENSIDADE}
          style={{ width: '100%', height: tamanho.altura }}
          onMouseMove={aoMover}
          onMouseLeave={() => setSobre(null)}
          onClick={() => sobre && aoSelecionar?.(sobre)}
          role="img"
          aria-label={`Grafo de ${posicionados.length} parlamentares e ${visiveis.length} ligações`}
        />

        {sobre && (
          <div className="grafo-dica" style={posicaoDaDica(sobre, tamanho)}>
            <strong>{sobre.nome}</strong>
            <span>
              {sobre.partido}
              {sobre.uf && ` · ${sobre.uf}`}
            </span>
            <span className="grafo-dica-meta">
              {sobre.nVotacoes} votações · grupo {(sobre.comunidade ?? 0) + 1}
            </span>
          </div>
        )}
      </div>

      <div className="grafo-controles">
        <label>
          Mostrar só ligações mais fortes
          <input
            type="range"
            min={0}
            max={0.95}
            step={0.05}
            value={limiar}
            onChange={(e) => setLimiar(Number(e.target.value))}
          />
          <output>
            {visiveis.length} de {grafo.arestas.length} ligações
          </output>
        </label>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════

  function aoMover(evento: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const caixa = canvas.getBoundingClientRect();
    const x = evento.clientX - caixa.left;
    const y = evento.clientY - caixa.top;

    setSobre(maisProximo(posicionados, x, y, tamanho));
  }
}

// ═══════════════════════════════════════════════════════════════════

/** ⚠️ Retina: sem isto o desenho sai borrado em tela de alta densidade. */
const DENSIDADE = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

const MARGEM = 28;
const RAIO = 3.2;

/**
 * 🔴 Paleta CATEGÓRICA — rótulo, não escala (RNF-16).
 *
 * ⚠️ Vermelho→azul seria lido como espectro político mesmo sem nós dizermos nada. Os
 * tons são distinguíveis entre si e nenhum deles é cor de partido brasileiro.
 */
const CORES = [
  '#0f766e', '#b45309', '#4338ca', '#a21caf',
  '#0e7490', '#7c2d12', '#4d7c0f', '#9f1239',
];

function corDaComunidade(comunidade: number | null): string {
  return comunidade === null ? '#94a3b8' : CORES[comunidade % CORES.length];
}

type Tamanho = { largura: number; altura: number };

/** Converte a coordenada do layout (≈ −1 a 1) em pixel da tela. */
function paraTela(no: NoDoGrafo, t: Tamanho): { x: number; y: number } {
  return {
    x: MARGEM + ((no.eixoX! + 1) / 2) * (t.largura - MARGEM * 2),
    y: MARGEM + ((no.eixoY! + 1) / 2) * (t.altura - MARGEM * 2),
  };
}

function maisProximo(
  nos: NoDoGrafo[],
  x: number,
  y: number,
  t: Tamanho,
): NoDoGrafo | null {
  let achado: NoDoGrafo | null = null;
  let menor = 12 * 12; // ⚠️ raio de captura ao quadrado — evita a raiz quadrada

  for (const no of nos) {
    const p = paraTela(no, t);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < menor) {
      menor = d;
      achado = no;
    }
  }

  return achado;
}

function posicaoDaDica(no: NoDoGrafo, t: Tamanho): React.CSSProperties {
  const p = paraTela(no, t);

  // ⚠️ Vira para a esquerda perto da borda direita, senão a dica sai da tela.
  return p.x > t.largura - 180
    ? { right: t.largura - p.x + 12, top: p.y - 10 }
    : { left: p.x + 12, top: p.y - 10 };
}

function desenhar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dados: {
    nos: NoDoGrafo[];
    arestas: ArestaDoGrafo[];
    porId: Map<number, NoDoGrafo>;
    sobre: NoDoGrafo | null;
    cidadao?: { x: number; y: number; comunidade: number | null } | null;
  },
) {
  const t = {
    largura: canvas.width / DENSIDADE,
    altura: canvas.height / DENSIDADE,
  };

  ctx.setTransform(DENSIDADE, 0, 0, DENSIDADE, 0, 0);
  ctx.clearRect(0, 0, t.largura, t.altura);

  const escuro = matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

  // ── arestas primeiro, para ficarem atrás dos nós ──
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = escuro ? 'rgba(140,155,170,.16)' : 'rgba(70,90,110,.13)';
  ctx.beginPath();
  for (const aresta of dados.arestas) {
    const a = dados.porId.get(aresta.de);
    const b = dados.porId.get(aresta.para);
    if (!a || !b) continue;

    const pa = paraTela(a, t);
    const pb = paraTela(b, t);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();

  // ── nós ──
  for (const no of dados.nos) {
    const p = paraTela(no, t);
    const destacado = dados.sobre?.id === no.id;

    ctx.beginPath();
    ctx.arc(p.x, p.y, destacado ? RAIO * 2 : RAIO, 0, Math.PI * 2);
    ctx.fillStyle = corDaComunidade(no.comunidade);
    ctx.globalAlpha = destacado ? 1 : 0.82;
    ctx.fill();

    if (destacado) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = escuro ? '#0b0e11' : '#ffffff';
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // ── o cidadão, se já respondeu ──
  if (dados.cidadao) {
    const p = paraTela(
      { eixoX: dados.cidadao.x, eixoY: dados.cidadao.y } as NoDoGrafo,
      t,
    );

    // ⚠️ Forma DIFERENTE, não só cor: o cidadão não é parlamentar, e a distinção
    //    precisa sobreviver a daltonismo e a impressão em preto e branco.
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 9);
    ctx.lineTo(p.x + 9, p.y);
    ctx.lineTo(p.x, p.y + 9);
    ctx.lineTo(p.x - 9, p.y);
    ctx.closePath();
    ctx.fillStyle = escuro ? '#e6eaee' : '#12161b';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = escuro ? '#0b0e11' : '#ffffff';
    ctx.stroke();
  }
}
