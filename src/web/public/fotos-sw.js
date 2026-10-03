/**
 * Cópia das fotos dos parlamentares NO NAVEGADOR do visitante.
 *
 * As fotos vêm da Câmara e do Senado, e não são hospedadas por nós (licença e LGPD).
 * Mas as duas casas pedem que o navegador as busque de novo a cada visita:
 *
 * | Casa   | Medido em 2026-10-01                                         |
 * |--------|--------------------------------------------------------------|
 * | Câmara | 30–41 KB, `Cache-Control: no-cache`, sem CORS               |
 * | Senado | 170–330 KB, `max-age=600`                                    |
 *
 * Este service worker serve a foto já vista do cache do próprio navegador e só vai à
 * casa na primeira vez. A cópia fica no aparelho de quem visitou, não num servidor.
 *
 * ATENÇÃO: A Câmara não manda CORS, então a resposta é OPACA, e o Chrome conta cada uma como
 * ~7 MB de cota. Por isso o limite de entradas: as mais antigas saem primeiro.
 *
 * ATENÇÃO: O cache tem o mês no nome. Na virada do mês ele recomeça: foto trocada pela casa
 * aparece em até um mês, e o que ninguém mais viu não fica ocupando espaço.
 */
const PREFIXO = 'fotos-parlamentares-';
const MAXIMO_DE_FOTOS = 300;
const ORIGENS = new Set(['www.camara.leg.br', 'legis.senado.leg.br', 'www.senado.leg.br']);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || pedido.destination !== 'image') return;
  if (!ORIGENS.has(new URL(pedido.url).hostname)) return;

  evento.respondWith(daCopiaOuDaCasa(pedido));
});

async function daCopiaOuDaCasa(pedido) {
  const nome = PREFIXO + new Date().toISOString().slice(0, 7);
  const cache = await caches.open(nome);
  const copia = await cache.match(pedido);
  if (copia) return copia;

  const resposta = await fetch(pedido);
  if (resposta.ok || resposta.type === 'opaque') {
    await cache.put(pedido, resposta.clone());
    await podar(cache);
    await apagarMesesAnteriores(nome);
  }
  return resposta;
}

async function podar(cache) {
  const chaves = await cache.keys();
  for (const chave of chaves.slice(0, Math.max(0, chaves.length - MAXIMO_DE_FOTOS))) {
    await cache.delete(chave);
  }
}

async function apagarMesesAnteriores(atual) {
  for (const nome of await caches.keys()) {
    if (nome.startsWith(PREFIXO) && nome !== atual) await caches.delete(nome);
  }
}
