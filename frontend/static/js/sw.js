// Get version from the service worker URL query parameter (set at registration time)
// This ensures the SW version is locked to when it was installed
const SW_VERSION = new URL(self.location).searchParams.get('v') || '1.0.0';
const CACHE_NAME = `gamble-king-cache-v${SW_VERSION}`;

console.log('Service Worker initialized with version:', SW_VERSION);

// Helper function for backwards compatibility
function getAppVersion() {
    return Promise.resolve(SW_VERSION);
}

// Assets that should be cached for offline use
const URLS_TO_CACHE = [
    '/',
    '/static/css/styles/main.css',
    '/static/js/app.js',
    '/static/js/config.js',
    '/static/js/modules/api-service.js',
    '/static/js/modules/calendar-page.js',
    '/static/js/modules/dark-mode-manager.js',
    '/static/js/modules/dashboard-page.js',
    '/static/js/modules/logger.js',
    '/static/js/modules/modal-manager.js',
    '/static/js/modules/more-menu-manager.js',
    '/static/js/modules/notification-manager.js',
    '/static/js/modules/player-detail-page.js',
    '/static/js/modules/players-page.js',
    '/static/js/modules/router.js',
    '/static/js/modules/service-worker-manager.js',
    '/static/js/modules/session-detail-page.js',
    '/static/js/modules/sessions-page.js',
    '/static/js/modules/settings-manager.js',
    '/static/js/modules/stats-page.js',
    '/static/images/icon-192x192.png',
    '/static/images/icon-512x512.png',
    '/manifest.json',
];

// Install event: Cache core assets
self.addEventListener('install', event => {
    // Immediately take control of all clients
    self.skipWaiting();
    
    event.waitUntil(
        getAppVersion().then(() => {
            return caches.open(CACHE_NAME);
        }).then(cache => {
            return cache.addAll(URLS_TO_CACHE);
        }).catch(error => {
            console.error('Failed to cache assets:', error);
        })
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        getAppVersion().then(() => {
            return caches.keys();
        }).then(cacheNames => {
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

        // Only cache GET requests (Cache API doesn't support PUT/POST/DELETE)
        if (networkResponse.ok && request.method === 'GET') {
            await getAppVersion(); // Ensure we have the cache name
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {

        // Try to get from cache (only works for GET requests)
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
    await getAppVersion(); // Ensure we have the cache name
    const cache = await caches.open(CACHE_NAME);

    // Get from cache immediately (don't await)
    const cachedResponse = await cache.match(request);

    // Start fetch for fresh version (don't await - runs in background)
    const fetchPromise = fetch(request).then(networkResponse => {
        // Only cache GET requests
        if (networkResponse.ok && request.method === 'GET') {
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
        // Compare server version (from client) against installed SW version
        const serverVersion = event.data.version;

        if (serverVersion && serverVersion !== SW_VERSION) {
            console.log(`Version mismatch: Server has ${serverVersion}, SW has ${SW_VERSION}`);

            // Notify the client about the version mismatch
            event.waitUntil(
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'NEW_VERSION',
                            serverVersion: serverVersion,
                            installedVersion: SW_VERSION
                        });
                    });
                })
            );
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