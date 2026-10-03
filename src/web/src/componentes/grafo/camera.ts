/**
 * A câmera sobre o plano do grafo — conversão entre coordenada de layout e pixel.
 *
 * DECISÃO: **O plano é infinito.** O ETL entrega posições em [-1, 1], mas nada aqui prende a
 * câmera a essa caixa: dá para afastar até a nuvem virar um ponto e aproximar até dois
 * vizinhos ficarem a meia tela de distância. O que limita é só o intervalo de escala,
 * e ele existe para evitar perder o desenho de vista, não para cercar o plano.
 */

export type Camera = { escala: number; x: number; y: number };

export type Tamanho = { largura: number; altura: number };

export type Ponto = { x: number; y: number };

/** Margem em pixel entre a caixa do layout e a borda, na escala 1. */
export const MARGEM = 30;

/**
 * ATENÇÃO: O intervalo é largo de propósito. 0,6× era o mínimo antigo e não deixava ver a
 * nuvem inteira depois de arrastar; 40× era o máximo e já não bastava para separar
 * dois nós vizinhos no centro do grafo da Câmara.
 */
export const ESCALA_MINIMA = 0.08;
export const ESCALA_MAXIMA = 120;

/** Converte coordenada do layout (ex, ey) para pixel na tela. */
export function paraTela(ex: number, ey: number, t: Tamanho, c: Camera): Ponto {
  const base = {
    x: MARGEM + ((ex + 1) / 2) * (t.largura - MARGEM * 2),
    y: MARGEM + ((ey + 1) / 2) * (t.altura - MARGEM * 2),
  };

  return { x: base.x * c.escala + c.x, y: base.y * c.escala + c.y };
}

/**
 * O caminho de volta: pixel na tela para coordenada do layout.
 *
 * ATENÇÃO: É o que faz o arrasto de um nó acompanhar o cursor em qualquer zoom. A versão
 * anterior convertia o deslocamento por regra de três e o nó descolava do ponteiro
 * conforme a escala subia.
 */
export function paraMundo(px: number, py: number, t: Tamanho, c: Camera): Ponto {
  const semCamera = { x: (px - c.x) / c.escala, y: (py - c.y) / c.escala };

  return {
    x: ((semCamera.x - MARGEM) / (t.largura - MARGEM * 2)) * 2 - 1,
    y: ((semCamera.y - MARGEM) / (t.altura - MARGEM * 2)) * 2 - 1,
  };
}

/** DECISÃO: Aproxima no PONTO DO CURSOR, não no centro — é o que faz o zoom parecer natural. */
export function aproximar(camera: Camera, px: number, py: number, deltaY: number): Camera {
  return comEscala(camera, camera.escala * Math.exp(-deltaY * 0.0015), px, py);
}

/** Vai para uma escala absoluta mantendo fixo o ponto (px, py) da tela. */
export function comEscala(camera: Camera, alvo: number, px: number, py: number): Camera {
  const escala = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, alvo));
  const razao = escala / camera.escala;

  return {
    escala,
    x: px - (px - camera.x) * razao,
    y: py - (py - camera.y) * razao,
  };
}

/**
 * A câmera que faz caber tudo o que está desenhado.
 *
 * ATENÇÃO: Não é o mesmo que voltar à escala 1. Depois de isolar um deputado sobram trinta
 * pontos num canto do plano, e "enquadrar" precisa ir até eles — voltar à escala 1
 * mostraria a moldura vazia onde o grafo inteiro costumava estar.
 *
 * Um nó só, ou todos empilhados: centraliza sem tentar dividir por zero.
 */
export function enquadrar(
  pontos: readonly Ponto[],
  t: Tamanho,
  folga = 0.86,
): Camera {
  const neutra: Camera = { escala: 1, x: 0, y: 0 };
  if (pontos.length === 0) return neutra;

  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const caixa = {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };

  const larguraMundo = Math.max(caixa.maxX - caixa.minX, 1e-6);
  const alturaMundo = Math.max(caixa.maxY - caixa.minY, 1e-6);

  const canto = paraTela(caixa.minX, caixa.minY, t, neutra);
  const oposto = paraTela(caixa.maxX, caixa.maxY, t, neutra);

  const escala = Math.min(
    ESCALA_MAXIMA,
    Math.max(
      ESCALA_MINIMA,
      Math.min(
        (t.largura * folga) / Math.max(oposto.x - canto.x, 1e-6),
        (t.altura * folga) / Math.max(oposto.y - canto.y, 1e-6),
      ),
    ),
  );

  const centro = paraTela(
    caixa.minX + larguraMundo / 2,
    caixa.minY + alturaMundo / 2,
    t,
    { escala, x: 0, y: 0 },
  );

  return { escala, x: t.largura / 2 - centro.x, y: t.altura / 2 - centro.y };
}

/**
 * A câmera da abertura: enquadra o MIOLO da nuvem, não os extremos.
 *
 * MEDIDO: Medido em 2026-10-01 no grafo da Câmara (57ª): ~12 deputados isolados, que votaram
 * pouco demais para se ligar a alguém, ficam nas bordas do plano. Enquadrando todos, os
 * ~630 do miolo viravam um traço no meio do desenho, e a figura principal do site era a
 * que menos se lia.
 *
 * DECISÃO: O corte é por percentil em cada eixo (2% de cada lado): os isolados continuam no
 * desenho, só fora do quadro inicial, e "Enquadrar tudo" ainda os alcança. Com poucos
 * pontos (isolar um parlamentar) não há o que cortar, e o resultado é o de `enquadrar`.
 *
 * MEDIDO: Em 2026-10-03, no Senado (57ª): uns 20 dos 104 senadores ficam sem ligação e o layout
 * os espalha num anel largo. Com 20% de isolados, o corte de 2% não os tirava, e a nuvem abria
 * minúscula no meio. Por isso a tela passa só os nós que têm ao menos uma ligação.
 */
export function enquadrarMiolo(pontos: readonly Ponto[], t: Tamanho, corte = 0.02): Camera {
  if (pontos.length < 20) return enquadrar(pontos, t);

  const xs = pontos.map((p) => p.x).sort((a, b) => a - b);
  const ys = pontos.map((p) => p.y).sort((a, b) => a - b);
  const quantil = (valores: number[], q: number) =>
    valores[Math.min(valores.length - 1, Math.max(0, Math.round(q * (valores.length - 1))))];

  return enquadrar(
    [
      { x: quantil(xs, corte), y: quantil(ys, corte) },
      { x: quantil(xs, 1 - corte), y: quantil(ys, 1 - corte) },
    ],
    t,
  );
}

/**
 * Distância de um ponto ao segmento — usada para acertar aresta com o cursor.
 *
 * projeção do ponto sobre o segmento, presa entre as duas pontas
 */
export function distanciaAoSegmento(x: number, y: number, a: Ponto, b: Ponto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimento = dx * dx + dy * dy;

  if (comprimento === 0) return Math.hypot(x - a.x, y - a.y);

  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / comprimento));

  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

/**
 * A pinça de dois dedos: aproxima pela razão entre as distâncias, em volta do ponto
 * médio, e acompanha o ponto médio quando os dois dedos andam juntos.
 *
 * DECISÃO: Sem o acompanhamento, arrastar com dois dedos não moveria nada — e é o gesto que quem
 * usa mapa no celular faz primeiro.
 */
export function pinca(camera: Camera, antes: [Ponto, Ponto], depois: [Ponto, Ponto]): Camera {
  const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
  const meio = (a: Ponto, b: Ponto) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const meioAntes = meio(...antes);
  const meioDepois = meio(...depois);
  const razao = distancia(...depois) / Math.max(distancia(...antes), 1);

  const arrastada = { ...camera, x: camera.x + meioDepois.x - meioAntes.x, y: camera.y + meioDepois.y - meioAntes.y };
  return comEscala(arrastada, camera.escala * razao, meioDepois.x, meioDepois.y);
}
