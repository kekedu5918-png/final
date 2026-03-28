/* ═══════════════════════════════════════════════════════
   OPJ ELITE — Service Worker v60
   Chemins relatifs pour GitHub Pages (sous-dossier).
   Toutes les URLs sont résolues via self.registration.scope.
   ═══════════════════════════════════════════════════════ */

const CACHE = 'opj-v60';

const STATIC = [
  './',
  './index.html',
  './manifest.json',

  /* CSS */
  './css/tokens.css',
  './css/components.css',
  './css/pages.css',

  /* JS — core (chargés en premier) */
  './js/core/fsrs.js',
  './js/core/audio.js',

  /* JS — app principal */
  './js/app.js',

  /* JS — données */
  './js/data/questions.js',
  './js/data/flashcards.js',
  './js/data/chapters.js',
  './js/data/procedures.js',
  './js/data/annales.js',
  './js/data/printsheets.js',

  /* Icons PWA */
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ── Install : mise en cache des assets statiques ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(
        STATIC.map(rel => {
          const url = new URL(rel, self.registration.scope).href;
          return c.add(url).catch(() => {
            console.warn('[SW] Cache miss (non bloquant):', url);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

/* ── Activate : purge des anciens caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Suppression ancien cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch : cache-first pour les assets, network-first pour Supabase ── */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  /* Ne jamais intercepter les requêtes Supabase ou externes */
  if (url.includes('supabase.co') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.startsWith('chrome-extension') ||
      e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        /* Mettre en cache la réponse pour les prochaines fois */
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        /* Offline fallback : retourner index.html pour les navigations */
        if (e.request.mode === 'navigate') {
          return caches.match(new URL('./index.html', self.registration.scope).href);
        }
      });
    })
  );
});

/* ── Icônes / URL d’ouverture relatives au scope (GitHub Pages / sous-dossier) ── */
function swIcon192() {
  return new URL('icons/icon-192.png', self.registration.scope).href;
}

/* ── Push (serveur ou tests) : affiche une notif locale via le SW ── */
self.addEventListener('push', e => {
  let title = 'OPJ Elite';
  let body = '📚 Ta session quotidienne t\'attend. Maintiens ton streak !';
  let openUrl = self.registration.scope;
  if (e.data) {
    try {
      const j = e.data.json();
      if (j.title) title = j.title;
      if (j.body) body = j.body;
      if (j.url) openUrl = j.url;
    } catch {
      try {
        const t = e.data.text();
        if (t) body = t;
      } catch (_) {}
    }
  }
  const iconHref = swIcon192();
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: iconHref,
      badge: iconHref,
      vibrate: [100, 50, 100],
      data: { url: openUrl },
      tag: 'opj-push'
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const scopeRoot = self.registration.scope.replace(/\/$/, '');
      for (const client of windowClients) {
        if (client.url.startsWith(scopeRoot) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ── Sync en arrière-plan (streak) : rappel générique si le navigateur déclenche la sync ── */
self.addEventListener('sync', event => {
  if (event.tag !== 'streak-check') return;
  const iconHref = swIcon192();
  const openUrl = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification('OPJ Elite', {
      body: '🔥 Pense à ton streak — une session rapide suffit.',
      icon: iconHref,
      badge: iconHref,
      data: { url: openUrl },
      tag: 'streak-sync'
    })
  );
});
