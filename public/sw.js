// Service worker minimo: nessuna cache, solo pass-through.
// Serve unicamente a rendere l'app installabile (Chrome richiede un fetch
// handler per creare la WebAPK), senza rischiare asset obsoleti in sviluppo.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
