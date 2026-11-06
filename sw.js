// Minimaler Service Worker: macht die Seite als App installierbar.
// Er speichert nichts zwischen, die App braucht daher Internet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
