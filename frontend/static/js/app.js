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

document.addEventListener('DOMContentLoaded', () => {
    const appContent = document.getElementById('app-content');
    
    // Initialize services and managers
    const apiService = new ApiService();
    const router = new Router(appContent);
    const newSessionModal = new ModalManager('new-session-modal');
    
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
    
    // Setup router with all routes
    router
        .register('dashboard', () => dashboardPage.load())
        .register('players', () => playersPage.load())
        .register('sessions', () => sessionsPage.load())
        .register('player/:id', (id) => playerDetailPage.load(id))
        .register('session/:id', (id) => sessionDetailPage.load(id));
    
    // Start the router
    router.route();
});