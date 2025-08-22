// Import modules
import ApiService from './modules/api-service.js';
import Router from './modules/router.js';
import ModalManager from './modules/modal-manager.js';
import DashboardPage from './modules/dashboard-page.js';
import PlayersPage from './modules/players-page.js';
import SessionsPage from './modules/sessions-page.js';
import SessionDetailPage from './modules/session-detail-page.js';
import PlayerDetailPage from './modules/player-detail-page.js';
import ServiceWorkerManager from './modules/service-worker-manager.js';
import DarkModeManager from './modules/dark-mode-manager.js';
import appConfig from './config.js';

// Service worker update handling
function setupServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.type === 'NEW_VERSION') {
                console.log('New version available:', event.data.version);
                showUpdateNotification();
            }
            
            if (event.data.type === 'FORCE_REFRESH') {
                console.log('Force refresh requested');
                window.location.reload();
            }
        });
        
        // Check for updates periodically
        setInterval(() => {
            checkForUpdates();
        }, 30000); // Check every 30 seconds
        
        // Check for updates when page becomes visible
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

function showUpdateNotification() {
    // Check if notification is already showing
    if (document.querySelector('.update-notification')) {
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = 'update-notification';
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
                🎮 Update Available
            </div>
            <div style="margin-bottom: 15px; font-size: 14px; opacity: 0.9;">
                New features and improvements are ready!
            </div>
            <div>
                <button onclick="updateApp()" style="
                    background: white;
                    color: #3367D6;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-right: 10px;
                ">Update Now</button>
                <button onclick="dismissUpdate()" style="
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
}

window.updateApp = function() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'FORCE_UPDATE'
        });
    }
};

window.dismissUpdate = function() {
    const notification = document.querySelector('.update-notification');
    if (notification) {
        notification.remove();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const appContent = document.getElementById('app-content');
    
    // Initialize services and managers
    const apiService = new ApiService();
    const router = new Router(appContent);
    const newSessionModal = new ModalManager('new-session-modal');
    const darkModeManager = new DarkModeManager();
    // Force dark mode on first load if no user preference
    if (!localStorage.getItem('gamble-king-dark-mode')) {
        darkModeManager.setTheme('dark');
    }
    
    // Initialize modules
    const dashboardPage = new DashboardPage(appContent, apiService);
    const playersPage = new PlayersPage(appContent, apiService);
    const sessionsPage = new SessionsPage(appContent, apiService);
    const sessionDetailPage = new SessionDetailPage(appContent, apiService);
    const playerDetailPage = new PlayerDetailPage(appContent, apiService);    
    
    // Initialize configuration from config.js
    let APP_VERSION = '1.0.5'; // Default until config loads
    
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
            alert('Session created successfully!');
            newSessionModal.hide();
            if (window.location.hash === '#sessions' || window.location.hash === '') {
                router.route(); // Refresh current page
            }
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
        
        // Update desktop navigation
        document.querySelectorAll('.desktop-nav a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentPage}`) {
                link.classList.add('active');
            }
        });
        
        // Update mobile navigation
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.classList.remove('active');
            const hash = btn.getAttribute('data-hash');
            if (hash === `#${currentPage}`) {
                btn.classList.add('active');
            }
        });
    }
    
    // Setup navigation event listeners
    function setupNavigation() {
        // Desktop navigation
        document.querySelectorAll('.desktop-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                window.location.hash = href;
                updateActiveNavigation();
            });
        });
        
        // Mobile navigation
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const hash = btn.getAttribute('data-hash');
                window.location.hash = hash;
                updateActiveNavigation();
            });
        });
        
        // Update navigation on hash change
        window.addEventListener('hashchange', updateActiveNavigation);
        
        // Initial navigation state
        updateActiveNavigation();
    }
    
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