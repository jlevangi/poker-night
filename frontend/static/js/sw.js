const APP_VERSION = '1.0.7'; // Increment this version whenever making substantial changes
const CACHE_NAME = `gamble-king-cache-v${APP_VERSION}`;

// Assets that should be cached for offline use
const URLS_TO_CACHE = [
    '/',
    '/static/css/styles/main.css',
    '/static/js/app.js',
    '/static/js/config.js',
    '/static/images/icon-192x192.png',
    '/static/images/icon-512x512.png',
    '/manifest.json',
    // Add other important static assets if any
];

// Install event: Cache core assets
self.addEventListener('install', event => {
    console.log(`Service worker v${APP_VERSION} installing...`);
    
    // Immediately take control of all clients
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(URLS_TO_CACHE);
            })
            .catch(error => {
                console.error('Failed to cache assets:', error);
            })
    );
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

// Add message event handler for update requests
self.addEventListener('message', event => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        // This triggers the service worker to activate immediately
        console.log('Skip waiting and activate immediately');
        self.skipWaiting();
    }
    
    if (event.data.type === 'CHECK_VERSION') {
        // Report back if versions don't match
        if (event.data.version !== APP_VERSION) {
            console.log(`Version mismatch: SW=${APP_VERSION}, Client=${event.data.version}`);
            // Notify the client about the version mismatch
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NEW_VERSION',
                        version: APP_VERSION
                    });
                });
            });
        } else {
            console.log('Versions match, no update needed');
        }
    }
});