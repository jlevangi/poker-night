// Import modules
import ApiService from './modules/api-service.js';
import Router from './modules/router.js';
import ModalManager from './modules/modal-manager.js';
import DashboardPage from './modules/dashboard-page.js';
import PlayersPage from './modules/players-page.js';
import SessionsPage from './modules/sessions-page.js';
import SessionDetailPage from './modules/session-detail-page.js';
import PlayerDetailPage from './modules/player-detail-page.js';
import StatsPage from './modules/stats-page.js';
import CalendarPage from './modules/calendar-page.js';
import ServiceWorkerManager from './modules/service-worker-manager.js';
import DarkModeManager from './modules/dark-mode-manager.js';
import SettingsManager from './modules/settings-manager.js';
import MoreMenuManager from './modules/more-menu-manager.js';
import appConfig from './config.js';

// Service worker update handling
function setupServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.type === 'NEW_VERSION') {
                const serverVersion = event.data.serverVersion;
                const installedVersion = event.data.installedVersion;
                console.log(`Update available: ${installedVersion} → ${serverVersion}`);

                // Check if we've already shown notification for this update
                const dismissedVersion = localStorage.getItem('gamble-king-dismissed-update');
                if (dismissedVersion !== serverVersion) {
                    showUpdateNotification(serverVersion, installedVersion);
                }
            }

            if (event.data.type === 'FORCE_REFRESH') {
                console.log('Force refresh requested');
                // Clear the dismissed update flag
                localStorage.removeItem('gamble-king-dismissed-update');
                window.location.reload();
            }
        });

        // Check for updates immediately after SW is ready
        navigator.serviceWorker.ready.then(() => {
            // Small delay to ensure SW is fully active
            setTimeout(checkForUpdates, 1000);
        });

        // Check for updates periodically
        setInterval(() => {
            checkForUpdates();
        }, 60000); // Check every minute

        // Check for updates when page becomes visible (e.g., user returns after weeks)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkForUpdates();
            }
        });
    }
}

async function checkForUpdates() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            const config = await appConfig.getConfig();
            navigator.serviceWorker.controller.postMessage({
                type: 'CHECK_VERSION',
                version: config.APP_VERSION
            });
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }
}

function showUpdateNotification(serverVersion, installedVersion) {
    // Check if notification is already showing
    if (document.querySelector('.update-notification')) {
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.dataset.serverVersion = serverVersion;
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3367D6;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <div style="margin-bottom: 10px; font-weight: 600;">
                Update Available
            </div>
            <div style="margin-bottom: 15px; font-size: 14px; opacity: 0.9;">
                Version ${serverVersion} is ready. Refresh to get new features and fixes.
            </div>
            <div>
                <button id="update-now-btn" style="
                    background: white;
                    color: #3367D6;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-right: 10px;
                ">Update Now</button>
                <button id="dismiss-update-btn" style="
                    background: transparent;
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Later</button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Add event listeners
    const updateBtn = notification.querySelector('#update-now-btn');
    const dismissBtn = notification.querySelector('#dismiss-update-btn');

    updateBtn.addEventListener('click', updateApp);
    dismissBtn.addEventListener('click', () => dismissUpdate(serverVersion));
}

window.updateApp = async function() {
    if ('serviceWorker' in navigator) {
        // Remove the notification
        const notification = document.querySelector('.update-notification');
        if (notification) {
            notification.remove();
        }

        // Clear the dismissed update flag
        localStorage.removeItem('gamble-king-dismissed-update');

        try {
            // Unregister the current service worker
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.unregister();
                console.log('Service worker unregistered');
            }

            // Clear all caches
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('All caches cleared');

            // Hard reload to get fresh content and new service worker
            window.location.reload(true);
        } catch (error) {
            console.error('Error during update:', error);
            // Fallback: just reload
            window.location.reload(true);
        }
    }
};

window.dismissUpdate = function(serverVersion) {
    const notification = document.querySelector('.update-notification');
    if (notification) {
        // Store the dismissed version so we don't show notification again for this version
        const version = serverVersion || notification.dataset.serverVersion;
        if (version) {
            localStorage.setItem('gamble-king-dismissed-update', version);
        }
        notification.remove();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Apply dark mode immediately to prevent flash
    if (!localStorage.getItem('gamble-king-dark-mode')) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('gamble-king-dark-mode', 'dark');
    } else {
        const savedTheme = localStorage.getItem('gamble-king-dark-mode');
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    const appContent = document.getElementById('app-content');
    
    // Load configuration first
    const config = await appConfig.getConfig();
    const APP_VERSION = config.APP_VERSION;
    console.log('App initialized with version:', APP_VERSION);
    
    // Initialize services and managers
    const apiService = new ApiService();
    const router = new Router(appContent);
    const newSessionModal = new ModalManager('new-session-modal');
    const darkModeManager = new DarkModeManager();
    // Force dark mode on first load if no user preference
    if (!localStorage.getItem('gamble-king-dark-mode')) {
        darkModeManager.setTheme('dark');
    }
    
    // Initialize settings manager
    const settingsManager = new SettingsManager(darkModeManager);

    // Initialize more menu manager (mobile)
    const moreMenuManager = new MoreMenuManager(darkModeManager);
    
    // Initialize modules
    const dashboardPage = new DashboardPage(appContent, apiService);
    const playersPage = new PlayersPage(appContent, apiService);
    const sessionsPage = new SessionsPage(appContent, apiService);
    const sessionDetailPage = new SessionDetailPage(appContent, apiService);
    const playerDetailPage = new PlayerDetailPage(appContent, apiService);
    const statsPage = new StatsPage(appContent, apiService);
    const calendarPage = new CalendarPage(appContent, apiService);
    
    // Setup new session modal
    setupNewSessionModal();
    
    function setupNewSessionModal() {
        newSessionModal.setup({
            cancelButton: 'modal-cancel-session-btn',
            submitButton: {
                id: 'modal-create-session-btn',
                callback: handleCreateSession
            },
            additionalElements: {
                'modal-session-date': {
                    value: new Date().toISOString().split('T')[0]
                },
                'modal-session-buyin': {
                    value: '20'
                },
                'modal-today-btn': {
                    events: {
                        click: () => {
                            const dateInput = document.getElementById('modal-session-date');
                            if (dateInput) {
                                dateInput.value = new Date().toISOString().split('T')[0];
                            }
                        }
                    }
                }
            }
        });
    }
    
    async function handleCreateSession() {
        const dateInput = document.getElementById('modal-session-date');
        const buyinInput = document.getElementById('modal-session-buyin');
        
        const date = dateInput?.value;
        const buyin = parseFloat(buyinInput?.value || 0);

        if (!date) {
            alert("Please select a date for the session.");
            return;
        }
        if (isNaN(buyin) || buyin <= 0) {
            alert("Please enter a valid positive buy-in amount.");
            return;
        }

        try {
            const newSession = await apiService.createSession({ 
                date: date, 
                default_buy_in_value: buyin 
            });
            newSessionModal.hide();
            window.location.hash = `#session/${newSession.session_id}`;
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }
    
    // Listen for custom events to show modal
    document.addEventListener('showNewSessionModal', () => {
        // Update date field to today
        const dateInput = document.getElementById('modal-session-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        newSessionModal.show();
    });
    
    // Initialize service worker
    const serviceWorkerManager = new ServiceWorkerManager(APP_VERSION);
    serviceWorkerManager.initialize();
    
    // Setup navigation highlighting
    function updateActiveNavigation() {
        const currentHash = window.location.hash || '#dashboard';
        const currentPage = currentHash.split('/')[0].replace('#', '') || 'dashboard';
        
        // Update desktop navigation (both old and new classes)
        document.querySelectorAll('.desktop-nav a, .neo-desktop-nav .neo-nav-btn').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentPage}`) {
                link.classList.add('active');
            }
        });
        
        // Update mobile navigation (both old and new classes, excluding more trigger)
        document.querySelectorAll('.bottom-nav .nav-btn, .neo-bottom-nav .neo-nav-mobile-btn:not(#more-trigger)').forEach(btn => {
            btn.classList.remove('active');
            const hash = btn.getAttribute('data-hash');
            if (hash === `#${currentPage}`) {
                btn.classList.add('active');
            }
        });

        // Update More menu active states
        moreMenuManager.updateActiveItems();
    }
    
    // Setup navigation event listeners
    function setupNavigation() {
        // Desktop navigation (both old and new classes, excluding settings button)
        document.querySelectorAll('.desktop-nav a, .neo-desktop-nav .neo-nav-btn:not(#settings-btn)').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href) {
                    window.location.hash = href;
                    updateActiveNavigation();
                }
            });
        });
        
        // Mobile navigation (both old and new classes, excluding more trigger)
        document.querySelectorAll('.bottom-nav .nav-btn, .neo-bottom-nav .neo-nav-mobile-btn:not(#more-trigger)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const hash = btn.getAttribute('data-hash');
                if (hash) {  // Only navigate if there's a hash (not for settings button)
                    window.location.hash = hash;
                    updateActiveNavigation();
                }
            });
        });
        
        // Settings button functionality (desktop)
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showSettings();
            });
        }
        
        // Settings close button functionality
        const settingsClose = document.getElementById('settings-close');
        if (settingsClose) {
            settingsClose.addEventListener('click', (e) => {
                e.preventDefault();
                hideSettings();
            });
        }
        
        // Settings overlay close functionality
        const settingsOverlay = document.getElementById('settings-overlay');
        if (settingsOverlay) {
            settingsOverlay.addEventListener('click', (e) => {
                hideSettings();
            });
        }
    }
    
    // Helper function to show settings
    function showSettings() {
        const settingsMenu = document.getElementById('settings-menu');
        const settingsOverlay = document.getElementById('settings-overlay');
        if (settingsMenu) {
            settingsMenu.classList.add('show');
        }
        if (settingsOverlay) {
            settingsOverlay.classList.add('active');
        }
    }
    
    // Helper function to hide settings
    function hideSettings() {
        const settingsMenu = document.getElementById('settings-menu');
        const settingsOverlay = document.getElementById('settings-overlay');
        if (settingsMenu) {
            settingsMenu.classList.remove('show');
        }
        if (settingsOverlay) {
            settingsOverlay.classList.remove('active');
        }
    }

    // Update navigation on hash change
    window.addEventListener('hashchange', updateActiveNavigation);

    // Setup router with all routes
    router
        .register('dashboard', () => {
            dashboardPage.load();
            updateActiveNavigation();
        })
        .register('players', () => {
            playersPage.load();
            updateActiveNavigation();
        })
        .register('sessions', () => {
            sessionsPage.load();
            updateActiveNavigation();
        })
        .register('calendar', () => {
            calendarPage.load();
            updateActiveNavigation();
        })
        .register('stats', () => {
            statsPage.load();
            updateActiveNavigation();
        })
        .register('player/:id', (id) => {
            playerDetailPage.load(id);
            updateActiveNavigation();
        })
        .register('session/:id', (id) => {
            sessionDetailPage.load(id);
            updateActiveNavigation();
        });
    
    // Initialize navigation
    setupNavigation();
    
    // Start the router
    router.route();
    
    // Setup service worker update handling
    setupServiceWorkerUpdates();
});