const APP_VERSION = '1.1.0'; // Increment this version whenever making substantial changes
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
    
    // Immediately take control of all clients
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(URLS_TO_CACHE);
            })
            .catch(error => {
                console.error('Failed to cache assets:', error);
            })
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old cache versions
                    if (cacheName.startsWith('gamble-king-cache-') && cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch event: Handle different request types with appropriate caching strategies
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // API calls - Always use network-first strategy for fresh data
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            networkFirstStrategy(event.request)
        );
        return;
    }
    
    // Admin routes - No caching for admin interface
    if (url.pathname.startsWith('/admin/')) {
        event.respondWith(
            fetch(event.request)
        );
        return;
    }
    
    // Navigation requests (HTML pages) - Network first with cache fallback
    if (event.request.mode === 'navigate' || 
        url.pathname === '/' ||
        event.request.headers.get('accept')?.includes('text/html')) {
        
        event.respondWith(
            networkFirstStrategy(event.request)
        );
        return;
    }
    
    // Static assets - Cache first with network fallback and cache update
    if (url.pathname.startsWith('/static/')) {
        event.respondWith(
            staleWhileRevalidate(event.request)
        );
        return;
    }
    
    // Default - Try cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Network-first strategy: Always try network first, cache on failure
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // If successful, update cache with fresh response
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If no cache, return error response for API calls
        if (request.url.includes('/api/')) {
            return new Response(
                JSON.stringify({ error: "Network unavailable and no cached data" }), 
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // For other requests, re-throw error
        throw error;
    }
}

// Stale-while-revalidate strategy: Serve from cache, update in background
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    
    // Get from cache immediately (don't await)
    const cachedResponse = await cache.match(request);
    
    // Start fetch for fresh version (don't await - runs in background)
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    });
    
    // Return cached version immediately if available, otherwise wait for network
    return cachedResponse || fetchPromise;
}

// Push event handler for notifications
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    let notificationData = {};
    
    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (error) {
            console.error('Error parsing push notification data:', error);
            // Use default notification data if parsing fails
            notificationData = {
                title: 'Poker Session Update',
                body: 'A poker session has ended',
                icon: '/static/images/icon-192x192.png'
            };
        }
    } else {
        // Default notification if no data provided
        notificationData = {
            title: 'Poker Session Update',
            body: 'A poker session has ended',
            icon: '/static/images/icon-192x192.png'
        };
    }
    
    // Set default values if not provided
    const options = {
        body: notificationData.body || 'A poker session has ended',
        icon: notificationData.icon || '/static/images/icon-192x192.png',
        badge: '/static/images/icon-192x192.png',
        tag: notificationData.tag || 'poker-session',
        data: notificationData.data || {},
        requireInteraction: false,
        silent: false
    };
    
    // Add action buttons if provided
    if (notificationData.actions) {
        options.actions = notificationData.actions;
    }
    
    const title = notificationData.title || 'Poker Session Ended';
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('Notification click received:', event);
    
    event.notification.close();
    
    // Handle action button clicks
    if (event.action === 'view_results') {
        event.waitUntil(
            clients.openWindow('/#session/' + (event.notification.data.sessionId || ''))
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification (already done above)
        return;
    } else {
        // Default click - open the app
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(clientList => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (clients.openWindow) {
                    const targetUrl = event.notification.data.sessionId 
                        ? `/#session/${event.notification.data.sessionId}`
                        : '/';
                    return clients.openWindow(targetUrl);
                }
            })
        );
    }
});

// Add message event handler for update requests
self.addEventListener('message', event => {
    
    if (event.data.type === 'SKIP_WAITING') {
        // This triggers the service worker to activate immediately
        self.skipWaiting();
    }
    
    if (event.data.type === 'CHECK_VERSION') {
        // Report back if versions don't match
        if (event.data.version !== APP_VERSION) {
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
        }
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        // Clear all caches and notify completion
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                // Notify the client that caches are cleared
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: true });
                }
            })
        );
    }
    
    if (event.data.type === 'FORCE_UPDATE') {
        // Force refresh by clearing cache and reloading
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                // Notify all clients to refresh
                return self.clients.matchAll();
            }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'FORCE_REFRESH'
                    });
                });
            })
        );
    }
});