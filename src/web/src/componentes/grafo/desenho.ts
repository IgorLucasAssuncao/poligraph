/**
 * A pintura do quadro. Nada aqui decide o que mostrar — só desenha o que recebe.
 *
 * ⚠️ **Canvas, não SVG.** São 643 nós e 5.271 arestas: em SVG cada aresta vira um
 * elemento do DOM, e cada quadro de zoom refaria seis mil deles.
 *
 * 🔴 As cores identificam COMUNIDADE e ⛔ não têm significado político (RNF-16). A
 * paleta é categórica de propósito: vermelho→azul seria lido como espectro mesmo sem
 * dizermos nada, e a foto no nó torna esse risco maior, não menor — o rosto convida à
 * leitura partidária.
 */

import type { ArestaDoGrafo, NoDoGrafo } from '../../api';
import { paraTela, type Camera, type Tamanho } from './camera';
import { foto, iniciais } from './fotos';

/** ⚠️ Retina: sem isto o desenho sai borrado em tela de alta densidade. */
export const DENSIDADE = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

const RAIO_BASE = 3.4;
const RAIO_MINIMO = 1.8;
const RAIO_MAXIMO = 46;

/** A partir deste raio em pixel o rosto é reconhecível e vale trocar o disco por ele. */
const RAIO_PARA_FOTO = 9;

/** A partir deste raio cabe o nome embaixo sem virar sopa de letras. */
const RAIO_PARA_NOME = 6.5;

/**
 * 🔴 Paleta CATEGÓRICA — rótulo, não escala (RNF-16). Nenhum destes tons é cor de
 * partido brasileiro, e a sequência ⛔ não sugere um eixo.
 */
const CORES = [
  '#0f766e', '#b45309', '#4338ca', '#a21caf',
  '#0e7490', '#7c2d12', '#4d7c0f', '#9f1239',
];

export function corDaComunidade(comunidade: number | null): string {
  return comunidade === null ? '#94a3b8' : CORES[comunidade % CORES.length];
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
  cidadao?: { eixoX: number; eixoY: number } | null;
  camera: Camera;
  comFotos: boolean;
  /** Repinta quando uma foto termina de baixar. */
  aoChegarFoto: () => void;
};

/** O raio em pixel de um nó — cresce com o zoom e com o grau, entre limites. */
export function raioNaTela(no: NoDoGrafo, quadro: Quadro): number {
  const grau = quadro.graus.get(no.id) ?? 0;
  const porGrau = 0.72 + Math.min(grau, 40) / 40 * 0.55;
  const porZoom = Math.pow(quadro.camera.escala, 0.55);

  return Math.min(RAIO_MAXIMO, Math.max(RAIO_MINIMO, RAIO_BASE * porGrau * porZoom));
}

export function desenhar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  quadro: Quadro,
) {
  const t = { largura: canvas.width / DENSIDADE, altura: canvas.height / DENSIDADE };
  const escuro = matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

  ctx.setTransform(DENSIDADE, 0, 0, DENSIDADE, 0, 0);
  ctx.clearRect(0, 0, t.largura, t.altura);

  desenharGrade(ctx, t, quadro.camera, escuro);
  desenharArestas(ctx, t, quadro, escuro);
  desenharNos(ctx, t, quadro, escuro);
  desenharCidadao(ctx, t, quadro, escuro);
}

// ═══════════════════════════════════════════════════════════════════

/**
 * ⭐ A malha de pontos que anda junto com a câmera.
 *
 * É o que faz o plano parecer infinito em vez de uma imagem dentro de uma moldura: sem
 * uma referência que se mexe, arrastar o fundo vazio não dá nenhum retorno visual e o
 * usuário conclui que o gesto não funcionou.
 */
function desenharGrade(ctx: CanvasRenderingContext2D, t: Tamanho, c: Camera, escuro: boolean) {
  // O passo dobra a cada oitava de zoom, para a densidade na tela ficar constante.
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

    const naVizinhanca =
      !quadro.vizinhos ||
      (quadro.vizinhos.has(aresta.de) && quadro.vizinhos.has(aresta.para));
    const destacada = quadro.arestaEmAlvo === aresta;

    const pa = paraTela(a.eixoX!, a.eixoY!, t, quadro.camera);
    const pb = paraTela(b.eixoX!, b.eixoY!, t, quadro.camera);

    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);

    // ⭐ A espessura carrega o peso: a ligação de 95% é visivelmente mais grossa que a
    //    de 62%, e a figura passa a dizer isso sem precisar de legenda.
    const forca = Math.max(0, Math.min(1, (aresta.peso - 0.5) * 2));
    ctx.lineWidth = destacada ? 2.4 : 0.35 + forca * 1.15;
    ctx.strokeStyle = destacada
      ? corDaComunidade(a.comunidade)
      : escuro
        ? `rgba(140,155,170,${naVizinhanca ? 0.1 + forca * 0.22 : 0.04})`
        : `rgba(70,90,110,${naVizinhanca ? 0.08 + forca * 0.2 : 0.035})`;
    ctx.stroke();
  }
}

function desenharNos(
  ctx: CanvasRenderingContext2D,
  t: Tamanho,
  quadro: Quadro,
  escuro: boolean,
) {
  const contorno = escuro ? '#0b0e11' : '#ffffff';

  for (const no of quadro.nos) {
    const p = paraTela(no.eixoX!, no.eixoY!, t, quadro.camera);
    const raio = raioNaTela(no, quadro);

    // Fora do quadro não desenha — e, sobretudo, ⛔ não pede a foto.
    if (
      p.x < -raio * 2 || p.x > t.largura + raio * 2 ||
      p.y < -raio * 2 || p.y > t.altura + raio * 2
    ) continue;

    const destacado = quadro.emFoco?.id === no.id;
    const apagado = quadro.vizinhos ? !quadro.vizinhos.has(no.id) : false;
    const cor = corDaComunidade(no.comunidade);
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
      ctx.globalAlpha = apagado ? 0.12 : destacado ? 1 : 0.85;
      ctx.fill();
    }

    // 🔴 O anel da comunidade fica MESMO com foto: é ele que carrega o agrupamento,
    //    e trocar a cor pelo rosto devolveria a leitura ao partido — o contrário do
    //    que o trabalho mede.
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
    if (merece && !apagado) desenharNome(ctx, no, p, raioFinal, escuro);
  }

  ctx.globalAlpha = 1;
}

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

  // ⚠️ A foto oficial é retrato (mais alta que larga). Esticá-la para o círculo
  //    deforma o rosto; o recorte quadrado no topo pega a cabeça, que é o que
  //    identifica a pessoa.
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

function desenharNome(
  ctx: CanvasRenderingContext2D,
  no: NoDoGrafo,
  p: { x: number; y: number },
  raio: number,
  escuro: boolean,
) {
  const tamanho = Math.max(10, Math.min(15, raio * 0.62));

  ctx.font = `500 ${tamanho}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';

  // ⚠️ Contorno na cor do fundo antes do texto: sem ele o nome sobre uma teia de
  //    arestas fica ilegível, e escurecer o grafo inteiro para resolver isso apagaria
  //    justamente a estrutura que a tela existe para mostrar.
  ctx.lineWidth = 3;
  ctx.strokeStyle = escuro ? 'rgba(11,14,17,0.85)' : 'rgba(255,255,255,0.85)';
  ctx.strokeText(no.nome, p.x, p.y + raio + tamanho + 2);

  ctx.fillStyle = escuro ? '#c9d4de' : '#3b4652';
  ctx.fillText(no.nome, p.x, p.y + raio + tamanho + 2);
}

function desenharCidadao(
  ctx: CanvasRenderingContext2D,
  t: Tamanho,
  quadro: Quadro,
  escuro: boolean,
) {
  if (!quadro.cidadao) return;

  const p = paraTela(quadro.cidadao.eixoX, quadro.cidadao.eixoY, t, quadro.camera);

  // ⚠️ Forma DIFERENTE, não só cor: o cidadão não é parlamentar, e a distinção
  //    precisa sobreviver a daltonismo e a impressão em preto e branco.
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
  ctx.fillText('você', p.x, p.y + raio + 13);
}
