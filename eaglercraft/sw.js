// Eaglercraft 26.3 (WASM-GC) on jsDelivr.
// The client is a single ~80 MB HTML file, too big for jsDelivr, so this
// worker serves it from kn0tzer.work.gd at the eaglercraft.svg URL, adding
// the cross-origin isolation headers the client expects. Every other request
// in scope (browser-account.js, relay-config.js, ...) is proxied the same way,
// so updates to the server's build show up here without a new commit.

const BUILD_ORIGIN = "https://kn0tzer.work.gd/eag/";
const SCOPE = self.registration.scope;

const TYPES = { html: "text/html; charset=utf-8", js: "text/javascript" };

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

// no-cache revalidates against the server's ETag, so an unchanged client
// costs a 304 instead of a full download.
async function fromBuild(path, search) {
	const res = await fetch(BUILD_ORIGIN + path + search, {
		mode: "cors",
		credentials: "omit",
		cache: "no-cache",
	});
	return isolate(res, path);
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET" || !request.url.startsWith(SCOPE)) return;
	const url = new URL(request.url);
	const path = url.pathname.slice(new URL(SCOPE).pathname.length);
	if (path === "sw.js") return;

	if (request.mode === "navigate" && path.endsWith(".svg")) {
		event.respondWith(fromBuild("index.html", ""));
		return;
	}
	event.respondWith(fromBuild(path, url.search));
});
