var CACHE_NAME = "mapalaraiz-pwa-v36";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./style.css",
  "./leaflet.css",
  "./leaflet.js",
  "./logo.jfif",
  "./pizarron.png",
  "./camposfiltrados.geojson",
  "./localidades_la_plata.geojson",
  "./localidades_limites_lineas.geojson",
  "./municipios_boundaries.geojson",
  "./recorridos_lp.geojson",
  "./Los_porteños.geojson",
  "./El_Rincon.geojson",
  "./Ignacio_correas.geojson",
  "./Villa_castells.geojson",
  "./Villa_Garibaldi.geojson",
  "./emergency_popup.css",
  "./simple_popup.css",
  "./CalibriCustom.TTF",
  "./CooperBlackCustom.otf",
  "./qrcode.min.js",
  "./enhancements.js"
];

function isCacheableResponse(res){
  return !!res && (res.ok || res.type === "opaque");
}

function getPathname(req){
  try{
    return new URL(req.url).pathname || "";
  }catch(e){
    return "";
  }
}

function isSameOrigin(req){
  try{
    return new URL(req.url).origin === self.location.origin;
  }catch(e){
    return false;
  }
}

function isAppShellPath(pathname){
  return pathname === "/" ||
    pathname.endsWith("/index.html") ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".webmanifest");
}

function isDataPath(pathname){
  return pathname.endsWith(".geojson") || pathname.endsWith(".json");
}

function isStaticMediaPath(pathname){
  return /\.(?:png|jpe?g|gif|svg|webp|woff2?|ttf|otf)$/i.test(pathname);
}

function putInCache(req, res){
  if(!isCacheableResponse(res)) return Promise.resolve();
  return caches.open(CACHE_NAME).then(function(cache){
    return cache.put(req, res.clone());
  });
}

function networkFirst(req, fallbackKey){
  return fetch(new Request(req.url, { cache: "no-store" })).then(function(res){
    putInCache(req, res);
    return res;
  }).catch(function(){
    return caches.match(req).then(function(cached){
      if(cached) return cached;
      if(!fallbackKey) return Promise.reject(new Error("cache-miss"));
      return caches.match(fallbackKey);
    });
  });
}

function staleWhileRevalidate(req){
  return caches.match(req).then(function(cached){
    var network = fetch(req).then(function(res){
      putInCache(req, res);
      return res;
    }).catch(function(){
      return cached || Promise.reject(new Error("network-failed"));
    });
    return cached || network;
  });
}

function cacheFirst(req, fallbackKey){
  return caches.match(req).then(function(cached){
    if(cached) return cached;
    return fetch(req).then(function(res){
      putInCache(req, res);
      return res;
    }).catch(function(){
      if(!fallbackKey) return Promise.reject(new Error("cache-miss"));
      return caches.match(fallbackKey);
    });
  });
}

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      var reqs = CORE_ASSETS.map(function(url){
        try{
          return new Request(url, { cache: "reload" });
        }catch(e){
          return url;
        }
      });
      return cache.addAll(reqs);
    })
  );
  try{ self.skipWaiting(); }catch(e){}
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== CACHE_NAME){
          return caches.delete(key);
        }
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function(event){
  try{
    if(event && event.data && event.data.type === "SKIP_WAITING"){
      self.skipWaiting();
    }
  }catch(e){}
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(!req || req.method !== "GET") return;

  var pathname = getPathname(req);
  var sameOrigin = isSameOrigin(req);

  if(req.mode === "navigate"){
    event.respondWith(networkFirst(req, "./index.html"));
    return;
  }

  if(sameOrigin && (isAppShellPath(pathname) || isDataPath(pathname))){
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if((sameOrigin && isStaticMediaPath(pathname)) || req.destination === "image" || req.destination === "font"){
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if(req.destination === "script" || req.destination === "style"){
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});
