
const FILES = {"index.html":{"parts":[{"path":"payload/0000-000.bin","size":8388608,"sha256":"3fffb8c0ae1399586b40133a2008c7c958590357699d0973e47a9f80bf9ae6e0"},{"path":"payload/0000-001.bin","size":8388608,"sha256":"03086419b346062a98f8868bb8740ccccf9ddd099ad910c1cba846eed61a7c90"},{"path":"payload/0000-002.bin","size":69853,"sha256":"f8c687020cac8efb5bb37051040eded8232b06d8a70ac838e474df1ba83523eb"}],"size":16847069,"type":"text/html","sha256":"e53d04593a8f3ed95115d872c19f19ac1bbdc9cbf00a70c99d3cef2eaeb280a2"},"game.html":{"parts":[{"path":"payload/0001-000.bin","size":8388608,"sha256":"188d0972717be4e621f3e467deb4e04663cb19857f5c1970c8ebb0ddd7f5e175"},{"path":"payload/0001-001.bin","size":8388608,"sha256":"8c2d68e26e6fe9d95ffeea8c1787a305ff7017cbf1256df897ab0f9696fce3f1"},{"path":"payload/0001-002.bin","size":8388608,"sha256":"8d6bb81f11f6f2756f8b07630d9d8c5d282f58ee079de471b2486f0da6ec1089"},{"path":"payload/0001-003.bin","size":8388608,"sha256":"39d33eb7171b8dc4a208c9e82b58ae636672c9b1883c09f58d4537e47bde1ab3"},{"path":"payload/0001-004.bin","size":8388608,"sha256":"cc51cc1fb637607af43a8f4d425f42ff5f74cc78d25875060fd5c52f4ae2cd1f"},{"path":"payload/0001-005.bin","size":8388608,"sha256":"90330101848e37f47b556b26b2cbeedf7df93dfd5beb8fbb24c5369a5d44da40"},{"path":"payload/0001-006.bin","size":8388608,"sha256":"e676c7c33bcf60c14d2eb0219004a8da0089693d4a1276bb2901fda067323a0f"},{"path":"payload/0001-007.bin","size":8388608,"sha256":"7103b0ffa6fe02c8ac28f05c5d81a7abd629b98c1ad4fd9f106dff916607b5ca"},{"path":"payload/0001-008.bin","size":8388608,"sha256":"45c3ad942bbe3aebbda972eee8fe5a339b8e7328897ac56538eb1a0aecf1dea4"},{"path":"payload/0001-009.bin","size":3925881,"sha256":"7be456d29bf3744e2e70eb4166373788b0365b22e14e24327b0eb752f754e3dd"}],"size":79423353,"type":"text/html","sha256":"b152d2d57a293d94dcf903849ed335b8fbb5827eb8cecd64a9f9b0b786546a2c"},"browser-account.js":{"parts":[{"path":"payload/0002-000.bin","size":8132,"sha256":"69f161c6882a0d24b356a2943f4b58f16a2eb182f615b6253053dfb36357d461"}],"size":8132,"type":"text/javascript","sha256":"69f161c6882a0d24b356a2943f4b58f16a2eb182f615b6253053dfb36357d461"},"relay-config.js":{"parts":[{"path":"payload/0003-000.bin","size":5066,"sha256":"dc52fa08c934b5ab636ca58af7fd059af120ce2e8a9bfe95ac1d849d6cd3eec6"}],"size":5066,"type":"text/javascript","sha256":"dc52fa08c934b5ab636ca58af7fd059af120ce2e8a9bfe95ac1d849d6cd3eec6"}};
const SOURCE = "https://kn0tzer.work.gd/game-source/eaglercraft/";
const ROOT = "/gh/Kn0tzer/gd.html@main/eaglercraft/";
const HOSTS = ["cdn.jsdelivr.net", "gcore.jsdelivr.net", "fastly.jsdelivr.net", "jsdelivr.b-cdn.net"];
const CACHE = "game-delivery-eaglercraft-8279143dfcbc1c6f";
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
