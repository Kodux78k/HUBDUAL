/* service-worker.js
 *
 * Esta versão implementa o padrão de cache ideal para uma aplicação
 * com vídeos e imagens. O pré-cache inclui o HTML, manifest,
 * posters estáticos e alguns loops críticos de vídeo. Para conteúdo
 * navegacional usamos a estratégia network-first com fallback ao cache
 * em caso de offline. Para mídia utilizamos stale-while-revalidate
 * garantindo que o usuário veja algo rapidamente e o arquivo seja
 * atualizado em segundo plano.
 */

const SW_VERSION = 'v1.0.0-dual';
const PRECACHE = `precache-${SW_VERSION}`;
const RUNTIME = `runtime-${SW_VERSION}`;

/* Liste aqui os essenciais pro primeiro paint */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  /* Posters e pílula (versões PNG) */
  '/assets/animations/animado/hub_splash.png',
  '/assets/animations/animado/hub_home_static.png',
  '/assets/animations/animado/hub_pill_home.png',
  /* Um ou dois loops críticos (os browsers baixam o resto sob demanda) */
  '/assets/animations/animado/hub_splash.mp4',
  '/assets/animations/animado/hub_home_loop.mp4'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== PRECACHE && key !== RUNTIME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

/* Pequeno helper p/ detectar mídia */
const isMedia = (url) => /(\.webm|\.mp4|\.mov|\.gif|\.png|\.jpe?g|\.webp)(\?|$)/i.test(url);
const isHTML = (req) => req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navegação: Network-first (com fallback a cache/offline)
  if (isHTML(request)) {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        const cache = await caches.open(RUNTIME);
        cache.put(request, net.clone());
        return net;
      } catch (e) {
        const cache = await caches.open(PRECACHE);
        // Always fall back to index.html for navigation
        return (await cache.match('/index.html')) || new Response('offline', { status: 503 });
      }
    })());
    return;
  }

  // Mídia: Stale-While-Revalidate
  if (isMedia(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then((res) => {
        cache.put(request, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise || new Response('', { status: 504 });
    })());
    return;
  }

  // Outras requisições: cache-first com SWR simples
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    const cached = await cache.match(request);
    if (cached) {
      fetch(request).then((res) => cache.put(request, res.clone())).catch(() => {});
      return cached;
    }
    try {
      const net = await fetch(request);
      cache.put(request, net.clone());
      return net;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});