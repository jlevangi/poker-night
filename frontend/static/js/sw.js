const APP_VERSION = '1.0.1'; // Increment this version whenever making substantial changes
const CACHE_NAME = `gamble-king-cache-v${APP_VERSION}`;
const URLS_TO_CACHE = [
    '/',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/images/icon-192x192.png',
    '/static/images/icon-512x512.png',
    '/manifest.json',
    // Add other important static assets if any
];

// Install event: Cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
    self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

// Activate event: Clean up old caches and take immediate control
self.addEventListener('activate', event => {
    console.log(`Service worker v${APP_VERSION} activating...`);
    
    // Delete all old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log(`Service worker v${APP_VERSION} now active and controlling all clients`);
            // Send a message to all clients that a new version is available
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NEW_VERSION',
                        version: APP_VERSION
                    });
                });
            });
        })
    );
    
    // Take control of all open clients immediately 
    return self.clients.claim();
});

// Fetch event: Serve cached content when offline, or fetch from network
self.addEventListener('fetch', event => {
    // For API calls, always go to network first, then fallback or handle error
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Optionally, return a generic JSON error or a specific offline response
                return new Response(JSON.stringify({ error: "Offline or network issue" }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }
    
    // Add network-first strategy for HTML and JSON to ensure latest content
    if (event.request.url.endsWith('.html') || 
        event.request.url.endsWith('.json') ||
        event.request.headers.get('accept').includes('text/html')) {
        
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Clone the response and save it to cache
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    // If network fails, try serving from cache
                    return caches.match(event.request);
                })
        );
        return;
    }// For other requests (static assets, HTML page)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Special handling for root path or navigation requests
                if (event.request.url.endsWith('/') || event.request.mode === 'navigate') {
                    return fetch(event.request).catch(error => {
                        return caches.match('/');
                    });
                }
                
                // Not in cache - fetch from network, then cache it
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        // IMPORTANT: Clone the response. A response is a stream
                        // and because we want the browser to consume the response
                        // as well as the cache consuming the response, we need
                        // to clone it so we have two streams.
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('Fetching failed:', error);
                    // You might want to return a fallback offline page here for HTML requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            })
    );
});