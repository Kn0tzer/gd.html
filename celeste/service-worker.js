
const FILES = {"index.html":{"parts":[{"path":"payload/0000-000.bin","size":8388608,"sha256":"3fffb8c0ae1399586b40133a2008c7c958590357699d0973e47a9f80bf9ae6e0"},{"path":"payload/0000-001.bin","size":8388608,"sha256":"03086419b346062a98f8868bb8740ccccf9ddd099ad910c1cba846eed61a7c90"},{"path":"payload/0000-002.bin","size":69867,"sha256":"5d218fcc49d2465654619f83e5edbdcb36af3148a2f43695a5063bc5a375b35c"}],"size":16847083,"type":"text/html","sha256":"17f5b1094d9371b8a7c9d62575132877246aa58a13ed8506faec167c448a4b62"},"game.html":{"parts":[{"path":"payload/0001-000.bin","size":876,"sha256":"c13465be1a5a66388aacbd27ac073a1b437c1f62839436ec91e21517111dbc37"}],"size":876,"type":"text/html","sha256":"c13465be1a5a66388aacbd27ac073a1b437c1f62839436ec91e21517111dbc37"}};
const SOURCE = "https://kn0tzer.work.gd/game-source/celeste/";
const ROOT = "/gh/Kn0tzer/gd.html@main/celeste/";
const HOSTS = ["cdn.jsdelivr.net", "gcore.jsdelivr.net", "fastly.jsdelivr.net", "jsdelivr.b-cdn.net"];
const CACHE = "game-delivery-celeste-8279143dfcbc1c6f";
const SCOPE = self.registration.scope;
let preferred = new URL(SCOPE).hostname;
const hex = bytes => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
async function notify(loaded, total, file) {
 for (const client of await self.clients.matchAll({includeUncontrolled:true})) client.postMessage({type:'game-loading',loaded,total,file});
}
async function part(info) {
 let last;
 const order = HOSTS.includes(preferred) ? [preferred,...HOSTS.filter(h=>h!==preferred)] : HOSTS;
 for (const host of order) {
  try {
   const response = await fetch('https://'+host+ROOT+info.path, {credentials:'omit',signal:AbortSignal.timeout(60000)});
   if (!response.ok) throw Error('HTTP '+response.status);
   const bytes = await response.arrayBuffer();
   if (bytes.byteLength !== info.size || hex(await crypto.subtle.digest('SHA-256', bytes)) !== info.sha256) throw Error('File verification failed');
   preferred = host;
   return bytes;
  } catch (error) { last=error; }
 }
 throw Error('All download mirrors failed: '+last.message);
}
async function file(path, request) {
 const info=FILES[path];
 if (!info) return new Response('File not found', {status:404});
 const cache=await caches.open(CACHE), key=SCOPE+path;
 let response=await cache.match(key);
 if (!response) {
  try {
   const direct=await fetch(SOURCE+path,{credentials:'omit',cache:'no-cache',signal:AbortSignal.timeout(30000)});
   if(!direct.ok)throw Error('HTTP '+direct.status);
   const bytes=await direct.arrayBuffer();
   if(bytes.byteLength!==info.size || hex(await crypto.subtle.digest('SHA-256',bytes))!==info.sha256)throw Error('Server file differs from this release');
   const headers=new Headers(direct.headers);headers.set('Content-Type',info.type);
   headers.delete('Content-Encoding');headers.set('Content-Length',String(bytes.byteLength));
   headers.set('Cross-Origin-Opener-Policy','same-origin');headers.set('Cross-Origin-Embedder-Policy','require-corp');headers.set('Cross-Origin-Resource-Policy','cross-origin');
   response=new Response(bytes,{headers});
   await notify(info.size,info.size,path);
  } catch(error) { console.info('Direct source unavailable; trying CDN mirrors',path,error.message); }
  if(!response){
  const pieces=[]; let loaded=0;
  await notify(0,info.size,path);
  for (const chunk of info.parts) { const data=await part(chunk);pieces.push(data);loaded+=data.byteLength;await notify(loaded,info.size,path); }
  if (loaded!==info.size) throw Error('Incomplete game file');
  response=new Response(new Blob(pieces,{type:info.type}),{headers:{
   'Content-Type':info.type,'Content-Length':String(loaded),
   'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp',
   'Cross-Origin-Resource-Policy':'cross-origin','Cache-Control':'no-cache'
  }});
  }
  try { await cache.put(key,response.clone()); } catch (error) { console.warn('Game cache unavailable',error); }
 }
 const range=request.headers.get('Range');
 if (range) {
  const match=/^bytes=(\d+)-(\d*)$/.exec(range);
  if (match) {
   const data=await response.arrayBuffer(), start=Number(match[1]), end=match[2]?Math.min(Number(match[2]),data.byteLength-1):data.byteLength-1;
   if (start>end || start>=data.byteLength) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+data.byteLength}});
   const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${data.byteLength}`);headers.set('Content-Length',String(end-start+1));
   return new Response(data.slice(start,end+1),{status:206,headers});
  }
 }
 return response;
}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if (request.method!=='GET' || !request.url.startsWith(SCOPE)) return;
 let path=new URL(request.url).pathname.slice(new URL(SCOPE).pathname.length);
 if (path==='sw.js' || path==='service-worker.js' || path.startsWith('payload/')) return;
 if (request.mode==='navigate' && (!path || path.endsWith('.svg'))) path='index.html';
 event.respondWith(file(path,request).catch(error=>new Response('Game download failed. Reload to retry. '+error.message,{status:502,headers:{'Content-Type':'text/plain'}})));
});
