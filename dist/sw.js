const CACHE_NAME = 'pwa-pdf-cache-v4';
const DYNAMIC_CACHE = 'dynamic-cache-v1';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './pdf.worker.min.mjs',
  './assets/main-*.js',
  './assets/vendor-*.js',
  './assets/pdf-*.js',
  './assets/xlsx-*.js',
  './assets/index-*.css'
];

// File types to cache
const CACHEABLE_TYPES = [
  'application/json',
  'application/javascript',
  'text/css',
  'text/html',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel files
  'image/png',
  'image/jpeg',
  'image/svg+xml'
];

// Helper function to handle failed requests
const handleFetchError = (error) => {
  console.error('Fetch failed:', error);
  return new Response(
    JSON.stringify({
      error: 'Network request failed',
      message: 'The application is currently offline'
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};

function isDevMode() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

// Helper to determine if a request should be cached
function shouldCache(request) {
  // Don't cache POST requests
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  
  // Don't cache query parameters except version
  if (url.search && !url.search.match(/^\?v=\d+$/)) return false;

  // Cache specific file types
  const contentType = request.headers.get('content-type');
  if (contentType) {
    return CACHEABLE_TYPES.some(type => contentType.includes(type));
  }

  // Cache specific paths
  return url.pathname.match(/\.(js|css|html|pdf|xlsx?|png|jpe?g|svg|json)$/i);
}

// Helper to store binary data in IndexedDB
async function storeInIndexedDB(key, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('offline-storage', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const storeRequest = store.put({ id: key, data: data });
      storeRequest.onsuccess = () => resolve();
      storeRequest.onerror = () => reject(storeRequest.error);
    };
  });
}

// Helper to retrieve binary data from IndexedDB
async function getFromIndexedDB(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('offline-storage', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const getRequest = store.get(key);
      getRequest.onsuccess = () => resolve(getRequest.result?.data);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  
  if (isDevMode()) return;

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        const urlsToInstall = urlsToCache.filter(url => 
          !url.includes('*') && !url.includes('?v=')
        );
        return cache.addAll(urlsToInstall);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());

  if (isDevMode()) {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME, DYNAMIC_CACHE].includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isDevMode()) {
    event.respondWith(
      fetch(event.request)
        .catch(handleFetchError)
    );
    return;
  }

  // Handle signature data
  if (event.request.url.includes('/signatures/')) {
    event.respondWith(
      getFromIndexedDB(event.request.url)
        .then(data => {
          if (data) {
            return new Response(data, {
              headers: { 'Content-Type': 'image/png' }
            });
          }
          return fetch(event.request);
        })
        .catch(() => fetch(event.request))
    );
    return;
  }

  // Handle PDF and Excel files
  if (event.request.url.match(/\.(pdf|xlsx?)$/i)) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }

          return fetch(event.request.clone())
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }

              const responseToCache = response.clone();
              
              // Store in both cache and IndexedDB for redundancy
              Promise.all([
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(event.request, responseToCache.clone())),
                response.blob()
                  .then(blob => storeInIndexedDB(event.request.url, blob))
              ]).catch(console.error);

              return response;
            })
            .catch(() => {
              // Try IndexedDB as fallback
              return getFromIndexedDB(event.request.url)
                .then(data => {
                  if (data) {
                    return new Response(data, {
                      headers: {
                        'Content-Type': event.request.url.endsWith('pdf') 
                          ? 'application/pdf'
                          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      }
                    });
                  }
                  throw new Error('No offline data available');
                })
                .catch(handleFetchError);
            });
        })
    );
    return;
  }

  // Handle other requests
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request.clone())
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            if (shouldCache(event.request)) {
              const responseToCache = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }

            return response;
          })
          .catch(handleFetchError);
      })
  );
}); 