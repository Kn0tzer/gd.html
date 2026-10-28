// Webleste (Celeste WASM) on jsDelivr.
// The threaded .NET runtime needs SharedArrayBuffer, which needs a
// cross-origin isolated page. jsDelivr can't send COOP/COEP headers, so this
// worker serves the app itself: navigating to celeste.svg returns the app's
// HTML, and every response in scope gets the isolation headers added.
// The large runtime files (_framework/) are pulled from kn0tzer.work.gd.

const RUNTIME_ORIGIN = "https://kn0tzer.work.gd/celeste/";
const CACHE = "webleste-svg-v1";
const SCOPE = self.registration.scope;

const APP_HTML = `<!doctype html>
<html lang="en" bgcolor="black">
	<head>
		<meta charset="UTF-8" />
		<link rel="icon" href="app.webp" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="darkreader-lock" />
		<title>Webleste</title>
		<script>sessionStorage.removeItem("webleste-reloads");</script>
		<script type="module" crossorigin src="./assets/index-CN9Au68P.js"></script>
		<link rel="stylesheet" crossorigin href="./assets/index-C4OZP-O4.css" />
	</head>
	<body>
		<div id="app"></div>
	</body>
</html>`;

const TYPES = {
	js: "text/javascript",
	mjs: "text/javascript",
	css: "text/css",
	wasm: "application/wasm",
	json: "application/json",
	webp: "image/webp",
	woff2: "font/woff2",
	woff: "font/woff",
	ttf: "font/ttf",
};

function isolate(res, path) {
	const headers = new Headers(res.headers);
	headers.set("Cross-Origin-Embedder-Policy", "require-corp");
	headers.set("Cross-Origin-Opener-Policy", "same-origin");
	headers.set("Cross-Origin-Resource-Policy", "cross-origin");
	const type = TYPES[path.split(".").pop()];
	if (type && res.ok) headers.set("Content-Type", type);
	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	});
}

// _framework files are content-hashed (except dotnet.js) and the origin
// sends no-store, so keep them in Cache Storage instead of re-downloading
// ~130 MB on every visit.
async function runtimeFile(path) {
	const cache = await caches.open(CACHE);
	const key = RUNTIME_ORIGIN + path;
	const networkFirst = path === "_framework/dotnet.js";
	if (!networkFirst) {
		const hit = await cache.match(key);
		if (hit) return hit;
	}
	try {
		const res = isolate(
			await fetch(key, { mode: "cors", credentials: "omit", cache: "no-store" }),
			path
		);
		if (res.status === 200) await cache.put(key, res.clone());
		return res;
	} catch (err) {
		const hit = networkFirst && (await cache.match(key));
		if (hit) return hit;
		throw err;
	}
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((k) => k.startsWith("webleste-svg-") && k !== CACHE).map((k) => caches.delete(k))
			);
			await self.clients.claim();
		})()
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET" || !request.url.startsWith(SCOPE)) return;
	const path = request.url.slice(SCOPE.length).split(/[?#]/)[0];
	if (path === "sw.js") return;

	if (request.mode === "navigate" && path.endsWith(".svg")) {
		event.respondWith(
			isolate(new Response(APP_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }), path)
		);
		return;
	}

	if (path.startsWith("_framework/")) {
		event.respondWith(runtimeFile(path));
		return;
	}

	event.respondWith(fetch(request).then((res) => isolate(res, path)));
});
