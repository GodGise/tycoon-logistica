/* Tycoon Logistica – service worker: riceve le notifiche anche a gioco chiuso.
   Non salva niente in cache: il gioco si carica sempre dalla rete (così gli aggiornamenti arrivano subito). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = { titolo: 'Tycoon Logistica', testo: 'La tua azienda ti aspetta.' };
  try { d = Object.assign(d, e.data.json()); } catch (err) { /* testo semplice */ }
  e.waitUntil(self.registration.showNotification(d.titolo, {
    body: d.testo, icon: 'img/icona-192.png', badge: 'img/icona-192.png', tag: 'tycoon', renotify: true,
  }));
});

// tocchi la notifica: si apre il gioco (o torna in primo piano se è già aperto)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const aperto = lista.find(c => c.url.includes(self.registration.scope));
    return aperto ? aperto.focus() : self.clients.openWindow('./');
  }));
});
