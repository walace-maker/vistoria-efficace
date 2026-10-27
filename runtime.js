/* Vistoria Efficace — armazenamento local (IndexedDB) com a mesma interface usada pelo app.
   Documentos: store "docs" (chave = caminho, ex.: "vistorias/abc"). Arquivos: store "blobs" (servidos em _blob/<id> pelo service worker). */
(function(){
  "use strict";
  var DBN = "vistoria-efficace-local", VER = 1, idb = null;
  function abrir(){
    return new Promise(function(res, rej){
      var rq = indexedDB.open(DBN, VER);
      rq.onupgradeneeded = function(){ var d = rq.result; if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs"); if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs"); };
      rq.onsuccess = function(){ res(rq.result); }; rq.onerror = function(){ rej(rq.error); };
    });
  }
  function tx(store, modo, fn){
    return new Promise(function(res, rej){
      var t = idb.transaction(store, modo), st = t.objectStore(store), r = fn(st);
      t.oncomplete = function(){ res(r && "result" in r ? r.result : undefined); };
      t.onerror = t.onabort = function(){ rej(t.error || new Error("idb")); };
    });
  }
  var docs = new Map(), subs = [];
  function clone(o){ return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function rid(n){ var a = new Uint8Array(n||10); crypto.getRandomValues(a); return Array.prototype.map.call(a, function(b){ return b.toString(16).padStart(2,"0"); }).join(""); }
  function filhos(col){ var pre = col + "/", out = []; docs.forEach(function(v, k){ if (k.indexOf(pre) === 0 && k.slice(pre.length).indexOf("/") < 0) out.push(k); }); return out; }
  function snapDoc(k){ return { id: k.split("/").pop(), exists: docs.has(k), data: function(){ return clone(docs.get(k)); } }; }
  var agendado = false;
  function avisar(){ if (agendado) return; agendado = true; setTimeout(function(){ agendado = false; subs.slice().forEach(function(s){ try { s(); } catch(e){ console.error(e); } }); }, 0); }
  async function gravar(k, v){ if (v === undefined){ docs.delete(k); await tx("docs","readwrite",function(st){ return st.delete(k); }); } else { docs.set(k, v); await tx("docs","readwrite",function(st){ return st.put(v, k); }); } avisar(); }
  function consulta(col, ord){
    function lista(){ var ks = filhos(col).map(snapDoc); if (ord) ks.sort(function(a,b){ var x = (a.data()||{})[ord.f], y = (b.data()||{})[ord.f]; return (x>y?1:x<y?-1:0) * (ord.dir === "desc" ? -1 : 1); }); return ks; }
    return {
      orderBy: function(f, dir){ return consulta(col, {f:f, dir:dir||"asc"}); },
      get: async function(){ return { docs: lista() }; },
      onSnapshot: function(cb){ var fn = function(){ cb({ docs: lista() }); }; subs.push(fn); setTimeout(fn, 0); return function(){ var i = subs.indexOf(fn); if (i >= 0) subs.splice(i,1); }; },
      add: async function(o){ var id = rid(10); await gravar(col+"/"+id, clone(o)); return { id: id }; },
      doc: function(id){ return refDoc(col+"/"+id); }
    };
  }
  function refDoc(k){ return {
    get: async function(){ return snapDoc(k); },
    set: async function(o){ await gravar(k, clone(o)); },
    update: async function(o){ if (!docs.has(k)) throw {code:"not_found"}; await gravar(k, Object.assign(clone(docs.get(k)), clone(o))); },
    delete: async function(){ await gravar(k, undefined); },
    onSnapshot: function(cb){ var fn = function(){ cb(snapDoc(k)); }; subs.push(fn); setTimeout(fn, 0); return function(){ var i = subs.indexOf(fn); if (i >= 0) subs.splice(i,1); }; }
  }; }
  var db = { collection: function(c){ return consulta(c); }, doc: function(k){ return refDoc(k); } };
  var assets = {
    upload: async function(blob, opt){ var id = rid(16); var tipo = (opt && opt.type) || blob.type || "application/octet-stream"; var b = blob.type === tipo ? blob : new Blob([blob], {type: tipo}); await tx("blobs","readwrite",function(st){ return st.put({blob: b, type: tipo, size: b.size, t: Date.now()}, id); }); return { id: id, url: "_blob/"+id, sizeBytes: b.size, contentType: tipo }; },
    delete: async function(id){ await tx("blobs","readwrite",function(st){ return st.delete(id); }); },
    get: async function(id){ var r = await tx("blobs","readonly",function(st){ return st.get(id); }); return r ? r.blob : null; },
    list: async function(){ var est = {}; try { est = await navigator.storage.estimate(); } catch(e){} var n = await tx("blobs","readonly",function(st){ return st.count(); }); return { assets: [], usage: { bytes: est.usage || 0, maxBytes: est.quota || 0, files: n, maxFiles: 0 } }; }
  };
  var downloads = { save: async function(o){
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
    try { var f = new File([blob], o.filename, {type: blob.type || "application/octet-stream"}); if (navigator.canShare && navigator.canShare({files:[f]}) && /iPhone|iPad|Android/i.test(navigator.userAgent)){ await navigator.share({files:[f], title:o.filename}); return "saved"; } }
    catch(e){ if (e && e.name === "AbortError") throw {code:"declined"}; }
    var url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = o.filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 60000); return "saved";
  } };
  var pronto = (async function(){
    idb = await abrir();
    await new Promise(function(res, rej){ var t = idb.transaction("docs","readonly"), st = t.objectStore("docs"), c = st.openCursor(); c.onsuccess = function(){ var cur = c.result; if (cur){ docs.set(cur.key, cur.value); cur.continue(); } }; t.oncomplete = res; t.onerror = function(){ rej(t.error); }; });
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch(e){}
  })();
  window.EFFICACE_LOCAL = { assets: assets, db: db, pronto: pronto };
  window.claude = { use: async function(n){ await pronto; return ({db: db, assets: assets, downloads: downloads})[n] || null; } };
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").then(function(){
      if (!navigator.serviceWorker.controller){ navigator.serviceWorker.addEventListener("controllerchange", function(){ if (!sessionStorage.getItem("sw-recarregou")){ sessionStorage.setItem("sw-recarregou","1"); location.reload(); } }); }
    }).catch(function(e){ console.warn("SW", e); });
  }
})();
