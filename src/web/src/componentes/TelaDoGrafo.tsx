import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nomeDePessoa } from '../formato';
import type { KeyboardEvent } from 'react';
import type { ArestaDoGrafo, Grafo, NoDoGrafo } from '../api';
import { ListaDoGrafoComponent } from './ListaDoGrafo';
import {
  aproximar,
  comEscala,
  distanciaAoSegmento,
  enquadrar,
  enquadrarMiolo,
  paraMundo,
  pinca,
  paraTela,
  type Camera,
  type Tamanho,
} from './grafo/camera';
import { densidade, desenhar, raioNaTela, type Quadro } from './grafo/desenho';
import { rotulosDoEixo } from './grafo/legenda';
import { aoMudarTema } from '../tema';
import { SUGESTOES_DA_BUSCA_NO_GRAFO } from '../constantes';
import { TEXTOS_DO_GRAFO as T } from '../textos/grafo';

export type PosicaoDoCidadao = {
  eixoX: number;
  eixoY: number;
  comunidade: number | null;
  vizinhosUsados: number;
  baseDeVotacoes: number;
};

/**
 * DECISÃO: Pendência 43 — as duas maneiras de posicionar um parlamentar, lado a lado para comparar.
 *
 * `molas` desenha bem e não interpreta nada. `componentes` (SVD) tem eixo com
 * significado, mas convida o leitor a ler espectro político.
 */
/**
 * ATENÇÃO: `componentes` (SVD) saiu da TELA e não do dado — Pendência 43 resolvida em 2026-08-28.
 *
 * Ele mostrava a MESMA divisão que `alinhamento`: o eixo dele correlaciona −0,87 com o
 * governismo. A diferença é que ali a posição saía de um algoritmo e exigia um parágrafo
 * para explicar o que `alinhamento` diz sozinho — e o segundo eixo, com 9,6% da
 * variância, não tem leitura em português.
 *
 * DECISÃO: `componente1` e `componente2` continuam calculados e gravados: são resultado do
 * método e sustentam o achado #26.
 */
export type Layout = 'molas' | 'alinhamento';

/**
 * ATENÇÃO: A explicação de cada layout vive JUNTO do seletor, não num rodapé.
 *
 * RISCO: A do SVD precisa dizer o que o centro NÃO é. Medido na legislatura 57: os 80 nós
 * mais centrais têm mediana de 472 votações; os 80 mais extremos, 925 (r = 0,566). Quem
 * faltou é empurrado para o meio, e sem esse aviso o leitor conclui que ali estão os
 * moderados.
 *
 * DECISÃO: O único layout em que o eixo NÃO é arbitrário.
 *
 * Nos outros dois a posição sai de um algoritmo e o significado é descoberto depois,
 * por correlação — e o sinal pode espelhar numa reexecução. Aqui a coordenada É a
 * medida: `x` vem direto do governismo, e quem manda no sentido somos nós.
 */
const EXPLICACAO: Record<Layout, { rotulo: string; titulo: string; texto: string }> = T.layouts;

type Alvo = { tipo: 'no'; no: NoDoGrafo } | { tipo: 'aresta'; aresta: ArestaDoGrafo };

/**
 * O grafo desenhado, navegável (RF-33).
 *
 * ## O plano é infinito
 *
 * Rolar aproxima e afastar não tem parede: a malha de pontos do fundo se move junto e
 * dá a referência. O que existe é um intervalo de escala — ver `camera.ts`.
 *
 * ## RISCO: Duas coisas que o desenho não pode deixar de dizer
 *
 * A cor é COMUNIDADE, nunca partido nem espectro (RNF-16). E o percentual de uma
 * ligação nunca aparece sem a base: 82% sobre 24 votações e 82% sobre 540 não são a
 * mesma afirmação.
 *
 * Os ponteiros na tela, por id — mouse, caneta ou dedo.
 *
 * ATENÇÃO: O grafo tratava só mouse: no celular, arrastar e pinçar não faziam nada, e tocar num
 * ponto não o selecionava, porque a seleção dependia de passar o mouse por cima.
 *
 * ATENÇÃO: Deslocamentos manuais de nó, em coordenada do LAYOUT.
 *
 * Não voltam para o banco, de propósito: `nos_metrica` é retrato reproduzível da
 * execução do ETL, e deixar o usuário reescrever isso destruiria a garantia de que a
 * banca reproduz a mesma figura. Arrastar é para enxergar, não para corrigir.
 *
 * DECISÃO: Isolado não é o mesmo que fixado.
 *
 * Fixado apaga o resto mas o mantém no desenho — dá contexto. Isolado REMOVE tudo o
 * que não é vizinho, e aí o zoom passa a valer a pena: 30 pontos em vez de 643.
 *
 * Não "Alinhamento" não aparece no Senado. Lá não existe orientação de bancada
 * publicada, e um layout cujo eixo é o governismo não teria coordenada nenhuma.
 *
 * Sem governismo (Senado), sobra o layout de molas — e ali o eixo não tem nome.
 *
 * ATENÇÃO: O nó carrega as duas posições; aqui uma delas é promovida a `eixoX`/`eixoY`
 * para o resto do desenho não precisar saber qual layout está ativo.
 *
 * DECISÃO: `governismo` vive em [0, 1] e o plano em [-1, 1]. A vertical continua vindo
 * do layout de molas: ela não mede nada em nenhum dos dois, e reaproveitá-la
 * mantém os agrupamentos visualmente coerentes enquanto o eixo x muda.
 *
 * DECISÃO: O grau dita o tamanho do ponto: quem liga com muita gente aparece maior.
 *
 * DECISÃO: Vizinhança do nó em foco. É o gesto que torna o grafo legível: com 5 mil
 * arestas, olhar um parlamentar sem apagar o resto não informa nada.
 *
 * DECISÃO: Achar alguém sem caçar ponto por ponto. Com 643 nós, encontrar o Arthur Lira
 * passando o mouse é inviável — e era o gesto que o desenho obrigava.
 *
 * Repinte forçado quando uma foto termina de baixar — o dado não mudou, o pixel sim.
 *
 * DECISÃO: Um redesenho por quadro, por mais fotos que cheguem nele. Eram um por foto: com o
 * zoom, dezenas chegavam em sequência e cada uma redesenhava 5 mil ligações.
 *
 * O aviso "Ctrl + roda", que aparece quando a roda passa por um grafo embutido.
 *
 * ATENÇÃO: Piso de 240px também no modo preencher: numa janela muito baixa o contêiner
 * chega a medir poucos pixels no primeiro quadro, e o canvas nasceria vazio.
 *
 * DECISÃO: Os rótulos do eixo saem do DADO. O sinal do eixo é arbitrário, e escrever
 * "esquerda = governo" faria a figura mentir sobre si mesma no dia em que uma
 * reexecução a espelhasse.
 *
 * Não Nulo no Senado: sem orientação de bancada, o eixo não tem nome — e desenhar a
 * linha com rótulo inventado seria pior que não desenhar.
 *
 * O canvas não tem seletor de CSS: sem isto, trocar o tema deixava o grafo com as cores
 * do tema anterior até o próximo movimento.
 *
 * ATENÇÃO: `passive: false` é obrigatório: sem isto o navegador ignora o
 * `preventDefault` e a página inteira rola junto com o zoom.
 *
 * DECISÃO: Embutido e sem Ctrl: a roda é da página. Não preventDefault — ela rola.
 *
 * DECISÃO: Converte o PONTO, não o deslocamento: o nó gruda no cursor em qualquer
 * escala. Converter o delta por regra de três descolava no zoom alto.
 *
 * O quadro da abertura: o miolo da nuvem, sem os isolados das bordas.
 *
 * Abre enquadrado no miolo, e volta a ele quando o grafo, o layout ou o tamanho mudam.
 *
 * ATENÇÃO: Só enquanto a pessoa não mexeu na câmera: depois de um zoom ou de arrastar o
 * desenho, redimensionar a janela não desfaz o que ela fez.
 *
 * ATENÇÃO: A função passada a `setCamera` precisa ser PURA: o StrictMode a chama duas
 * vezes. Atualizar o ref dentro dela fazia a segunda chamada achar que a pessoa
 * tinha mexido, e a câmera ficava presa no tamanho inicial de 800 × 520.
 *
 * Teclado no desenho: setas movem, mais e menos aproximam, zero enquadra.
 *
 * ATENÇÃO: Isto NÃO torna o grafo acessível por si só — mover a câmera com o teclado não * não diz a quem usa leitor de tela quem está perto de quem. Quem faz esse trabalho é
 * `ListaDoGrafo`. Aqui o objetivo é outro e mais modesto: quem não usa mouse
 * conseguir operar os mesmos controles que o mouse tem.
 *
 * Não Só intercepta as teclas que usa. Tab, Shift+Tab e Escape seguem para o navegador
 * — prender o foco dentro de um canvas seria pior do que não tê-lo.
 *
 * ATENÇÃO: Só depois de saber que a tecla É nossa: prevenir antes tiraria a rolagem da
 * página de quem só passou o foco pelo grafo.
 *
 * O gesto no desenho é do grafo: sem isto o navegador rolaria e aproximaria
 * a página inteira junto com a pinça. DECISÃO: Embutido, o arrasto vertical é da
 * página — senão o dedo que rola o início ficava preso no desenho.
 *
 * DECISÃO: Focável pelo teclado: sem isto o desenho inteiro fica fora da ordem de
 * tabulação, e quem não usa mouse não consegue nem aproximar.
 *
 * DECISÃO: Os controles moram sobre o desenho, junto do que eles controlam.
 *
 * `setMovidos(new Map());`: ATENÇÃO: devolve o desenho ao retrato do ETL
 *
 * DECISÃO: Pendência 43: o seletor fica NA moldura, para comparar sem sair da tela.
 *
 * DECISÃO: Busca e ajustes moram SOBRE o desenho, recolhidos.
 * Ocupavam uma faixa fixa abaixo do canvas — e essa faixa custava altura de
 * desenho em toda tela, para controles que se usam uma vez.
 *
 * DECISÃO: Pendência 43: o seletor e a ressalva dele andam JUNTOS. RISCO: A do SVD não é
 * opcional — sem ela o leitor lê o centro como moderação, quando ali
 * também está quem faltou a muitas votações.
 *
 * ATENÇÃO: Com uma opção só (Senado), o seletor vira um botão que não
 * escolhe nada. A explicação abaixo fica, porque ela é que importa.
 *
 * ATENÇÃO: Começa desligado: a maior parte de quem abre o desenho quer ver a
 * forma, e o eixo rotulado é a leitura seguinte. Ligado por padrão, ele
 * disputaria atenção com a própria figura.
 *
 * DECISÃO: Destacar mantém o contexto; isolar remove tudo o que não é vizinho
 * e é o que faz o zoom valer a pena.
 *
 * RISCO: A alternativa em texto. Não é "acessibilidade adicionada por cima": é o
 * único caminho para a informação do desenho quem usa leitor de tela tem.
 *
 * Um ponteiro desce: com um, arrasta o ponto sob ele ou o plano; com dois, começa a pinça.
 *
 * DECISÃO: No toque não há "passar por cima", então o alvo é calculado aqui, no toque: é o que
 * faz tocar num ponto selecioná-lo.
 *
 * Sobre um nó, arrasta o NÓ; no vazio, arrasta o plano.
 *
 * Um ponteiro sobe: o que resta continua o arrasto de onde está, sem saltar.
 *
 * Leva a câmera até o nó e o deixa destacado.
 *
 * ATENÇÃO: Aproxima para 6× em vez de manter o zoom atual: encontrar alguém e continuar
 * vendo a mesma nuvem de 643 pontos não resolve nada — a busca precisa entregar a
 * pessoa, não a coordenada dela. É também a escala em que o rosto aparece.
 */
export function TelaDoGrafoComponent({
  grafo,
  cidadao,
  aoSelecionar,
  altura,
  preencher = false,
  aoAmpliar,
  embutido = false,
  destaque,
}: {
  grafo: Grafo;
  cidadao?: PosicaoDoCidadao | null;
  aoSelecionar?: (no: NoDoGrafo) => void;
  /** Fixa a altura; sem isto acompanha a largura. */
  altura?: number;
  /**
   * DECISÃO: Ocupa a altura do contêiner em vez de derivá-la da largura.
   *
   * É o modo da prancheta em tela cheia: lá quem manda na altura é a janela, e a
   * proporção 0,62 da largura deixaria uma faixa morta embaixo do desenho.
   */
  preencher?: boolean;
  /** ATENÇÃO: Quando presente, vira um botão NA MOLDURA do grafo — não um link solto na
   *  página, que se perde entre os textos abaixo do desenho. */
  aoAmpliar?: () => void;
  /**
   * DECISÃO: Dentro de uma página que rola — o início, o resultado. Ali a roda do mouse rola a
   * PÁGINA, e só aproxima com Ctrl (⌘ no Mac), como num mapa embutido.
   *
   * MEDIDO: Sem isto (2026-10-02): quem rolava o início com o mouse sobre o grafo dava zoom sem
   * querer, ficava preso no desenho e disparava o download das fotos de cada ponto que
   * crescia — na 55ª, 56 fotos e 40 redesenhos em 3 segundos, e a aba travou duas vezes.
   */
  embutido?: boolean;
  /** U18: destaca um partido ou um estado sem esconder os outros. A cor continua a da comunidade. */
  destaque?: { partido?: string; uf?: string };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrastando = useRef<{ x: number; y: number } | null>(null);
  const arrastandoNo = useRef<NoDoGrafo | null>(null);

  const ponteiros = useRef(new Map<number, { x: number; y: number }>());

  const [movidos, setMovidos] = useState<Map<number, { x: number; y: number }>>(new Map());

  const [camera, setCamera] = useState<Camera>({ escala: 1, x: 0, y: 0 });
  const cameraAutomatica = useRef<Camera | null>(null);
  const [limiar, setLimiar] = useState(() => limiarInicial(grafo.arestas));
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [fixado, setFixado] = useState<NoDoGrafo | null>(null);

  const [isolado, setIsolado] = useState<NoDoGrafo | null>(null);
  const [busca, setBusca] = useState('');
  const [layout, setLayout] = useState<Layout>('molas');
  const [comFotos, setComFotos] = useState(true);
  const [comEixos, setComEixos] = useState(false);
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const [tamanho, setTamanho] = useState<Tamanho>({ largura: 800, altura: altura ?? 520 });

  const layoutsDisponiveis = useMemo<Layout[]>(() => {
    const temAlinhamento = grafo.nos.some((n) => n.governismo !== null);

    return temAlinhamento ? ['molas', 'alinhamento'] : ['molas'];
  }, [grafo.nos]);

  const posicionados = useMemo(() => {
    const comLayout = grafo.nos.map((n) => {
      if (layout === 'alinhamento')
        return {
          ...n,
          eixoX: n.governismo === null ? null : n.governismo * 2 - 1,
          eixoY: n.eixoY,
        };

      return n;
    });

    return comLayout
      .filter((n) => n.eixoX !== null && n.eixoY !== null)
      .map((n) => {
        const movido = movidos.get(n.idPessoa);
        return movido ? { ...n, eixoX: movido.x, eixoY: movido.y } : n;
      });
  }, [grafo.nos, movidos, layout]);

  const porId = useMemo(() => new Map(posicionados.map((n) => [n.idPessoa, n])), [posicionados]);

  useEffect(() => setLimiar(limiarInicial(grafo.arestas)), [grafo.arestas]);

  const arestasDoLimiar = useMemo(
    () => grafo.arestas.filter((a) => a.peso >= limiar),
    [grafo.arestas, limiar],
  );

  const emFoco = isolado ?? fixado ?? (alvo?.tipo === 'no' ? alvo.no : null);

  const visiveis = useMemo(() => {
    if (!emFoco) return arestasDoLimiar;
    const doFoco = grafo.arestas.filter((a) => a.idPessoaDe === emFoco.idPessoa || a.idPessoaPara === emFoco.idPessoa);
    if (isolado) return doFoco;
    return [...new Set([...arestasDoLimiar, ...doFoco])];
  }, [arestasDoLimiar, grafo.arestas, emFoco, isolado]);

  const graus = useMemo(() => {
    const contagem = new Map<number, number>();
    for (const a of grafo.arestas) {
      contagem.set(a.idPessoaDe, (contagem.get(a.idPessoaDe) ?? 0) + 1);
      contagem.set(a.idPessoaPara, (contagem.get(a.idPessoaPara) ?? 0) + 1);
    }
    return contagem;
  }, [grafo.arestas]);

  const vizinhos = useMemo(() => {
    if (!emFoco) return null;

    const conjunto = new Set<number>([emFoco.idPessoa]);
    for (const a of visiveis) {
      if (a.idPessoaDe === emFoco.idPessoa) conjunto.add(a.idPessoaPara);
      else if (a.idPessoaPara === emFoco.idPessoa) conjunto.add(a.idPessoaDe);
    }

    return conjunto;
  }, [emFoco, visiveis]);

  const achados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 2) return [];

    return posicionados
      .filter((n) => n.nome.toLowerCase().includes(termo))
      .slice(0, SUGESTOES_DA_BUSCA_NO_GRAFO);
  }, [busca, posicionados]);

  const noDesenho = useMemo(
    () =>
      isolado && vizinhos ? posicionados.filter((n) => vizinhos.has(n.idPessoa)) : posicionados,
    [isolado, vizinhos, posicionados],
  );

  const [revisao, setRevisao] = useState(0);
  const repinturaPedida = useRef<number | null>(null);
  const repintar = useCallback(() => {
    if (repinturaPedida.current !== null) return;
    repinturaPedida.current = requestAnimationFrame(() => {
      repinturaPedida.current = null;
      setRevisao((n) => n + 1);
    });
  }, []);
  useEffect(
    () => () => {
      if (repinturaPedida.current !== null) cancelAnimationFrame(repinturaPedida.current);
    },
    [],
  );

  const [avisoDaRoda, setAvisoDaRoda] = useState(false);

  useEffect(() => {
    const pai = canvasRef.current?.parentElement;
    if (!pai) return;

    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;

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

  const eixos = useMemo(
    () => (comEixos ? rotulosDoEixo(posicionados, layout) : null),
    [comEixos, posicionados, layout],
  );

  const realcados = useMemo(() => {
    if (!destaque?.partido && !destaque?.uf) return null;
    return new Set(
      grafo.nos
        .filter((n) => (!destaque.partido || n.partido === destaque.partido) && (!destaque.uf || n.uf === destaque.uf))
        .map((n) => n.idPessoa),
    );
  }, [grafo.nos, destaque?.partido, destaque?.uf]);

  const quadro = useMemo(
    () => ({
      nos: noDesenho,
      arestas: visiveis,
      porId,
      graus,
      arestaEmAlvo: alvo?.tipo === 'aresta' ? alvo.aresta : null,
      emFoco,
      vizinhos,
      realcados,
      cidadao,
      camera,
      comFotos,
      eixos,
      aoChegarFoto: repintar,
      ligacoesAVista: ligacoesAVista(camera, cameraAutomatica.current),
    }),
    [noDesenho, visiveis, porId, graus, alvo, emFoco, vizinhos, realcados, cidadao, camera,
     comFotos, eixos, repintar],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    desenhar(ctx, canvas, quadro);
  }, [quadro, tamanho, revisao]);

  useEffect(() => aoMudarTema(repintar), [repintar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let apagarAviso: ReturnType<typeof setTimeout> | undefined;

    function aoRolar(evento: WheelEvent) {
      if (embutido && !evento.ctrlKey && !evento.metaKey) {
        setAvisoDaRoda(true);
        clearTimeout(apagarAviso);
        apagarAviso = setTimeout(() => setAvisoDaRoda(false), 1500);
        return;
      }

      evento.preventDefault();

      const caixa = canvas!.getBoundingClientRect();
      setCamera((atual) =>
        aproximar(atual, evento.clientX - caixa.left, evento.clientY - caixa.top, evento.deltaY),
      );
    }

    canvas.addEventListener('wheel', aoRolar, { passive: false });
    return () => {
      clearTimeout(apagarAviso);
      canvas.removeEventListener('wheel', aoRolar);
    };
  }, [embutido]);

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
          const destino = paraMundo(px, py, tamanho, camera);
          setMovidos((atual) => new Map(atual).set(no.idPessoa, destino));
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

  const ligados = useMemo(() => new Set(grafo.arestas.flatMap((a) => [a.idPessoaDe, a.idPessoaPara])), [grafo.arestas]);
  const vistaInicial = useCallback(() => {
    const comLigacao = posicionados.filter((n) => ligados.has(n.idPessoa));
    const base = comLigacao.length >= 2 ? comLigacao : posicionados;
    return enquadrarMiolo(base.map((n) => ({ x: n.eixoX!, y: n.eixoY! })), tamanho);
  }, [posicionados, ligados, tamanho]);

  useEffect(() => {
    const nova = vistaInicial();
    const anterior = cameraAutomatica.current;
    cameraAutomatica.current = nova;

    setCamera((atual) => {
      const intocada =
        anterior === null
        || (atual.escala === anterior.escala && atual.x === anterior.x && atual.y === anterior.y)
        || (atual.escala === 1 && atual.x === 0 && atual.y === 0);
      return intocada ? nova : atual;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só grafo, layout e tamanho; arrastar um nó não reenquadra
  }, [grafo, layout, tamanho]);

  const aoTeclar = useCallback(
    (evento: KeyboardEvent<HTMLCanvasElement>) => {
      const PASSO = evento.shiftKey ? 120 : 40;
      const centro = { x: tamanho.largura / 2, y: tamanho.altura / 2 };

      const acoes: Record<string, () => void> = {
        ArrowLeft: () => setCamera((c) => ({ ...c, x: c.x + PASSO })),
        ArrowRight: () => setCamera((c) => ({ ...c, x: c.x - PASSO })),
        ArrowUp: () => setCamera((c) => ({ ...c, y: c.y + PASSO })),
        ArrowDown: () => setCamera((c) => ({ ...c, y: c.y - PASSO })),
        '+': () => setCamera((c) => comEscala(c, c.escala * 1.6, centro.x, centro.y)),
        '=': () => setCamera((c) => comEscala(c, c.escala * 1.6, centro.x, centro.y)),
        '-': () => setCamera((c) => comEscala(c, c.escala / 1.6, centro.x, centro.y)),
        '0': enquadrarTudo,
        Home: enquadrarTudo,
      };

      const acao = acoes[evento.key];
      if (!acao) return;

      evento.preventDefault();
      acao();
    },
    [tamanho, enquadrarTudo],
  );

  return (
    <div className="grafo">
      <div className="grafo-tela" data-tour="grafo-desenho">
        {!quadro.ligacoesAVista && !emFoco && grafo.arestas.length > 0 && (
          <p className="grafo-dica-ligacoes">{T.tela.dicaDasLigacoes}</p>
        )}
        {avisoDaRoda && (
          <p className="grafo-aviso-roda" role="status">
            {T.tela.avisoDaRoda}
          </p>
        )}
        <canvas
          ref={canvasRef}
          width={tamanho.largura * densidade()}
          height={tamanho.altura * densidade()}
          style={{
            width: '100%',
            height: tamanho.altura,
            cursor: arrastando.current ? 'grabbing' : alvo ? 'pointer' : 'grab',
            touchAction: embutido ? 'pan-y' : 'none',
          }}
          onPointerMove={aoMoverPonteiro}
          onPointerDown={aoApertar}
          onPointerUp={aoLevantar}
          onPointerCancel={aoLevantar}
          onPointerLeave={(e) => {
            if (e.pointerType !== 'mouse') return;
            soltar();
            setAlvo(null);
          }}
          onClick={aoClicar}
          onDoubleClick={() => aoSelecionar && emFoco && aoSelecionar(emFoco)}
          onKeyDown={aoTeclar}
          tabIndex={0}
          role="img"
          aria-label={T.tela.rotulo(noDesenho.length, grafo.arestas.length, visiveis.length)}
        />

        {alvo && <DicaComponent alvo={alvo} porId={porId} tamanho={tamanho} camera={camera} />}

        <div className="grafo-zoom" data-tour="grafo-zoom">
          <button
            type="button"
            onClick={() => setCamera((c) => comEscala(c, c.escala * 1.6, tamanho.largura / 2, tamanho.altura / 2))}
            aria-label={T.tela.aproximar}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setCamera((c) => comEscala(c, c.escala / 1.6, tamanho.largura / 2, tamanho.altura / 2))}
            aria-label={T.tela.afastar}
          >
            −
          </button>
          <button type="button" onClick={enquadrarTudo} aria-label={T.tela.enquadrar}>
            ⤢
          </button>
          <button
            type="button"
            onClick={() => {
              setMovidos(new Map());
              setFixado(null);
              setIsolado(null);
              setCamera(vistaInicial());
            }}
            aria-label={T.tela.desfazer}
            title={T.tela.desfazerTitulo}
          >
            ↺
          </button>
        </div>

        {aoAmpliar && (
          <button type="button" className="grafo-ampliar" onClick={aoAmpliar}>
            <span aria-hidden="true">⛶</span>
            {T.tela.telaCheia}
          </button>
        )}

        <div className="grafo-ferramentas">
          <BuscaComponent
            valor={busca}
            aoDigitar={setBusca}
            achados={achados}
            aoEscolher={irPara}
          />

          <div className="grafo-ajustes" data-tour="grafo-ajustes">
            <button
              type="button"
              className={`grafo-ferramenta ${ajustesAbertos ? 'ativo' : ''}`}
              aria-expanded={ajustesAbertos}
              aria-label={T.tela.ajustes}
              title={T.tela.ajustes}
              onClick={() => setAjustesAbertos((aberto) => !aberto)}
            >
              <IconeEngrenagemComponent />
            </button>

            {ajustesAbertos && (
              <div className="grafo-painel" role="group" aria-label={T.tela.ajustes}>
                {layoutsDisponiveis.length > 1 && (
                  <p className="grafo-painel-titulo">{T.tela.comoPosicionar}</p>
                )}

                {layoutsDisponiveis.length > 1 && (
                <div className="grafo-layout-botoes" role="group" aria-label={T.tela.comoPosicionar}>
                  {layoutsDisponiveis.map((opcao) => (
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
                )}

                <p className="grafo-painel-ajuda">
                  {T.tela.explicacaoDoLayout(EXPLICACAO[layout].titulo, EXPLICACAO[layout].texto)}
                </p>

                <hr />

                <label className="grafo-painel-faixa">
                  <span>
                    {T.tela.soAsFortes}
                    <output>{T.tela.deTotal(visiveis.length, grafo.arestas.length)}</output>
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
                  {T.tela.rostos}
                </label>

                <label className="grafo-painel-chave">
                  <input
                    type="checkbox"
                    checked={comEixos}
                    onChange={(e) => setComEixos(e.target.checked)}
                  />
                  {T.tela.eixos}
                </label>

                {comEixos && !eixos && (
                  <p className="grafo-painel-ajuda">{T.tela.semEixo}</p>
                )}

                <hr />

                <p className="grafo-painel-ajuda">{T.tela.comoUsar}</p>
              </div>
            )}
          </div>
        </div>

        {(fixado || isolado) && (
          <div className="grafo-foco">
            <p>
              <strong>{nomeDePessoa((isolado ?? fixado)!.nome)}</strong>
              <span>
                {(isolado ?? fixado)!.partido}
                {vizinhos && T.tela.ligacoes(vizinhos.size - 1)}
              </span>
            </p>

            <div className="grafo-foco-acoes">
              {!isolado ? (
                <button type="button" onClick={() => setIsolado(fixado)}>
                  {T.tela.soAsConexoes}
                </button>
              ) : (
                <button type="button" onClick={() => setIsolado(null)}>
                  {T.tela.voltar}
                </button>
              )}

              {aoSelecionar && (
                <button type="button" onClick={() => aoSelecionar((isolado ?? fixado)!)}>
                  {T.tela.abrirPerfil}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFixado(null);
                  setIsolado(null);
                }}
              >
                {T.tela.limpar}
              </button>
            </div>
          </div>
        )}
      </div>

      <ListaDoGrafoComponent nos={noDesenho} arestas={isolado ? visiveis : grafo.arestas} aoSelecionar={irPara} />
    </div>
  );

  function soltar() {
    arrastando.current = null;
    arrastandoNo.current = null;
  }

  function posicaoNoDesenho(e: React.PointerEvent<HTMLCanvasElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
  }

  function aoApertar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const ponto = posicaoNoDesenho(e);
    ponteiros.current.set(e.pointerId, ponto);

    const sob = e.pointerType === 'mouse' ? alvo : alvoSob(quadro, ponto.x, ponto.y, tamanho);
    if (e.pointerType !== 'mouse') setAlvo(sob);

    if (ponteiros.current.size === 1) {
      arrastandoNo.current = sob?.tipo === 'no' ? sob.no : null;
      arrastando.current = ponto;
    } else {
      soltar();
    }
  }

  function aoMoverPonteiro(e: React.PointerEvent<HTMLCanvasElement>) {
    const anterior = ponteiros.current.get(e.pointerId);

    if (anterior && ponteiros.current.size >= 2) {
      const [a, b] = [...ponteiros.current.entries()];
      const depois = posicaoNoDesenho(e);
      const antes: [{ x: number; y: number }, { x: number; y: number }] = [a[1], b[1]];
      ponteiros.current.set(e.pointerId, depois);
      const agora = [...ponteiros.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      setCamera((c) => pinca(c, antes, agora));
      return;
    }

    if (anterior) ponteiros.current.set(e.pointerId, posicaoNoDesenho(e));
    aoMover(e);
  }

  function aoLevantar(e: React.PointerEvent<HTMLCanvasElement>) {
    ponteiros.current.delete(e.pointerId);

    const [restante] = [...ponteiros.current.values()];
    if (restante) {
      arrastandoNo.current = null;
      arrastando.current = restante;
    } else {
      soltar();
    }
  }

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

    setFixado((atual) => (atual?.idPessoa === alvo.no.idPessoa ? null : alvo.no));
  }
}

/**
 * A busca recolhida numa lupa.
 *
 * DECISÃO: Fechada, ocupa 2rem do canto do desenho; aberta, vira campo. Antes era um campo
 * sempre visível numa faixa abaixo do canvas — e essa faixa custava altura de figura em
 * toda tela, para um controle que se usa uma vez.
 *
 * ATENÇÃO: O foco vai para o campo assim que ele existe. Sem isto, abrir a lupa exige um
 * segundo clique — e a lupa deixa de parecer um atalho.
 *
 * DECISÃO: Enter leva ao primeiro resultado: com o campo aberto sobre o desenho,
 * obrigar a mirar o item da lista com o mouse desfaz o ganho do atalho.
 *
 * ATENÇÃO: Só avisa quando houve busca de verdade: dizer "nada encontrado" com uma
 * letra digitada é ruído, não informação.
 */
function BuscaComponent({
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

  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  if (!aberta) {
    return (
      <button
        type="button"
        className="grafo-ferramenta"
        data-tour="grafo-busca"
        aria-label={T.busca.rotulo}
        title={T.busca.titulo}
        onClick={() => setAberta(true)}
      >
        <IconeLupaComponent />
      </button>
    );
  }

  return (
    <div className="grafo-busca" data-tour="grafo-busca">
      <IconeLupaComponent />
      <input
        ref={campo}
        type="search"
        value={valor}
        onChange={(e) => aoDigitar(e.target.value)}
        placeholder={T.busca.placeholder}
        aria-label={T.busca.rotulo}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fechar();
          if (e.key === 'Enter' && achados.length > 0) {
            aoEscolher(achados[0]);
            setAberta(false);
          }
        }}
      />

      <button type="button" className="grafo-busca-fechar" onClick={fechar} aria-label={T.busca.fechar}>
        ✕
      </button>

      {achados.length > 0 && (
        <ul className="grafo-sugestoes">
          {achados.map((no) => (
            <li key={no.idPessoa}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(no);
                  setAberta(false);
                }}
              >
                <strong>{nomeDePessoa(no.nome)}</strong>
                <span>
                  {no.partido}
                  {no.uf && ` · ${no.uf}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {valor.trim().length >= 2 && achados.length === 0 && (
        <p className="grafo-sem-achado">{T.busca.nenhum}</p>
      )}
    </div>
  );

  function fechar() {
    aoDigitar('');
    setAberta(false);
  }
}

/**
 * ATENÇÃO: Desenhados à mão em vez de emoji: a lupa e a engrenagem mudam de forma e de cor conforme o
 * sistema, e num canto de 2rem sobre o desenho isso vira ruído.
 */
function IconeLupaComponent() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.8 12.8 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconeEngrenagemComponent() {
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

/**
 * RISCO: O percentual nunca vem sem a base. "Peso" é jargão nosso; na tela,
 * o que o número significa.
 *
 * ATENÇÃO: A segunda métrica fica em segundo plano: ela existe para a comparação
 * da RF-18, e não é o número que a tela pede para o leitor usar.
 *
 * RISCO: "comparáveis", não "votações". Medido em 2026-08-29: o número do grafo é,
 * em média, METADE do que a lista mostra para a mesma pessoa — Sargento Fahur
 * aparece com 1.134 na lista e 559 aqui. Os dois estão certos e contam coisas
 * diferentes: a lista conta votação registrada, o grafo conta as que entram na
 * comparação (Não fora as procedimentais, que pesam zero). Com a mesma palavra nos
 * dois lugares, não há como conciliar — e o leitor conclui que um deles erra.
 *
 * DECISÃO: "comparável" é o vocabulário que a afinidade já usa ("perguntas
 * comparáveis") e que a dica da aresta já segue.
 */
function DicaComponent({
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
    const a = porId.get(alvo.aresta.idPessoaDe);
    const b = porId.get(alvo.aresta.idPessoaPara);

    return (
      <div className="grafo-dica" style={estilo}>
        <strong>{a && nomeDePessoa(a.nome)}</strong>
        <strong>{b && nomeDePessoa(b.nome)}</strong>

        <span className="grafo-dica-meta">
          {T.dica.aresta(Math.round(alvo.aresta.peso * 100), alvo.aresta.votacoesComuns)}
        </span>

        {alvo.aresta.cosseno !== null && (
          <span className="grafo-dica-secundaria">
            {T.dica.cosseno(alvo.aresta.cosseno.toFixed(2))}
          </span>
        )}
      </div>
    );
  }

  const no = alvo.no;

  return (
    <div className="grafo-dica" style={estilo}>
      {no.urlFoto && <img src={no.urlFoto} alt="" className="grafo-dica-foto" loading="lazy" />}
      <strong>{nomeDePessoa(no.nome)}</strong>
      <span>
        {no.partido}
        {no.uf && ` · ${no.uf}`}
      </span>
      <span className="grafo-dica-meta">
        {T.dica.no(no.nVotacoes, (no.comunidade ?? 0) + 1)}
      </span>
    </div>
  );
}


/**
 * ATENÇÃO: Nó vence aresta: o alvo pequeno tem de ser o mais fácil de acertar.
 *
 * DECISÃO: A área de acerto acompanha o raio desenhado: com foto o nó fica grande, e o
 * alvo de 12px do desenho antigo cairia no meio do rosto.
 *
 * ATENÇÃO: Só procura aresta perto do cursor; varrer 5 mil segmentos por movimento do
 * mouse derrubaria o quadro.
 */
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

    const alcance = Math.max(12, raioNaTela(no, quadro) + 4);
    const distancia2 = (p.x - x) ** 2 + (p.y - y) ** 2;

    if (distancia2 < alcance * alcance && distancia2 < menor) {
      menor = distancia2;
      achado = no;
    }
  }

  if (achado) return { tipo: 'no', no: achado };

  let arestaAchada: ArestaDoGrafo | null = null;
  let menorDistancia = 5;

  for (const aresta of quadro.arestas) {
    const a = quadro.porId.get(aresta.idPessoaDe);
    const b = quadro.porId.get(aresta.idPessoaPara);
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
  const a = porId.get(aresta.idPessoaDe);
  const b = porId.get(aresta.idPessoaPara);
  if (!a || !b) return null;

  const pa = paraTela(a.eixoX!, a.eixoY!, t, c);
  const pb = paraTela(b.eixoX!, b.eixoY!, t, c);

  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
}

/**
 * Opção 2 do levantamento das arestas (2026-10-03, decisão do autor): o grafo abre mostrando só o
 * quarto mais forte das ligações. Com as 5.269 da Câmara à vista, a nuvem virava um borrão cinza.
 * O controle "Só ligações mais fortes" continua ajustando, e diz quantas estão à vista.
 */
function limiarInicial(arestas: readonly { peso: number }[]): number {
  if (arestas.length === 0) return 0;
  const pesos = arestas.map((a) => a.peso).sort((a, b) => a - b);
  const quartoDeCima = pesos[Math.floor(pesos.length * 0.75)];
  return Math.floor(quartoDeCima * 20) / 20;
}

/** Quanto é preciso aproximar, em relação à abertura, para as ligações aparecerem. */
const ZOOM_PARA_LIGACOES = 1.6;

/**
 * Opção 1 do levantamento (2026-10-03): de longe, só os pontos e as cores dos grupos; as ligações
 * aparecem ao aproximar, e as de um parlamentar quando o mouse passa sobre ele.
 */
function ligacoesAVista(camera: Camera, abertura: Camera | null): boolean {
  return abertura === null || camera.escala >= abertura.escala * ZOOM_PARA_LIGACOES;
}
