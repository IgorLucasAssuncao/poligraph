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

/**
 * ⭐ PL43 — as duas maneiras de posicionar um deputado, lado a lado para comparar.
 *
 * `molas` desenha bem e ⛔ não interpreta nada. `componentes` (SVD) tem eixo com
 * significado, mas convida o leitor a ler espectro político.
 */
export type Layout = 'molas' | 'componentes';

/**
 * ⚠️ A explicação de cada layout vive JUNTO do seletor, não num rodapé.
 *
 * 🔴 A do SVD precisa dizer o que o centro NÃO é. Medido na legislatura 57: os 80 nós
 * mais centrais têm mediana de 472 votações; os 80 mais extremos, 925 (r = 0,566). Quem
 * faltou é empurrado para o meio, e sem esse aviso o leitor conclui que ali estão os
 * moderados.
 */
const EXPLICACAO: Record<Layout, { rotulo: string; titulo: string; texto: string }> = {
  molas: {
    rotulo: 'Molas',
    titulo: 'Ligações como molas',
    texto:
      'Cada ligação puxa dois deputados para perto; todos se repelem. Quem vota junto ' +
      'fica junto. Os eixos não significam nada: girar a figura não muda o que ela ' +
      'diz. A forma redonda é escolha do algoritmo, não do dado.',
  },
  componentes: {
    rotulo: 'Componentes',
    titulo: 'Direção de maior diferença',
    texto:
      'O eixo horizontal é a direção em que os deputados mais se diferenciam — ela ' +
      'sozinha explica 34,6% do comportamento de voto, contra 9,6% do eixo vertical. ' +
      'Por isso a figura é achatada: a Câmara se divide quase em uma linha só. ' +
      'Atenção: o centro não é moderação — quem faltou a muitas votações também cai ali.',
  },
};
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
  const arrastandoNo = useRef<NoDoGrafo | null>(null);

  /**
   * ⚠️ Deslocamentos manuais de nó, em coordenada do LAYOUT.
   *
   * ⛔ Não voltam para o banco, de propósito: `nos_metrica` é retrato reproduzível da
   * execução do ETL, e deixar o usuário reescrever isso destruiria a garantia de que a
   * banca reproduz a mesma figura. Arrastar é para enxergar, não para corrigir.
   */
  const [movidos, setMovidos] = useState<Map<number, { x: number; y: number }>>(new Map());

  const [camera, setCamera] = useState<Camera>({ escala: 1, x: 0, y: 0 });
  const [limiar, setLimiar] = useState(0);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [fixado, setFixado] = useState<NoDoGrafo | null>(null);

  /**
   * ⭐ Isolado ⛔ não é o mesmo que fixado.
   *
   * Fixado apaga o resto mas o mantém no desenho — dá contexto. Isolado REMOVE tudo o
   * que não é vizinho, e aí o zoom passa a valer a pena: 30 pontos em vez de 643.
   */
  const [isolado, setIsolado] = useState<NoDoGrafo | null>(null);
  const [busca, setBusca] = useState('');
  const [layout, setLayout] = useState<Layout>('molas');
  const [tamanho, setTamanho] = useState<Tamanho>({ largura: 800, altura: altura ?? 520 });

  const posicionados = useMemo(() => {
    // ⚠️ O nó carrega as duas posições; aqui uma delas é promovida a `eixoX`/`eixoY`
    //    para o resto do desenho não precisar saber qual layout está ativo.
    const comLayout = grafo.nos.map((n) =>
      layout === 'componentes'
        ? { ...n, eixoX: n.componente1, eixoY: n.componente2 }
        : n,
    );

    return comLayout
      .filter((n) => n.eixoX !== null && n.eixoY !== null)
      .map((n) => {
        const movido = movidos.get(n.id);
        return movido ? { ...n, eixoX: movido.x, eixoY: movido.y } : n;
      });
  }, [grafo.nos, movidos, layout]);

  const porId = useMemo(
    () => new Map(posicionados.map((n) => [n.id, n])),
    [posicionados],
  );

  const arestasDoLimiar = useMemo(
    () => grafo.arestas.filter((a) => a.peso >= limiar),
    [grafo.arestas, limiar],
  );

  const visiveis = useMemo(() => {
    if (!isolado) return arestasDoLimiar;

    return arestasDoLimiar.filter((a) => a.de === isolado.id || a.para === isolado.id);
  }, [arestasDoLimiar, isolado]);

  /**
   * ⭐ Vizinhança do nó em foco. É o gesto que torna o grafo legível: com 5 mil
   * arestas, olhar um deputado sem apagar o resto não informa nada.
   */
  const emFoco = isolado ?? fixado ?? (alvo?.tipo === 'no' ? alvo.no : null);

  const vizinhos = useMemo(() => {
    if (!emFoco) return null;

    const conjunto = new Set<number>([emFoco.id]);
    for (const a of visiveis) {
      if (a.de === emFoco.id) conjunto.add(a.para);
      else if (a.para === emFoco.id) conjunto.add(a.de);
    }

    return conjunto;
  }, [emFoco, visiveis]);

  /**
   * ⭐ Achar alguém sem caçar ponto por ponto. Com 643 nós, encontrar o Arthur Lira
   * passando o mouse é inviável — e era o gesto que o desenho obrigava.
   */
  const achados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 2) return [];

    return posicionados
      .filter((n) => n.nome.toLowerCase().includes(termo))
      .slice(0, MAX_SUGESTOES);
  }, [busca, posicionados]);

  const noDesenho = useMemo(
    () => (isolado && vizinhos ? posicionados.filter((n) => vizinhos.has(n.id)) : posicionados),
    [isolado, vizinhos, posicionados],
  );

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
      nos: noDesenho,
      arestas: visiveis,
      porId,
      alvo,
      emFoco,
      vizinhos,
      cidadao,
      camera,
    });
  }, [noDesenho, visiveis, porId, alvo, emFoco, vizinhos, cidadao, camera, tamanho]);

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

        const no = arrastandoNo.current;
        if (no) {
          // ⚠️ O deslocamento vem em PIXEL e precisa virar coordenada de layout, senão
          //    o nó anda mais rápido que o cursor conforme o zoom aumenta.
          const escalaX = (2 / (tamanho.largura - MARGEM * 2)) / camera.escala;
          const escalaY = (2 / (tamanho.altura - MARGEM * 2)) / camera.escala;

          setMovidos((atual) => {
            const novo = new Map(atual);
            const base = novo.get(no.id) ?? { x: no.eixoX!, y: no.eixoY! };
            novo.set(no.id, { x: base.x + dx * escalaX, y: base.y + dy * escalaY });
            return novo;
          });
          return;
        }

        setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
        return;
      }

      setAlvo(alvoSob(noDesenho, visiveis, porId, px, py, tamanho, camera));
    },
    [noDesenho, visiveis, porId, tamanho, camera],
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
            const ponto = { x: e.clientX - caixa.left, y: e.clientY - caixa.top };

            // ⭐ Sobre um nó, arrasta o NÓ; no vazio, arrasta o mapa.
            if (alvo?.tipo === 'no') arrastandoNo.current = alvo.no;
            arrastando.current = ponto;
          }}
          onMouseUp={() => {
            arrastando.current = null;
            arrastandoNo.current = null;
          }}
          onMouseLeave={() => {
            arrastando.current = null;
            arrastandoNo.current = null;
            setAlvo(null);
          }}
          onClick={aoClicar}
          onDoubleClick={() => aoSelecionar && emFoco && aoSelecionar(emFoco)}
          role="img"
          aria-label={`Grafo de ${noDesenho.length} parlamentares e ${visiveis.length} ligações`}
        />

        {alvo && <Dica alvo={alvo} porId={porId} tamanho={tamanho} camera={camera} />}

        {/* ⭐ Os controles moram sobre o desenho, junto do que eles controlam. */}
        <div className="grafo-zoom">
          <button type="button" onClick={() => setCamera((c) => aproximar(c, tamanho.largura / 2, tamanho.altura / 2, -240))} aria-label="Aproximar">+</button>
          <button type="button" onClick={() => setCamera((c) => aproximar(c, tamanho.largura / 2, tamanho.altura / 2, 240))} aria-label="Afastar">−</button>
          <button type="button" onClick={() => {
            setCamera({ escala: 1, x: 0, y: 0 });
            setFixado(null);
            setIsolado(null);
            setMovidos(new Map());   // ⚠️ devolve o desenho ao retrato do ETL
          }} aria-label="Enquadrar tudo e desfazer">⤢</button>
        </div>

        {/* ⭐ PL43: o seletor fica NA moldura, para comparar sem sair da tela. */}
        <div className="grafo-layout">
          <div className="grafo-layout-botoes" role="group" aria-label="Como posicionar os pontos">
            {(Object.keys(EXPLICACAO) as Layout[]).map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={layout === opcao ? 'ativo' : ''}
                aria-pressed={layout === opcao}
                title={EXPLICACAO[opcao].titulo}
                onClick={() => {
                  setLayout(opcao);
                  setCamera({ escala: 1, x: 0, y: 0 });
                  setMovidos(new Map());
                }}
              >
                {EXPLICACAO[opcao].rotulo}
              </button>
            ))}
          </div>

          {/* 🔴 A ressalva do SVD não é opcional: sem ela o leitor lê o centro como
              moderação, quando ali também está quem faltou. */}
          <p className="grafo-layout-ajuda">
            <strong>{EXPLICACAO[layout].titulo}.</strong> {EXPLICACAO[layout].texto}
          </p>
        </div>

        {aoAmpliar && (
          <button type="button" className="grafo-ampliar" onClick={aoAmpliar}>
            <span aria-hidden="true">⛶</span> Abrir em tela cheia
          </button>
        )}

        {(fixado || isolado) && (
          <div className="grafo-foco">
            <p>
              <strong>{(isolado ?? fixado)!.nome}</strong>
              <span>
                {(isolado ?? fixado)!.partido}
                {vizinhos && ` · ${vizinhos.size - 1} ligações`}
              </span>
            </p>

            <div className="grafo-foco-acoes">
              {/* ⭐ É a diferença que o autor pediu: destacar mantém o contexto,
                  isolar remove tudo o que não é vizinho e libera o zoom. */}
              {!isolado ? (
                <button type="button" onClick={() => setIsolado(fixado)}>
                  Só as conexões dele
                </button>
              ) : (
                <button type="button" onClick={() => setIsolado(null)}>
                  Voltar ao grafo
                </button>
              )}

              {aoSelecionar && (
                <button type="button" onClick={() => aoSelecionar((isolado ?? fixado)!)}>
                  Abrir perfil
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFixado(null);
                  setIsolado(null);
                }}
              >
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grafo-controles">
        <div className="grafo-busca">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar deputado pelo nome"
            aria-label="Procurar deputado no grafo"
          />

          {achados.length > 0 && (
            <ul className="grafo-sugestoes">
              {achados.map((no) => (
                <li key={no.id}>
                  <button type="button" onClick={() => irPara(no)}>
                    <strong>{no.nome}</strong>
                    <span>
                      {no.partido}
                      {no.uf && ` · ${no.uf}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ⚠️ Só avisa quando houve busca de verdade: dizer "nada encontrado" com
              uma letra digitada é ruído, não informação. */}
          {busca.trim().length >= 2 && achados.length === 0 && (
            <p className="grafo-sem-achado">Nenhum deputado com esse nome.</p>
          )}
        </div>

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
          Rolar aproxima · arrastar o fundo move o mapa · arrastar um ponto reposiciona
          ele · clicar destaca e abre as ações · clicar duas vezes abre o perfil
        </p>
      </div>
    </div>
  );

  /**
   * Leva a câmera até o nó e o deixa destacado.
   *
   * ⚠️ Aproxima para 3× em vez de manter o zoom atual: encontrar alguém e continuar
   * vendo a mesma nuvem de 643 pontos não resolve nada — a busca precisa entregar a
   * pessoa, não a coordenada dela.
   */
  function irPara(no: NoDoGrafo) {
    const escala = Math.max(camera.escala, 3);
    const base = paraTela(no.eixoX!, no.eixoY!, tamanho, { escala, x: 0, y: 0 });

    setCamera({
      escala,
      x: tamanho.largura / 2 - base.x,
      y: tamanho.altura / 2 - base.y,
    });

    setFixado(no);
    setBusca('');
  }

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
// ⚠️ 14× era pouco: com 643 nós amontoados, é só a partir de ~25× que dá para separar
//    dois pontos vizinhos com o cursor.
const ESCALA_MAXIMA = 40;
const MAX_SUGESTOES = 6;

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
