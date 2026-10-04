/**
 * A pintura do quadro. Nada aqui decide o que mostrar — só desenha o que recebe.
 *
 * ATENÇÃO: **Canvas, não SVG.** São 643 nós e 5.259 arestas: em SVG cada aresta vira um
 * elemento do DOM, e cada quadro de zoom refaria seis mil deles.
 *
 * RISCO: As cores identificam COMUNIDADE e não têm significado político (RNF-16). A
 * paleta é categórica de propósito: vermelho→azul seria lido como espectro mesmo sem
 * dizermos nada, e a foto no nó torna esse risco maior, não menor — o rosto convida à
 * leitura partidária.
 */

import type { ArestaDoGrafo, NoDoGrafo } from '../../api';
import { paraTela, type Camera, type Tamanho } from './camera';
import { foto, iniciais } from './fotos';
import type { RotulosDoEixo } from './legenda';
import { temaEfetivoEscuro } from '../../tema';
import { TEXTOS_DOS_COMPONENTES as T } from '../../textos/componentes';

/** ATENÇÃO: Retina: sem isto o desenho sai borrado em tela de alta densidade. */
/**
 * A densidade de pixels da tela, lida a cada desenho: muda quando a pessoa dá zoom no navegador ou
 * leva a janela para outro monitor, e um valor guardado deixava o canvas desfocado (2026-10-03).
 */
export function densidade(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
}

const RAIO_BASE = 3.4;
const RAIO_MINIMO = 1.8;
const RAIO_MAXIMO = 46;

/** A partir deste raio em pixel o rosto é reconhecível e vale trocar o disco por ele. */
const RAIO_PARA_FOTO = 9;

/** A partir deste raio cabe o nome embaixo sem virar sopa de letras. */
const RAIO_PARA_NOME = 6.5;

/**
 * RISCO: Paleta CATEGÓRICA — rótulo, não escala (RNF-16). Nenhum destes tons é cor de
 * partido brasileiro, e a sequência não sugere um eixo.
 */
const CORES = [
  '#0f766e', '#b45309', '#4338ca', '#a21caf',
  '#0e7490', '#7c2d12', '#4d7c0f', '#9f1239',
];

/**
 * Os mesmos matizes, mais claros, para o fundo escuro. Três dos tons de cima ficavam
 * abaixo de 3:1 contra #0b0e11 (índigo 2,45, marrom 2,07, vinho 2,41) e sumiam no
 * desenho. Aqui todos passam de 3:1 contra o fundo e contra o painel.
 *
 * DECISÃO (2026-10-03): tons menos saturados. A versão anterior (verde-limão, ciano, magenta da
 * paleta do Tailwind) parecia neon e fora do tom institucional do site. MEDIDO: os oito novos
 * ficam entre 6,7:1 e 7,8:1 contra o fundo escuro.
 */
const CORES_ESCURO = [
  '#5fa89e', '#c9944a', '#8c93d4', '#c486bf',
  '#6aa7b8', '#c58a6c', '#97ad69', '#cf8592',
];

/** Cinza de quem não tem comunidade. Um só serve aos dois temas: 3,6:1 no claro e 5,3:1
 *  no escuro. O anterior, #94a3b8, ficava em 2,56:1 sobre o branco. */
const SEM_COMUNIDADE = '#7b8794';

export function corDaComunidade(comunidade: number | null, escuro = false): string {
  if (comunidade === null) return SEM_COMUNIDADE;
  const paleta = escuro ? CORES_ESCURO : CORES;

  return paleta[comunidade % paleta.length];
}

export type Quadro = {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  porId: Map<number, NoDoGrafo>;
  /** Grau de cada nó no conjunto de arestas visível — dita o tamanho do ponto. */
  graus: Map<number, number>;
  arestaEmAlvo: ArestaDoGrafo | null;
  emFoco: NoDoGrafo | null;
  vizinhos: Set<number> | null;
  /**
   * U18: o grupo escolhido (um partido, um estado). Quem está fora fica esmaecido, no mesmo
   * lugar: esconder mudaria a forma da nuvem, que é o que a pessoa está lendo.
   */
  realcados?: Set<number> | null;
  cidadao?: { eixoX: number; eixoY: number } | null;
  camera: Camera;
  comFotos: boolean;
  /** Não Nulo quando os eixos estão desligados ou a casa não os nomeia. */
  eixos: RotulosDoEixo | null;
  /** Repinta quando uma foto termina de baixar. */
  aoChegarFoto: () => void;
  /** Falso de longe: só as ligações do nó em foco são desenhadas. Ausente vale verdadeiro. */
  ligacoesAVista?: boolean;
};

/** O raio em pixel de um nó — cresce com o zoom e com o grau, entre limites. */
export function raioNaTela(no: NoDoGrafo, quadro: Quadro): number {
  const grau = quadro.graus.get(no.id) ?? 0;
  const porGrau = 0.72 + Math.min(grau, 40) / 40 * 0.55;
  const porZoom = Math.pow(quadro.camera.escala, 0.55);

  return Math.min(RAIO_MAXIMO, Math.max(RAIO_MINIMO, RAIO_BASE * porGrau * porZoom));
}

/**
 * ATENÇÃO: ANTES das arestas: o eixo é referência de fundo, não elemento sobre a figura.
 * Desenhado por cima, ele cortaria os nós ao meio.
 */
export function desenhar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  quadro: Quadro,
) {
  const d = densidade();
  const t = { largura: canvas.width / d, altura: canvas.height / d };
  const escuro = temaEfetivoEscuro();

  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, t.largura, t.altura);

  desenharGrade(ctx, t, quadro.camera, escuro);
  if (quadro.eixos) desenharEixos(ctx, t, quadro, escuro);
  desenharArestas(ctx, t, quadro, escuro);
  desenharNos(ctx, t, quadro, escuro);
  desenharCidadao(ctx, t, quadro, escuro);
}

/**
 * DECISÃO: A malha de pontos que anda junto com a câmera.
 *
 * É o que faz o plano parecer infinito em vez de uma imagem dentro de uma moldura: sem
 * uma referência que se mexe, arrastar o fundo vazio não dá nenhum retorno visual e o
 * usuário conclui que o gesto não funcionou.
 *
 * O passo dobra a cada oitava de zoom, para a densidade na tela ficar constante.
 */
function desenharGrade(ctx: CanvasRenderingContext2D, t: Tamanho, c: Camera, escuro: boolean) {
  const passoMundo = Math.pow(2, Math.round(Math.log2(60 / c.escala)));
  const passo = passoMundo * c.escala;
  if (passo < 8) return;

  ctx.fillStyle = escuro ? 'rgba(150,165,180,0.10)' : 'rgba(70,90,110,0.10)';

  const primeiroX = c.x % passo;
  const primeiroY = c.y % passo;

  for (let x = primeiroX; x < t.largura; x += passo) {
    for (let y = primeiroY; y < t.altura; y += passo) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Os dois eixos, com o que a horizontal significa escrito nas pontas.
 *
 * ## RISCO: Os rótulos vêm do dado
 *
 * `eixos.esquerda` e `.direita` são calculados olhando de que lado os governistas
 * efetivamente caíram. O sinal do eixo é arbitrário — escrever "esquerda = governo"
 * aqui faria a figura mentir sobre si mesma no dia em que uma reexecução a espelhasse.
 *
 * ATENÇÃO: Só as duas pontas ganham texto. O parágrafo explicativo que ficava sob a linha
 * saiu: quem liga os eixos quer a referência, não uma aula — e a explicação já vive
 * no painel de ajustes, junto do seletor que a produz.
 *
 * ## ATENÇÃO: Por que o rótulo fica preso à BORDA e não à ponta do eixo
 *
 * Com zoom, a ponta do eixo sai da tela e o texto sumiria justamente quando a pessoa
 * está examinando de perto. Ancorado na borda, ele acompanha.
 *
 * Horizontal — a que tem significado.
 *
 * Vertical — presente para dar a referência do meio, não porque meça algo.
 *
 * ATENÇÃO: Contorno na cor do fundo: o rótulo fica sobre a nuvem de pontos, e sem ele o
 * texto some dentro da teia de arestas.
 */
function desenharEixos(
  ctx: CanvasRenderingContext2D,
  t: Tamanho,
  quadro: Quadro,
  escuro: boolean,
) {
  const eixos = quadro.eixos!;
  const origem = paraTela(0, 0, t, quadro.camera);

  const linha = escuro ? 'rgba(150,165,180,0.30)' : 'rgba(70,90,110,0.28)';
  const forte = escuro ? '#c9d4de' : '#3b4652';

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = linha;

  if (origem.y > -20 && origem.y < t.altura + 20) {
    ctx.beginPath();
    ctx.moveTo(0, origem.y);
    ctx.lineTo(t.largura, origem.y);
    ctx.stroke();
  }

  if (origem.x > -20 && origem.x < t.largura + 20) {
    ctx.beginPath();
    ctx.moveTo(origem.x, 0);
    ctx.lineTo(origem.x, t.altura);
    ctx.stroke();
  }
  ctx.restore();

  const y = Math.max(22, Math.min(t.altura - 34, origem.y));

  ctx.save();
  ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  const escrever = (texto: string, x: number, altura: number, cor: string) => {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = escuro ? 'rgba(11,14,17,0.9)' : 'rgba(255,255,255,0.9)';
    ctx.strokeText(texto, x, altura);
    ctx.fillStyle = cor;
    ctx.fillText(texto, x, altura);
  };

  ctx.textAlign = 'left';
  escrever(`◀ ${eixos.esquerda}`, 10, y - 12, forte);

  ctx.textAlign = 'right';
  escrever(`${eixos.direita} ▶`, t.largura - 10, y - 12, forte);

  ctx.restore();
}

/**
 * DECISÃO: A espessura carrega o peso: a ligação de 95% é visivelmente mais grossa que a
 * de 62%, e a figura passa a dizer isso sem precisar de legenda.
 */
function desenharArestas(
  ctx: CanvasRenderingContext2D,
  t: Tamanho,
  quadro: Quadro,
  escuro: boolean,
) {
  for (const aresta of quadro.arestas) {
    const a = quadro.porId.get(aresta.de);
    const b = quadro.porId.get(aresta.para);
    if (!a || !b) continue;

    const doFoco = quadro.emFoco !== null && (aresta.de === quadro.emFoco.id || aresta.para === quadro.emFoco.id);
    if (quadro.ligacoesAVista === false && !doFoco) continue;

    const naVizinhanca =
      !quadro.vizinhos ||
      (quadro.vizinhos.has(aresta.de) && quadro.vizinhos.has(aresta.para));
    const destacada = quadro.arestaEmAlvo === aresta;

    const pa = paraTela(a.eixoX!, a.eixoY!, t, quadro.camera);
    const pb = paraTela(b.eixoX!, b.eixoY!, t, quadro.camera);

    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);

    const forca = Math.max(0, Math.min(1, (aresta.peso - 0.5) * 2));
    ctx.lineWidth = destacada ? 2.4 : 0.35 + forca * 1.15;
    ctx.strokeStyle = destacada
      ? corDaComunidade(a.comunidade, escuro)
      : escuro
        ? `rgba(140,155,170,${naVizinhanca ? 0.1 + forca * 0.22 : 0.04})`
        : `rgba(70,90,110,${naVizinhanca ? 0.08 + forca * 0.2 : 0.035})`;
    ctx.stroke();
  }
}

/**
 * Fora do quadro não desenha — e, sobretudo, não pede a foto.
 *
 * RISCO: O anel da comunidade fica MESMO com foto: é ele que carrega o agrupamento,
 * e trocar a cor pelo rosto devolveria a leitura ao partido — o contrário do
 * que o trabalho mede.
 */
function desenharNos(
  ctx: CanvasRenderingContext2D,
  t: Tamanho,
  quadro: Quadro,
  escuro: boolean,
) {
  const contorno = escuro ? '#0b0e11' : '#ffffff';
  const nomes: NomeCandidato[] = [];

  for (const no of quadro.nos) {
    const p = paraTela(no.eixoX!, no.eixoY!, t, quadro.camera);
    const raio = raioNaTela(no, quadro);

    if (
      p.x < -raio * 2 || p.x > t.largura + raio * 2 ||
      p.y < -raio * 2 || p.y > t.altura + raio * 2
    ) continue;

    const destacado = quadro.emFoco?.id === no.id;
    const apagado = quadro.vizinhos
      ? !quadro.vizinhos.has(no.id)
      : quadro.realcados
        ? !quadro.realcados.has(no.id)
        : false;
    const cor = corDaComunidade(no.comunidade, escuro);
    const raioFinal = destacado ? raio * 1.5 : raio;

    ctx.globalAlpha = apagado ? 0.12 : 1;

    const rosto =
      quadro.comFotos && raioFinal >= RAIO_PARA_FOTO && !apagado
        ? foto(no.urlFoto, quadro.aoChegarFoto)
        : null;

    if (rosto) desenharRosto(ctx, rosto, p, raioFinal);
    else if (raioFinal >= RAIO_PARA_FOTO && !apagado)
      desenharIniciais(ctx, no, p, raioFinal, cor);
    else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, raioFinal, 0, Math.PI * 2);
      ctx.fillStyle = cor;
      ctx.globalAlpha = apagado ? 0.12 : 1;
      ctx.fill();
      if (!apagado && raioFinal >= 2) {
        ctx.lineWidth = Math.min(1, raioFinal * 0.25);
        ctx.strokeStyle = contorno;
        ctx.stroke();
      }
    }

    if (raioFinal >= RAIO_PARA_FOTO && !apagado) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, raioFinal, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1.5, raioFinal * 0.14);
      ctx.strokeStyle = cor;
      ctx.stroke();
    }

    if (destacado) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, raioFinal + (raioFinal >= RAIO_PARA_FOTO ? 3 : 1.4), 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = contorno;
      ctx.stroke();
    }

    const merece = raioFinal >= RAIO_PARA_NOME || destacado;
    if (merece && !apagado) {
      nomes.push({ no, p, raio: raioFinal, destacado, grau: quadro.graus.get(no.id) ?? 0 });
    }
  }

  ctx.globalAlpha = 1;
  desenharNomesSemColisao(ctx, nomes, escuro);
}

type NomeCandidato = {
  no: NoDoGrafo;
  p: { x: number; y: number };
  raio: number;
  destacado: boolean;
  grau: number;
};

/**
 * Os nomes depois de todos os pontos, e só os que cabem.
 *
 * MEDIDO: Com a abertura enquadrada no miolo (2026-10-01), dezenas de pontos passavam do raio
 * mínimo ao mesmo tempo, e os nomes se empilhavam no meio da nuvem: "sopa de letras",
 * exatamente o que o limiar de raio existia para evitar.
 *
 * DECISÃO: Vão em ordem de relevância: o destacado sempre, depois quem tem mais ligações. Um
 * nome que cairia sobre outro já desenhado fica de fora — aproximar o zoom abre espaço e
 * ele aparece. Desenhados por último, nenhum ponto os cobre.
 */
function desenharNomesSemColisao(
  ctx: CanvasRenderingContext2D,
  nomes: NomeCandidato[],
  escuro: boolean,
) {
  const ocupados: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const ordem = [...nomes].sort(
    (a, b) => Number(b.destacado) - Number(a.destacado) || b.grau - a.grau,
  );

  for (const { no, p, raio, destacado } of ordem) {
    const tamanho = tamanhoDoNome(raio);
    ctx.font = fonteDoNome(tamanho);
    const largura = ctx.measureText(no.nome).width;
    const base = p.y + raio + tamanho + 2;
    const caixa = { x0: p.x - largura / 2 - 3, y0: base - tamanho - 2, x1: p.x + largura / 2 + 3, y1: base + 4 };

    const colide = ocupados.some(
      (o) => caixa.x0 < o.x1 && caixa.x1 > o.x0 && caixa.y0 < o.y1 && caixa.y1 > o.y0,
    );
    if (colide && !destacado) continue;

    ocupados.push(caixa);
    desenharNome(ctx, no, p, raio, escuro);
  }
}

function tamanhoDoNome(raio: number): number {
  return Math.max(10, Math.min(15, raio * 0.62));
}

function fonteDoNome(tamanho: number): string {
  return `500 ${tamanho}px "IBM Plex Sans", system-ui, sans-serif`;
}

/**
 * ATENÇÃO: A foto oficial é retrato (mais alta que larga). Esticá-la para o círculo
 * deforma o rosto; o recorte quadrado no topo pega a cabeça, que é o que
 * identifica a pessoa.
 */
function desenharRosto(
  ctx: CanvasRenderingContext2D,
  imagem: HTMLImageElement,
  p: { x: number; y: number },
  raio: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, raio, 0, Math.PI * 2);
  ctx.clip();

  const lado = Math.min(imagem.naturalWidth, imagem.naturalHeight) || 1;
  const origemX = (imagem.naturalWidth - lado) / 2;
  const origemY = Math.max(0, (imagem.naturalHeight - lado) * 0.18);

  ctx.drawImage(
    imagem, origemX, origemY, lado, lado,
    p.x - raio, p.y - raio, raio * 2, raio * 2,
  );
  ctx.restore();
}

/** O que aparece quando a pessoa não tem foto publicada — nunca um buraco. */
function desenharIniciais(
  ctx: CanvasRenderingContext2D,
  no: NoDoGrafo,
  p: { x: number; y: number },
  raio: number,
  cor: string,
) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, raio, 0, Math.PI * 2);
  ctx.fillStyle = cor;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(raio * 0.85)}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(iniciais(no.nome), p.x, p.y + raio * 0.04);
  ctx.textBaseline = 'alphabetic';
}

/**
 * ATENÇÃO: Contorno na cor do fundo antes do texto: sem ele o nome sobre uma teia de
 * arestas fica ilegível, e escurecer o grafo inteiro para resolver isso apagaria
 * justamente a estrutura que a tela existe para mostrar.
 */
function desenharNome(
  ctx: CanvasRenderingContext2D,
  no: NoDoGrafo,
  p: { x: number; y: number },
  raio: number,
  escuro: boolean,
) {
  const tamanho = tamanhoDoNome(raio);

  ctx.font = fonteDoNome(tamanho);
  ctx.textAlign = 'center';

  ctx.lineWidth = 3;
  ctx.strokeStyle = escuro ? 'rgba(11,14,17,0.85)' : 'rgba(255,255,255,0.85)';
  ctx.strokeText(no.nome, p.x, p.y + raio + tamanho + 2);

  ctx.fillStyle = escuro ? '#c9d4de' : '#3b4652';
  ctx.fillText(no.nome, p.x, p.y + raio + tamanho + 2);
}

/**
 * ATENÇÃO: Forma DIFERENTE, não só cor: o cidadão não é parlamentar, e a distinção
 * precisa sobreviver a daltonismo e a impressão em preto e branco.
 */
function desenharCidadao(
  ctx: CanvasRenderingContext2D,
  t: Tamanho,
  quadro: Quadro,
  escuro: boolean,
) {
  if (!quadro.cidadao) return;

  const p = paraTela(quadro.cidadao.eixoX, quadro.cidadao.eixoY, t, quadro.camera);

  const raio = Math.max(9, Math.min(22, 10 * Math.pow(quadro.camera.escala, 0.4)));

  ctx.beginPath();
  ctx.moveTo(p.x, p.y - raio);
  ctx.lineTo(p.x + raio, p.y);
  ctx.lineTo(p.x, p.y + raio);
  ctx.lineTo(p.x - raio, p.y);
  ctx.closePath();
  ctx.fillStyle = escuro ? '#e6eaee' : '#12161b';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = escuro ? '#0b0e11' : '#ffffff';
  ctx.stroke();

  ctx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = escuro ? '#e6eaee' : '#12161b';
  ctx.textAlign = 'center';
  ctx.fillText(T.eixos.voce, p.x, p.y + raio + 13);
}
