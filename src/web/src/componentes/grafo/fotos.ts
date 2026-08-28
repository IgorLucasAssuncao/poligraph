/**
 * O cache de fotos dos parlamentares, para o Canvas desenhar rosto em vez de bolinha.
 *
 * ## Por que existe um cache, e não um `<img>` por nó
 *
 * São 643 rostos na Câmara. `drawImage` exige a imagem já decodificada, então alguém
 * precisa guardá-las — e precisa **não** pedir as 643 de uma vez: medido, a foto de um
 * senador tem 241 KB e a de um deputado 41 KB, o que dá cerca de 50 MB se tudo for
 * baixado junto, para mostrar rosto que ninguém consegue distinguir naquele zoom.
 *
 * ## A regra de carregamento
 *
 * A tela pede apenas as fotos dos nós que **cabem no quadro e estão grandes o
 * bastante**. Enquanto a foto não chega — ou quando não existe, como nos senadores
 * criados a partir do próprio voto — o nó cai no desenho por iniciais, que ⛔ nunca
 * fica em branco.
 */

type Estado = { imagem: HTMLImageElement; pronta: boolean; falhou: boolean };

/** ⚠️ Módulo, não estado do React: o cache sobrevive a trocar de casa e voltar. */
const cache = new Map<string, Estado>();

let emVoo = 0;
const fila: string[] = [];

/**
 * Quantas fotos baixam ao mesmo tempo.
 *
 * ⚠️ Sem teto, mover o cursor sobre a nuvem dispara centenas de requisições ao
 * servidor da Câmara e o navegador enfileira tudo, inclusive a chamada da própria API.
 */
const SIMULTANEAS = 8;

/**
 * A foto, se já estiver pronta. Pedir agenda o download; ⛔ nunca bloqueia o desenho.
 *
 * @param aoChegar chamado quando uma foto termina de carregar, para repintar o quadro.
 */
export function foto(url: string | null, aoChegar: () => void): HTMLImageElement | null {
  if (!url) return null;

  const guardada = cache.get(url);
  if (guardada) return guardada.pronta ? guardada.imagem : null;

  const imagem = new Image();
  const estado: Estado = { imagem, pronta: false, falhou: false };
  cache.set(url, estado);

  // ⚠️ `crossOrigin` fica de fora de propósito. A imagem é só desenhada, e pedir CORS
  //    faria a Câmara recusar o cabeçalho e o rosto sumir — o Canvas ficaria "sujo"
  //    apenas se alguém tentasse ler os pixels de volta, o que aqui não acontece.
  imagem.decoding = 'async';
  imagem.onload = () => {
    estado.pronta = true;
    liberar();
    aoChegar();
  };
  imagem.onerror = () => {
    estado.falhou = true;
    liberar();
  };

  if (emVoo < SIMULTANEAS) {
    emVoo += 1;
    imagem.src = url;
  } else {
    fila.push(url);
  }

  return null;
}

/** As duas primeiras letras do nome — o que aparece enquanto a foto não chega. */
export function iniciais(nome: string): string {
  const partes = nome
    .split(/\s+/)
    .filter((parte) => parte.length > 2 || /^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(parte));

  const primeira = partes[0]?.[0] ?? nome[0] ?? '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';

  return (primeira + ultima).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════

function liberar() {
  emVoo -= 1;

  const proxima = fila.shift();
  if (!proxima) return;

  const estado = cache.get(proxima);
  if (!estado) return;

  emVoo += 1;
  estado.imagem.src = proxima;
}
