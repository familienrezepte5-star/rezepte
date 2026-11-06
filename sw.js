// Service Worker: App-Hülle und Bilder werden zwischengespeichert, damit die App auch ohne Netz startet.
// Rezepte selbst speichert die App in localStorage (Stand des letzten Ladens).
const SHELL = "rezepte-shell-v20";
const IMG = "rezepte-img-v1";
const SHELL_FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Seite: erst Netz (damit Updates ankommen), sonst Zwischenspeicher
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put("index.html", copy)); return res; })
      .catch(() => caches.match("index.html").then((r) => r || caches.match("./"))));
    return;
  }
  // Bilder: aus dem Zwischenspeicher, im Hintergrund aktualisieren
  if (req.destination === "image") {
    e.respondWith(caches.open(IMG).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) { c.put(req, res.clone()).then(() => trim(c, 400)); } return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // Rest der eigenen Dateien (Icons, Manifest): Zwischenspeicher zuerst
  if (url.origin === location.origin && !url.pathname.includes("/r/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
