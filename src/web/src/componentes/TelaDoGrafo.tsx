import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArestaDoGrafo, Grafo, NoDoGrafo } from '../api';
import {
  aproximar,
  comEscala,
  distanciaAoSegmento,
  enquadrar,
  paraMundo,
  paraTela,
  type Camera,
  type Tamanho,
} from './grafo/camera';
import { DENSIDADE, desenhar, raioNaTela, type Quadro } from './grafo/desenho';

export type PosicaoDoCidadao = {
  eixoX: number;
  eixoY: number;
  comunidade: number | null;
  vizinhosUsados: number;
  baseDeVotacoes: number;
};

/**
 * ⭐ PL43 — as duas maneiras de posicionar um parlamentar, lado a lado para comparar.
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
      'Cada ligação puxa dois parlamentares para perto; todos se repelem. Quem vota ' +
      'junto fica junto. O algoritmo nunca viu orientação de bancada, e ainda assim o ' +
      'eixo horizontal que ele produziu mede −0,89 contra o alinhamento com o Governo. ' +
      'A vertical não mede nada, e a forma redonda é escolha do algoritmo, não do dado.',
  },
  componentes: {
    rotulo: 'Componentes',
    titulo: 'Alinhamento com o Governo',
    texto:
      'O eixo horizontal é a direção em que os parlamentares mais se diferenciam, e ' +
      'ela tem nome: mede −0,87 contra o quanto cada um votou como a bancada do ' +
      'Governo orientou. De um lado quem seguiu quase sempre, do outro quem quase ' +
      'nunca seguiu. Atenção: isto é alinhamento com ESTE governo, não é esquerda e ' +
      'direita — e o centro não é moderação, porque quem faltou a muitas votações ' +
      'também cai ali.',
  },
};

type Alvo = { tipo: 'no'; no: NoDoGrafo } | { tipo: 'aresta'; aresta: ArestaDoGrafo };

/**
 * O grafo desenhado, navegável (RF-33).
 *
 * ## O plano é infinito
 *
 * Rolar aproxima e afastar não tem parede: a malha de pontos do fundo se move junto e
 * dá a referência. O que existe é um intervalo de escala — ver `camera.ts`.
 *
 * ## 🔴 Duas coisas que o desenho ⛔ não pode deixar de dizer
 *
 * A cor é COMUNIDADE, ⛔ nunca partido nem espectro (RNF-16). E o percentual de uma
 * ligação ⛔ nunca aparece sem a base: 82% sobre 24 votações e 82% sobre 540 não são a
 * mesma afirmação.
 */
export function TelaDoGrafo({
  grafo,
  cidadao,
  aoSelecionar,
  altura,
  preencher = false,
  aoAmpliar,
}: {
  grafo: Grafo;
  cidadao?: PosicaoDoCidadao | null;
  aoSelecionar?: (no: NoDoGrafo) => void;
  /** Fixa a altura; sem isto acompanha a largura. */
  altura?: number;
  /**
   * ⭐ Ocupa a altura do contêiner em vez de derivá-la da largura.
   *
   * É o modo da prancheta em tela cheia: lá quem manda na altura é a janela, e a
   * proporção 0,62 da largura deixaria uma faixa morta embaixo do desenho.
   */
  preencher?: boolean;
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
  const [comFotos, setComFotos] = useState(true);
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const [tamanho, setTamanho] = useState<Tamanho>({ largura: 800, altura: altura ?? 520 });

  const posicionados = useMemo(() => {
    // ⚠️ O nó carrega as duas posições; aqui uma delas é promovida a `eixoX`/`eixoY`
    //    para o resto do desenho não precisar saber qual layout está ativo.
    const comLayout = grafo.nos.map((n) =>
      layout === 'componentes' ? { ...n, eixoX: n.componente1, eixoY: n.componente2 } : n,
    );

    return comLayout
      .filter((n) => n.eixoX !== null && n.eixoY !== null)
      .map((n) => {
        const movido = movidos.get(n.id);
        return movido ? { ...n, eixoX: movido.x, eixoY: movido.y } : n;
      });
  }, [grafo.nos, movidos, layout]);

  const porId = useMemo(() => new Map(posicionados.map((n) => [n.id, n])), [posicionados]);

  const arestasDoLimiar = useMemo(
    () => grafo.arestas.filter((a) => a.peso >= limiar),
    [grafo.arestas, limiar],
  );

  const visiveis = useMemo(() => {
    if (!isolado) return arestasDoLimiar;

    return arestasDoLimiar.filter((a) => a.de === isolado.id || a.para === isolado.id);
  }, [arestasDoLimiar, isolado]);

  /** ⭐ O grau dita o tamanho do ponto: quem liga com muita gente aparece maior. */
  const graus = useMemo(() => {
    const contagem = new Map<number, number>();
    for (const a of visiveis) {
      contagem.set(a.de, (contagem.get(a.de) ?? 0) + 1);
      contagem.set(a.para, (contagem.get(a.para) ?? 0) + 1);
    }
    return contagem;
  }, [visiveis]);

  /**
   * ⭐ Vizinhança do nó em foco. É o gesto que torna o grafo legível: com 5 mil
   * arestas, olhar um parlamentar sem apagar o resto não informa nada.
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
    () =>
      isolado && vizinhos ? posicionados.filter((n) => vizinhos.has(n.id)) : posicionados,
    [isolado, vizinhos, posicionados],
  );

  // Repinte forçado quando uma foto termina de baixar — o dado não mudou, o pixel sim.
  const [revisao, setRevisao] = useState(0);
  const repintar = useCallback(() => setRevisao((n) => n + 1), []);

  useEffect(() => {
    const pai = canvasRef.current?.parentElement;
    if (!pai) return;

    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;

      // ⚠️ Piso de 240px também no modo preencher: numa janela muito baixa o contêiner
      //    chega a medir poucos pixels no primeiro quadro, e o canvas nasceria vazio.
      setTamanho({
        largura: width,
        altura: preencher
          ? Math.max(240, Math.round(height))
          : (altura ?? Math.max(420, Math.round(width * 0.62))),
      });
    });

    observador.observe(pai);
    return () => observador.disconnect();
  }, [altura, preencher]);

  const quadro = useMemo(
    () => ({
      nos: noDesenho,
      arestas: visiveis,
      porId,
      graus,
      arestaEmAlvo: alvo?.tipo === 'aresta' ? alvo.aresta : null,
      emFoco,
      vizinhos,
      cidadao,
      camera,
      comFotos,
      aoChegarFoto: repintar,
    }),
    [noDesenho, visiveis, porId, graus, alvo, emFoco, vizinhos, cidadao, camera, comFotos, repintar],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    desenhar(ctx, canvas, quadro);
  }, [quadro, tamanho, revisao]);

  // ⚠️ `passive: false` é obrigatório: sem isto o navegador ignora o
  //    `preventDefault` e a página inteira rola junto com o zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function aoRolar(evento: WheelEvent) {
      evento.preventDefault();

      const caixa = canvas!.getBoundingClientRect();
      setCamera((atual) =>
        aproximar(atual, evento.clientX - caixa.left, evento.clientY - caixa.top, evento.deltaY),
      );
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
          // ⭐ Converte o PONTO, não o deslocamento: o nó gruda no cursor em qualquer
          //    escala. Converter o delta por regra de três descolava no zoom alto.
          const destino = paraMundo(px, py, tamanho, camera);
          setMovidos((atual) => new Map(atual).set(no.id, destino));
          return;
        }

        setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
        return;
      }

      setAlvo(alvoSob(quadro, px, py, tamanho));
    },
    [quadro, tamanho, camera],
  );

  const enquadrarTudo = useCallback(() => {
    const pontos = noDesenho.map((n) => ({ x: n.eixoX!, y: n.eixoY! }));
    setCamera(enquadrar(pontos, tamanho));
  }, [noDesenho, tamanho]);

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

            // ⭐ Sobre um nó, arrasta o NÓ; no vazio, arrasta o plano.
            if (alvo?.tipo === 'no') arrastandoNo.current = alvo.no;
            arrastando.current = { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
          }}
          onMouseUp={soltar}
          onMouseLeave={() => {
            soltar();
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
          <button
            type="button"
            onClick={() => setCamera((c) => comEscala(c, c.escala * 1.6, tamanho.largura / 2, tamanho.altura / 2))}
            aria-label="Aproximar"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setCamera((c) => comEscala(c, c.escala / 1.6, tamanho.largura / 2, tamanho.altura / 2))}
            aria-label="Afastar"
          >
            −
          </button>
          <button type="button" onClick={enquadrarTudo} aria-label="Enquadrar tudo">
            ⤢
          </button>
          <button
            type="button"
            onClick={() => {
              setMovidos(new Map()); // ⚠️ devolve o desenho ao retrato do ETL
              setFixado(null);
              setIsolado(null);
              setCamera({ escala: 1, x: 0, y: 0 });
            }}
            aria-label="Desfazer tudo e voltar ao desenho original"
            title="Voltar ao desenho original do ETL"
          >
            ↺
          </button>
        </div>

        {/* ⭐ PL43: o seletor fica NA moldura, para comparar sem sair da tela. */}
        {aoAmpliar && (
          <button type="button" className="grafo-ampliar" onClick={aoAmpliar}>
            <span aria-hidden="true">⛶</span> Abrir em tela cheia
          </button>
        )}

        {/* ⭐ Busca e ajustes moram SOBRE o desenho, recolhidos.
            Ocupavam uma faixa fixa abaixo do canvas — e essa faixa custava altura de
            desenho em toda tela, para controles que se usam uma vez. */}
        <div className="grafo-ferramentas">
          <Busca
            valor={busca}
            aoDigitar={setBusca}
            achados={achados}
            aoEscolher={irPara}
          />

          <div className="grafo-ajustes">
            <button
              type="button"
              className={`grafo-ferramenta ${ajustesAbertos ? 'ativo' : ''}`}
              aria-expanded={ajustesAbertos}
              aria-label="Ajustes do desenho"
              title="Ajustes do desenho"
              onClick={() => setAjustesAbertos((aberto) => !aberto)}
            >
              <IconeEngrenagem />
            </button>

            {ajustesAbertos && (
              <div className="grafo-painel" role="group" aria-label="Ajustes do desenho">
                {/* ⭐ PL43: o seletor e a ressalva dele andam JUNTOS. 🔴 A do SVD não é
                    opcional — sem ela o leitor lê o centro como moderação, quando ali
                    também está quem faltou a muitas votações. */}
                <p className="grafo-painel-titulo">Como posicionar os pontos</p>

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

                <p className="grafo-painel-ajuda">
                  <strong>{EXPLICACAO[layout].titulo}.</strong> {EXPLICACAO[layout].texto}
                </p>

                <hr />

                <label className="grafo-painel-faixa">
                  <span>
                    Só ligações mais fortes
                    <output>
                      {visiveis.length} de {grafo.arestas.length}
                    </output>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={limiar}
                    onChange={(e) => setLimiar(Number(e.target.value))}
                  />
                </label>

                <label className="grafo-painel-chave">
                  <input
                    type="checkbox"
                    checked={comFotos}
                    onChange={(e) => setComFotos(e.target.checked)}
                  />
                  Rostos ao aproximar
                </label>

                <hr />

                <p className="grafo-painel-ajuda">
                  Rolar aproxima · arrastar o fundo move o plano · arrastar um ponto
                  reposiciona ele · clicar destaca · clicar duas vezes abre o perfil
                </p>
              </div>
            )}
          </div>
        </div>

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
              {/* ⭐ Destacar mantém o contexto; isolar remove tudo o que não é vizinho
                  e é o que faz o zoom valer a pena. */}
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
    </div>
  );

  function soltar() {
    arrastando.current = null;
    arrastandoNo.current = null;
  }

  /**
   * Leva a câmera até o nó e o deixa destacado.
   *
   * ⚠️ Aproxima para 6× em vez de manter o zoom atual: encontrar alguém e continuar
   * vendo a mesma nuvem de 643 pontos não resolve nada — a busca precisa entregar a
   * pessoa, não a coordenada dela. É também a escala em que o rosto aparece.
   */
  function irPara(no: NoDoGrafo) {
    const escala = Math.max(camera.escala, 6);
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

/**
 * A busca recolhida numa lupa.
 *
 * ⭐ Fechada, ocupa 2rem do canto do desenho; aberta, vira campo. Antes era um campo
 * sempre visível numa faixa abaixo do canvas — e essa faixa custava altura de figura em
 * toda tela, para um controle que se usa uma vez.
 */
function Busca({
  valor,
  aoDigitar,
  achados,
  aoEscolher,
}: {
  valor: string;
  aoDigitar: (texto: string) => void;
  achados: NoDoGrafo[];
  aoEscolher: (no: NoDoGrafo) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // ⚠️ O foco vai para o campo assim que ele existe. Sem isto, abrir a lupa exige um
  //    segundo clique — e a lupa deixa de parecer um atalho.
  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  if (!aberta) {
    return (
      <button
        type="button"
        className="grafo-ferramenta"
        aria-label="Procurar parlamentar no grafo"
        title="Procurar parlamentar"
        onClick={() => setAberta(true)}
      >
        <IconeLupa />
      </button>
    );
  }

  return (
    <div className="grafo-busca">
      <IconeLupa />
      <input
        ref={campo}
        type="search"
        value={valor}
        onChange={(e) => aoDigitar(e.target.value)}
        placeholder="Procurar pelo nome"
        aria-label="Procurar parlamentar no grafo"
        onKeyDown={(e) => {
          if (e.key === 'Escape') fechar();
          // ⭐ Enter leva ao primeiro resultado: com o campo aberto sobre o desenho,
          //    obrigar a mirar o item da lista com o mouse desfaz o ganho do atalho.
          if (e.key === 'Enter' && achados.length > 0) {
            aoEscolher(achados[0]);
            setAberta(false);
          }
        }}
      />

      <button type="button" className="grafo-busca-fechar" onClick={fechar} aria-label="Fechar busca">
        ✕
      </button>

      {achados.length > 0 && (
        <ul className="grafo-sugestoes">
          {achados.map((no) => (
            <li key={no.id}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(no);
                  setAberta(false);
                }}
              >
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

      {/* ⚠️ Só avisa quando houve busca de verdade: dizer "nada encontrado" com uma
          letra digitada é ruído, não informação. */}
      {valor.trim().length >= 2 && achados.length === 0 && (
        <p className="grafo-sem-achado">Nenhum parlamentar com esse nome.</p>
      )}
    </div>
  );

  function fechar() {
    aoDigitar('');
    setAberta(false);
  }
}

// ⚠️ Desenhados à mão em vez de emoji: 🔍 e ⚙️ mudam de forma e de cor conforme o
//    sistema, e num canto de 2rem sobre o desenho isso vira ruído.
function IconeLupa() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.8 12.8 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconeEngrenagem() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 1.6v2.2M10 16.2v2.2M18.4 10h-2.2M3.8 10H1.6M15.9 4.1l-1.6 1.6M5.7 14.3l-1.6 1.6M15.9 15.9l-1.6-1.6M5.7 5.7 4.1 4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
    ancora.x > tamanho.largura - 220
      ? { right: tamanho.largura - ancora.x + 16, top: ancora.y - 12 }
      : { left: ancora.x + 16, top: ancora.y - 12 };

  if (alvo.tipo === 'aresta') {
    const a = porId.get(alvo.aresta.de);
    const b = porId.get(alvo.aresta.para);

    return (
      <div className="grafo-dica" style={estilo}>
        <strong>{a?.nome}</strong>
        <strong>{b?.nome}</strong>

        {/* 🔴 O percentual ⛔ nunca vem sem a base. "Peso" é jargão nosso; na tela,
            o que o número significa. */}
        <span className="grafo-dica-meta">
          votaram igual em {Math.round(alvo.aresta.peso * 100)}% das{' '}
          {alvo.aresta.votacoesComuns} votações em que os dois se posicionaram
        </span>

        {/* ⚠️ A segunda métrica fica em segundo plano: ela existe para a comparação
            da RF-18, e não é o número que a tela pede para o leitor usar. */}
        {alvo.aresta.cosseno !== null && (
          <span className="grafo-dica-secundaria">
            cosseno {alvo.aresta.cosseno.toFixed(2)}
          </span>
        )}
      </div>
    );
  }

  const no = alvo.no;

  return (
    <div className="grafo-dica" style={estilo}>
      {no.urlFoto && <img src={no.urlFoto} alt="" className="grafo-dica-foto" loading="lazy" />}
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

const MAX_SUGESTOES = 6;

/** ⚠️ Nó vence aresta: o alvo pequeno tem de ser o mais fácil de acertar. */
function alvoSob(
  quadro: Quadro,
  x: number,
  y: number,
  t: Tamanho,
): Alvo | null {
  let achado: NoDoGrafo | null = null;
  let menor = Infinity;

  for (const no of quadro.nos) {
    const p = paraTela(no.eixoX!, no.eixoY!, t, quadro.camera);

    // ⭐ A área de acerto acompanha o raio desenhado: com foto o nó fica grande, e o
    //    alvo de 12px do desenho antigo cairia no meio do rosto.
    const alcance = Math.max(12, raioNaTela(no, quadro) + 4);
    const distancia2 = (p.x - x) ** 2 + (p.y - y) ** 2;

    if (distancia2 < alcance * alcance && distancia2 < menor) {
      menor = distancia2;
      achado = no;
    }
  }

  if (achado) return { tipo: 'no', no: achado };

  // ⚠️ Só procura aresta perto do cursor; varrer 5 mil segmentos por movimento do
  //    mouse derrubaria o quadro.
  let arestaAchada: ArestaDoGrafo | null = null;
  let menorDistancia = 5;

  for (const aresta of quadro.arestas) {
    const a = quadro.porId.get(aresta.de);
    const b = quadro.porId.get(aresta.para);
    if (!a || !b) continue;

    const distancia = distanciaAoSegmento(
      x, y,
      paraTela(a.eixoX!, a.eixoY!, t, quadro.camera),
      paraTela(b.eixoX!, b.eixoY!, t, quadro.camera),
    );

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      arestaAchada = aresta;
    }
  }

  return arestaAchada ? { tipo: 'aresta', aresta: arestaAchada } : null;
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
