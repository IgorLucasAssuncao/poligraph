/**
 * O service worker do site: a cópia das fotos e os avisos no navegador (Pendência 89).
 *
 * Avisos: o worker do servidor manda pelo serviço de push do fabricante um JSON cifrado com
 * `titulo`, `corpo` e `url`. Aqui ele vira notificação, e o clique abre o site no início, onde
 * está o "O que mudou". O texto nunca traz nome de parlamentar: aparece na tela de bloqueio.
 *
 * ATENÇÃO: O `tag` faz um aviso novo substituir o anterior em vez de empilhar.
 *
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

self.addEventListener('push', (evento) => {
  const aviso = { titulo: 'Registro Aberto', corpo: 'Há novidades de quem você segue.', url: '/', ...lerAviso(evento) };

  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.corpo,
      icon: '/icone-192.png',
      badge: '/icone-192.png',
      tag: 'novidades',
      lang: 'pt-BR',
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url ?? '/', self.location.origin).href;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((janela) => new URL(janela.url).origin === self.location.origin);
      if (aberta) return aberta.navigate(destino).then((janela) => (janela ?? aberta).focus());
      return self.clients.openWindow(destino);
    }),
  );
});

/** O JSON do aviso, ou nada se o corpo não puder ser lido: aí fica o texto padrão. */
function lerAviso(evento) {
  try {
    return evento.data?.json() ?? {};
  } catch {
    return {};
  }
}
