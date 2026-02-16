// Service Worker module for handling PWA functionality
export default class ServiceWorkerManager {
    constructor(version) {
        this.version = version;
    }
    
    // Initialize the service worker
    async initialize() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported in this browser');
            return;
        }
        
        // Add a cache-busting query parameter based on app version
        const swUrl = `/sw.js?v=${this.version}`;
        
        // Auto-reload when a new service worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        try {
            // Register the service worker
            const registration = await navigator.serviceWorker.register(swUrl);
            console.log('Service Worker registered with scope:', registration.scope);

            // Simple update check - no notifications needed
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New service worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New service worker installed');
                    }
                });
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}
