/**
 * Notification Manager for handling push notification subscriptions
 */

export class NotificationManager {
    constructor(apiService) {
        this.apiService = apiService;
        this.vapidPublicKey = 'BMSoOJLhmoSg7mWixBiVedK4KuFBPe98FHEgd21EDihAuZSfHk_UDi3rf2dOp1p4oPmNjv7toMDfEKmmL-GEA3U'; // Generated VAPID application server key
    }

    /**
     * Check if push notifications are supported
     */
    isSupported() {
        return 'Notification' in window && 
               'serviceWorker' in navigator && 
               'PushManager' in window;
    }

    /**
     * Get current notification permission status
     */
    getPermissionStatus() {
        if (!this.isSupported()) {
            return 'unsupported';
        }
        return Notification.permission;
    }

    /**
     * Request notification permission from user
     */
    async requestPermission() {
        if (!this.isSupported()) {
            throw new Error('Push notifications are not supported');
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission === 'denied') {
            throw new Error('Notification permission has been denied');
        }

        const permission = await Notification.requestPermission();
        return permission;
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Subscribe user to push notifications for a specific session
     */
    async subscribeToSession(playerId, sessionId) {
        try {
            // Check support and permission
            if (!this.isSupported()) {
                throw new Error('Push notifications are not supported in this browser');
            }

            const permission = await this.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Notification permission not granted');
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;
            
            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Create new subscription
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
                });
            }

            // Send subscription to server
            const subscriptionData = {
                player_id: playerId,
                session_id: sessionId,
                subscription: {
                    endpoint: subscription.endpoint,
                    keys: {
                        auth: this.arrayBufferToBase64(subscription.getKey('auth')),
                        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh'))
                    }
                }
            };

            const response = await this.apiService.post('notifications/subscribe', subscriptionData);
            
            if (response.error) {
                throw new Error(response.error);
            }

            console.log('Successfully subscribed to notifications for session:', sessionId);
            return { success: true, message: 'Successfully subscribed to notifications' };

        } catch (error) {
            console.error('Error subscribing to notifications:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe user from push notifications for a specific session
     */
    async unsubscribeFromSession(playerId, sessionId) {
        try {
            const unsubscribeData = {
                player_id: playerId,
                session_id: sessionId
            };

            const response = await this.apiService.post('notifications/unsubscribe', unsubscribeData);
            
            if (response.error) {
                throw new Error(response.error);
            }

            console.log('Successfully unsubscribed from notifications for session:', sessionId);
            return { success: true, message: 'Successfully unsubscribed from notifications' };

        } catch (error) {
            console.error('Error unsubscribing from notifications:', error);
            throw error;
        }
    }

    /**
     * Get all active subscriptions for a player
     */
    async getPlayerSubscriptions(playerId) {
        try {
            const response = await this.apiService.get(`notifications/subscriptions/${playerId}`);
            return response;
        } catch (error) {
            console.error('Error fetching player subscriptions:', error);
            throw error;
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return window.btoa(binary);
    }

    /**
     * Check if user is subscribed to a specific session
     */
    async isSubscribedToSession(playerId, sessionId) {
        try {
            const subscriptions = await this.getPlayerSubscriptions(playerId);
            return subscriptions.some(sub => sub.session_id === sessionId && sub.is_active);
        } catch (error) {
            console.error('Error checking subscription status:', error);
            return false;
        }
    }

    /**
     * Show notification permission UI
     */
    showPermissionUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const permissionStatus = this.getPermissionStatus();
        
        if (permissionStatus === 'unsupported') {
            container.innerHTML = `<span class="notification-permission-unsupported">Notifications not supported</span>`;
            return;
        }

        if (permissionStatus === 'denied') {
            container.innerHTML = `<span class="notification-permission-denied">Notifications blocked</span>`;
            return;
        }

        if (permissionStatus === 'granted') {
            container.innerHTML = `<span class="notification-permission-granted">✓ Notifications enabled</span>`;
            return;
        }

        // Default state - show simple text
        container.innerHTML = `<span class="notification-permission-default">Click to get notified when session ends</span>`;
    }
}