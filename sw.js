// sw.js (Pixology) - Network-first to avoid stale Firebase config / admin panels
const VERSION = "2026-02-07-v2";
const CACHE_NAME = `pixology-cache-${VERSION}`;

// Files to cache for offline fallback (keep small to avoid staleness issues)
const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./admin.html",
  "./admin.css",
  "./register.html",
  "./register.css",
  "./firebase.js",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // remove old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) =>
          k !== CACHE_NAME ? caches.delete(k) : Promise.resolve(),
        ),
      );
      await self.clients.claim();
    })(),
  );
});

// Helper: decide request type
function isHTML(req) {
  return (
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html")
  );
}
function isStaticJSorCSS(url) {
  return url.pathname.endsWith(".js") || url.pathname.endsWith(".css");
}
function isImage(url) {
  return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML/JS/CSS to avoid stale app code across devices
  if (isHTML(req) || isStaticJSorCSS(url)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          // Update cache copy
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch (e) {
          // fallback to cache
          const cached = await caches.match(req);
          if (cached) return cached;
          // last resort: for navigation fall back to index
          if (isHTML(req))
            return (await caches.match("./index.html")) || Response.error();
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Cache-first for images
  if (isImage(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone()).catch(() => {});
        return res;
      })(),
    );
    return;
  }
});
