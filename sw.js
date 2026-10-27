/* Vistoria Efficace — service worker: abre sem internet e serve as fotos guardadas no celular. */
var VERSAO = "ve-v2";
var NUCLEO = ["./", "index.html", "runtime.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "vendor/jszip.min.js", "vendor/pdf.min.js", "vendor/pdf.worker.min.js"];
self.addEventListener("install", function(e){ e.waitUntil(caches.open(VERSAO).then(function(c){ return c.addAll(NUCLEO); }).then(function(){ return self.skipWaiting(); })); });
self.addEventListener("activate", function(e){ e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k !== VERSAO && k.indexOf("ve-") === 0; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
function lerBlob(id){
  return new Promise(function(res){
    var rq = indexedDB.open("vistoria-efficace-local", 1);
    rq.onupgradeneeded = function(){ var d = rq.result; if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs"); if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs"); };
    rq.onsuccess = function(){ try { var g = rq.result.transaction("blobs","readonly").objectStore("blobs").get(id); g.onsuccess = function(){ res(g.result || null); }; g.onerror = function(){ res(null); }; } catch(e){ res(null); } };
    rq.onerror = function(){ res(null); };
  });
}
self.addEventListener("fetch", function(e){
  var u = new URL(e.request.url);
  var m = /\/_blob\/([0-9a-f]+)$/.exec(u.pathname);
  if (m){ e.respondWith(lerBlob(m[1]).then(function(r){ return r ? new Response(r.blob, {headers:{"Content-Type": r.type || "application/octet-stream", "Cache-Control":"no-store"}}) : new Response("", {status:404}); })); return; }
  if (e.request.method !== "GET") return;
  if (/\/video\//.test(u.pathname)) return;
  if (u.origin === location.origin){
    if (e.request.mode === "navigate" || /index\.html$|\/$/.test(u.pathname)){
      e.respondWith(fetch(e.request).then(function(r){ var c = r.clone(); caches.open(VERSAO).then(function(ca){ ca.put("index.html", c); }); return r; }).catch(function(){ return caches.match("index.html"); }));
      return;
    }
    e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request).then(function(n){ var c = n.clone(); caches.open(VERSAO).then(function(ca){ ca.put(e.request, c); }); return n; }); }));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request).then(function(n){ var c = n.clone(); caches.open(VERSAO).then(function(ca){ ca.put(e.request, c); }); return n; }); }));
  }
});
