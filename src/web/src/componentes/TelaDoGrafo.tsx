import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArestaDoGrafo, Grafo, NoDoGrafo } from '../api';

export type PosicaoDoCidadao = {
  eixoX: number;
  eixoY: number;
  comunidade: number | null;
  vizinhosUsados: number;
  baseDeVotacoes: number;
};

type Camera = { escala: number; x: number; y: number };
type Tamanho = { largura: number; altura: number };
type Alvo = { tipo: 'no'; no: NoDoGrafo } | { tipo: 'aresta'; aresta: ArestaDoGrafo };

/**
 * O grafo desenhado, navegável (RF-33).
 *
 * ⚠️ **Canvas, não SVG.** São 655 nós e 5.268 arestas: em SVG cada aresta vira um nó do
 * DOM, e cada quadro de zoom refaria 6 mil elementos.
 *
 * 🔴 As cores identificam COMUNIDADE e não têm significado político (RNF-16). Paleta
 * categórica de propósito — vermelho→azul seria lido como espectro mesmo sem dizermos
 * nada.
 */
export function TelaDoGrafo({
  grafo,
  cidadao,
  aoSelecionar,
  altura,
  aoAmpliar,
}: {
  grafo: Grafo;
  cidadao?: PosicaoDoCidadao | null;
  aoSelecionar?: (no: NoDoGrafo) => void;
  /** Fixa a altura; sem isto acompanha a largura. */
  altura?: number;
  /** ⚠️ Quando presente, vira um botão NA MOLDURA do grafo — não um link solto na
   *  página, que se perde entre os textos abaixo do desenho. */
  aoAmpliar?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrastando = useRef<{ x: number; y: number } | null>(null);

  const [camera, setCamera] = useState<Camera>({ escala: 1, x: 0, y: 0 });
  const [limiar, setLimiar] = useState(0);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [fixado, setFixado] = useState<NoDoGrafo | null>(null);
  const [tamanho, setTamanho] = useState<Tamanho>({ largura: 800, altura: altura ?? 520 });

  const posicionados = useMemo(
    () => grafo.nos.filter((n) => n.eixoX !== null && n.eixoY !== null),
    [grafo.nos],
  );

  const porId = useMemo(
    () => new Map(posicionados.map((n) => [n.id, n])),
    [posicionados],
  );

  const visiveis = useMemo(
    () => grafo.arestas.filter((a) => a.peso >= limiar),
    [grafo.arestas, limiar],
  );

  /**
   * ⭐ Vizinhança do nó em foco. É o gesto que torna o grafo legível: com 5 mil
   * arestas, olhar um deputado sem apagar o resto não informa nada.
   */
  const emFoco = fixado ?? (alvo?.tipo === 'no' ? alvo.no : null);
  const vizinhos = useMemo(() => {
    if (!emFoco) return null;

    const conjunto = new Set<number>([emFoco.id]);
    for (const a of visiveis) {
      if (a.de === emFoco.id) conjunto.add(a.para);
      else if (a.para === emFoco.id) conjunto.add(a.de);
    }

    return conjunto;
  }, [emFoco, visiveis]);

  useEffect(() => {
    const pai = canvasRef.current?.parentElement;
    if (!pai) return;

    const observador = new ResizeObserver(([entrada]) => {
      const { width } = entrada.contentRect;
      setTamanho({
        largura: width,
        altura: altura ?? Math.max(420, Math.round(width * 0.62)),
      });
    });

    observador.observe(pai);
    return () => observador.disconnect();
  }, [altura]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    desenhar(ctx, canvas, {
      nos: posicionados,
      arestas: visiveis,
      porId,
      alvo,
      emFoco,
      vizinhos,
      cidadao,
      camera,
    });
  }, [posicionados, visiveis, porId, alvo, emFoco, vizinhos, cidadao, camera, tamanho]);

  // ⚠️ `passive: false` é obrigatório: sem isto o navegador ignora o
  //    `preventDefault` e a página inteira rola junto com o zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function aoRolar(evento: WheelEvent) {
      evento.preventDefault();

      const caixa = canvas!.getBoundingClientRect();
      const px = evento.clientX - caixa.left;
      const py = evento.clientY - caixa.top;

      setCamera((atual) => aproximar(atual, px, py, evento.deltaY));
    }

    canvas.addEventListener('wheel', aoRolar, { passive: false });
    return () => canvas.removeEventListener('wheel', aoRolar);
  }, []);

  const aoMover = useCallback(
    (evento: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const caixa = canvas.getBoundingClientRect();
      const px = evento.clientX - caixa.left;
      const py = evento.clientY - caixa.top;

      if (arrastando.current) {
        const dx = px - arrastando.current.x;
        const dy = py - arrastando.current.y;
        arrastando.current = { x: px, y: py };
        setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
        return;
      }

      setAlvo(alvoSob(posicionados, visiveis, porId, px, py, tamanho, camera));
    },
    [posicionados, visiveis, porId, tamanho, camera],
  );

  return (
    <div className="grafo">
      <div className="grafo-tela">
        <canvas
          ref={canvasRef}
          width={tamanho.largura * DENSIDADE}
          height={tamanho.altura * DENSIDADE}
          style={{
            width: '100%',
            height: tamanho.altura,
            cursor: arrastando.current ? 'grabbing' : alvo ? 'pointer' : 'grab',
          }}
          onMouseMove={aoMover}
          onMouseDown={(e) => {
            const caixa = e.currentTarget.getBoundingClientRect();
            arrastando.current = { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
          }}
          onMouseUp={() => (arrastando.current = null)}
          onMouseLeave={() => {
            arrastando.current = null;
            setAlvo(null);
          }}
          onClick={aoClicar}
          onDoubleClick={() => aoSelecionar && emFoco && aoSelecionar(emFoco)}
          role="img"
          aria-label={`Grafo de ${posicionados.length} parlamentares e ${visiveis.length} ligações`}
        />

        {alvo && <Dica alvo={alvo} porId={porId} tamanho={tamanho} camera={camera} />}

        {/* ⭐ Os controles moram sobre o desenho, junto do que eles controlam. */}
        <div className="grafo-zoom">
          <button type="button" onClick={() => setCamera((c) => aproximar(c, tamanho.largura / 2, tamanho.altura / 2, -240))} aria-label="Aproximar">+</button>
          <button type="button" onClick={() => setCamera((c) => aproximar(c, tamanho.largura / 2, tamanho.altura / 2, 240))} aria-label="Afastar">−</button>
          <button type="button" onClick={() => { setCamera({ escala: 1, x: 0, y: 0 }); setFixado(null); }} aria-label="Enquadrar tudo">⤢</button>
        </div>

        {aoAmpliar && (
          <button type="button" className="grafo-ampliar" onClick={aoAmpliar}>
            <span aria-hidden="true">⛶</span> Abrir em tela cheia
          </button>
        )}

        {fixado && (
          <p className="grafo-foco">
            Mostrando <strong>{fixado.nome}</strong> e quem vota com {ehFeminino(fixado.nome) ? 'ela' : 'ele'}.{' '}
            <button type="button" className="botao-texto" onClick={() => setFixado(null)}>
              Ver todos
            </button>
          </p>
        )}
      </div>

      <div className="grafo-controles">
        <label>
          Só ligações mais fortes
          <input
            type="range"
            min={0}
            max={0.95}
            step={0.05}
            value={limiar}
            onChange={(e) => setLimiar(Number(e.target.value))}
          />
          <output>
            {visiveis.length} de {grafo.arestas.length}
          </output>
        </label>
        <p className="grafo-ajuda-uso">
          Rolar para aproximar · arrastar para mover · clicar isola quem vota junto ·
          clicar duas vezes abre o perfil
        </p>
      </div>
    </div>
  );

  function aoClicar() {
    if (alvo?.tipo !== 'no') return;

    setFixado((atual) => (atual?.id === alvo.no.id ? null : alvo.no));
  }
}

// ═══════════════════════════════════════════════════════════════════

function Dica({
  alvo,
  porId,
  tamanho,
  camera,
}: {
  alvo: Alvo;
  porId: Map<number, NoDoGrafo>;
  tamanho: Tamanho;
  camera: Camera;
}) {
  const ancora =
    alvo.tipo === 'no'
      ? paraTela(alvo.no.eixoX!, alvo.no.eixoY!, tamanho, camera)
      : meioDaAresta(alvo.aresta, porId, tamanho, camera);

  if (!ancora) return null;

  const estilo: React.CSSProperties =
    ancora.x > tamanho.largura - 190
      ? { right: tamanho.largura - ancora.x + 14, top: ancora.y - 12 }
      : { left: ancora.x + 14, top: ancora.y - 12 };

  if (alvo.tipo === 'aresta') {
    const a = porId.get(alvo.aresta.de);
    const b = porId.get(alvo.aresta.para);

    return (
      <div className="grafo-dica" style={estilo}>
        <strong>{a?.nome}</strong>
        <strong>{b?.nome}</strong>
        {/* ⚠️ "Peso" é jargão nosso. Na tela, o que o número significa. */}
        <span className="grafo-dica-meta">
          votaram igual em {Math.round(alvo.aresta.peso * 100)}% das votações em comum
        </span>
      </div>
    );
  }

  const no = alvo.no;

  return (
    <div className="grafo-dica" style={estilo}>
      <strong>{no.nome}</strong>
      <span>
        {no.partido}
        {no.uf && ` · ${no.uf}`}
      </span>
      <span className="grafo-dica-meta">
        {no.nVotacoes} votações · grupo {(no.comunidade ?? 0) + 1}
      </span>
    </div>
  );
}

/** ⚠️ Retina: sem isto o desenho sai borrado em tela de alta densidade. */
const DENSIDADE = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

const MARGEM = 30;
const RAIO = 3.2;
const ESCALA_MINIMA = 0.6;
const ESCALA_MAXIMA = 14;

/**
 * 🔴 Paleta CATEGÓRICA — rótulo, não escala (RNF-16). Nenhum destes tons é cor de
 * partido brasileiro, e a sequência não sugere um eixo.
 */
const CORES = [
  '#0f766e', '#b45309', '#4338ca', '#a21caf',
  '#0e7490', '#7c2d12', '#4d7c0f', '#9f1239',
];

function corDaComunidade(comunidade: number | null): string {
  return comunidade === null ? '#94a3b8' : CORES[comunidade % CORES.length];
}

/** ⭐ Aproxima no PONTO DO CURSOR, não no centro — é o que faz o zoom parecer natural. */
function aproximar(camera: Camera, px: number, py: number, deltaY: number): Camera {
  const fator = Math.exp(-deltaY * 0.0015);
  const escala = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, camera.escala * fator));
  const real = escala / camera.escala;

  return {
    escala,
    x: px - (px - camera.x) * real,
    y: py - (py - camera.y) * real,
  };
}

function paraTela(ex: number, ey: number, t: Tamanho, c: Camera) {
  const base = {
    x: MARGEM + ((ex + 1) / 2) * (t.largura - MARGEM * 2),
    y: MARGEM + ((ey + 1) / 2) * (t.altura - MARGEM * 2),
  };

  return { x: base.x * c.escala + c.x, y: base.y * c.escala + c.y };
}

function meioDaAresta(
  aresta: ArestaDoGrafo,
  porId: Map<number, NoDoGrafo>,
  t: Tamanho,
  c: Camera,
) {
  const a = porId.get(aresta.de);
  const b = porId.get(aresta.para);
  if (!a || !b) return null;

  const pa = paraTela(a.eixoX!, a.eixoY!, t, c);
  const pb = paraTela(b.eixoX!, b.eixoY!, t, c);

  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
}

/** ⚠️ Nó vence aresta: o alvo pequeno tem de ser o mais fácil de acertar. */
function alvoSob(
  nos: NoDoGrafo[],
  arestas: ArestaDoGrafo[],
  porId: Map<number, NoDoGrafo>,
  x: number,
  y: number,
  t: Tamanho,
  c: Camera,
): Alvo | null {
  let achado: NoDoGrafo | null = null;
  let menor = 144;

  for (const no of nos) {
    const p = paraTela(no.eixoX!, no.eixoY!, t, c);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < menor) {
      menor = d;
      achado = no;
    }
  }

  if (achado) return { tipo: 'no', no: achado };

  // ⚠️ Só procura aresta perto do cursor; varrer 5 mil segmentos por movimento do
  //    mouse derrubaria o quadro.
  let arestaAchada: ArestaDoGrafo | null = null;
  let menorDistancia = 5;

  for (const aresta of arestas) {
    const a = porId.get(aresta.de);
    const b = porId.get(aresta.para);
    if (!a || !b) continue;

    const pa = paraTela(a.eixoX!, a.eixoY!, t, c);
    const pb = paraTela(b.eixoX!, b.eixoY!, t, c);
    const d = distanciaAoSegmento(x, y, pa, pb);

    if (d < menorDistancia) {
      menorDistancia = d;
      arestaAchada = aresta;
    }
  }

  return arestaAchada ? { tipo: 'aresta', aresta: arestaAchada } : null;
}

function distanciaAoSegmento(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimento = dx * dx + dy * dy;

  if (comprimento === 0) return Math.hypot(x - a.x, y - a.y);

  // projeção do ponto sobre o segmento, presa entre as duas pontas
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / comprimento));

  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

/** ⚠️ Heurística de concordância só para o texto do foco; erra e não custa nada. */
function ehFeminino(nome: string): boolean {
  return /a$/i.test(nome.split(' ')[0]);
}

function desenhar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  d: {
    nos: NoDoGrafo[];
    arestas: ArestaDoGrafo[];
    porId: Map<number, NoDoGrafo>;
    alvo: Alvo | null;
    emFoco: NoDoGrafo | null;
    vizinhos: Set<number> | null;
    cidadao?: PosicaoDoCidadao | null;
    camera: Camera;
  },
) {
  const t = { largura: canvas.width / DENSIDADE, altura: canvas.height / DENSIDADE };

  ctx.setTransform(DENSIDADE, 0, 0, DENSIDADE, 0, 0);
  ctx.clearRect(0, 0, t.largura, t.altura);

  const escuro = matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const arestaEmAlvo = d.alvo?.tipo === 'aresta' ? d.alvo.aresta : null;

  for (const aresta of d.arestas) {
    const a = d.porId.get(aresta.de);
    const b = d.porId.get(aresta.para);
    if (!a || !b) continue;

    const naVizinhanca =
      !d.vizinhos || (d.vizinhos.has(aresta.de) && d.vizinhos.has(aresta.para));
    const destacada = arestaEmAlvo === aresta;

    ctx.beginPath();
    const pa = paraTela(a.eixoX!, a.eixoY!, t, d.camera);
    const pb = paraTela(b.eixoX!, b.eixoY!, t, d.camera);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);

    ctx.lineWidth = destacada ? 2 : 0.5;
    ctx.strokeStyle = destacada
      ? corDaComunidade(a.comunidade)
      : escuro
        ? `rgba(140,155,170,${naVizinhanca ? 0.22 : 0.04})`
        : `rgba(70,90,110,${naVizinhanca ? 0.18 : 0.035})`;
    ctx.stroke();
  }

  for (const no of d.nos) {
    const p = paraTela(no.eixoX!, no.eixoY!, t, d.camera);
    const destacado = d.emFoco?.id === no.id;
    const apagado = d.vizinhos ? !d.vizinhos.has(no.id) : false;

    ctx.beginPath();
    ctx.arc(p.x, p.y, destacado ? RAIO * 2.2 : RAIO, 0, Math.PI * 2);
    ctx.fillStyle = corDaComunidade(no.comunidade);
    ctx.globalAlpha = apagado ? 0.12 : destacado ? 1 : 0.82;
    ctx.fill();

    if (destacado) {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = escuro ? '#0b0e11' : '#ffffff';
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  if (d.cidadao) {
    const p = paraTela(d.cidadao.eixoX, d.cidadao.eixoY, t, d.camera);

    // ⚠️ Forma DIFERENTE, não só cor: o cidadão não é parlamentar, e a distinção
    //    precisa sobreviver a daltonismo e a impressão em preto e branco.
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 10);
    ctx.lineTo(p.x + 10, p.y);
    ctx.lineTo(p.x, p.y + 10);
    ctx.lineTo(p.x - 10, p.y);
    ctx.closePath();
    ctx.fillStyle = escuro ? '#e6eaee' : '#12161b';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = escuro ? '#0b0e11' : '#ffffff';
    ctx.stroke();

    ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillStyle = escuro ? '#e6eaee' : '#12161b';
    ctx.textAlign = 'center';
    ctx.fillText('você', p.x, p.y + 24);
  }
}
