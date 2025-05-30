document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");
    const appContent = document.getElementById('app-content');
    const newSessionModal = document.getElementById('new-session-modal');
    
    // Check if modal exists
    if (!newSessionModal) {
        console.error("Could not find new-session-modal element!");
    } else {
        console.log("Modal found in DOM");
        // Ensure modal is properly initialized with CSS classes only
        newSessionModal.removeAttribute('style');
    }
    
    // Use safer querySelector approach that won't throw errors if elements don't exist
    const modalCloseBtn = newSessionModal ? newSessionModal.querySelector('.modal-close-btn') : null;
    const modalCancelBtn = document.getElementById('modal-cancel-session-btn');
    const modalCreateBtn = document.getElementById('modal-create-session-btn');
    const modalSessionDateInput = document.getElementById('modal-session-date');    const modalSessionBuyinInput = document.getElementById('modal-session-buyin');
    const modalTodayBtn = document.getElementById('modal-today-btn');    
    
    // Initialize configuration from config.js
    let APP_VERSION = '1.0.5'; // Default until config loads
    
    // Function to show update notification
    const showUpdateNotification = () => {
        // Remove any existing notification to avoid duplicates
        const existingNotification = document.querySelector('.update-notification');
        if (existingNotification) existingNotification.remove();

        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'assertive');
        notification.innerHTML = `
            <div class="update-content">
                <strong>New version available!</strong>
                <p>A new version of the app is available. Please refresh the page.</p>
            </div>
        `;
        document.body.appendChild(notification);
    };
    
    if ('serviceWorker' in navigator) {
        // Check if we're coming from an update process
        const isUpdating = sessionStorage.getItem('app_updating') === 'true';
        if (isUpdating) {
            console.log('Update in progress, cleaning up...');
            sessionStorage.removeItem('app_updating');
        }
        
        // Add a cache-busting query parameter to ensure fresh service worker
        const swUrl = `/sw.js?v=${APP_VERSION}${isUpdating ? '&forceUpdate=' + Date.now() : ''}`;
        
        // Register the service worker
        navigator.serviceWorker.register(swUrl)
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
                
                // If we're coming from an update, force activate the new service worker
                if (isUpdating && registration.waiting) {
                    console.log('Forcing new service worker to activate after update');
                    registration.waiting.postMessage({type: 'SKIP_WAITING'});
                }
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker installing...');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New service worker installed, update available');
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
            
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NEW_VERSION') {
                console.log(`New app version available: ${event.data.version}`);
                showUpdateNotification();
            }
        });
        
        // If there's a controlling service worker already, make sure we're using the latest
        if (navigator.serviceWorker.controller && isUpdating) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CHECK_VERSION',
                version: APP_VERSION
            });
        }
    }
    
    function showNewSessionModal() {
        try {
            if (!newSessionModal) {
                console.error("Modal element not found");
                alert("There was a problem showing the new session form. Please refresh the page and try again.");
                return;
            }
            
            const today = new Date().toISOString().split('T')[0];
            
            if (modalSessionDateInput) {
                modalSessionDateInput.value = today;
            }
            
            if (modalSessionBuyinInput) {
                modalSessionBuyinInput.value = "20";
            }
            
            console.log("Showing modal");
            
            // Apply comprehensive styling to make sure it shows on all devices
            // First remove any inline style that might be interfering
            newSessionModal.removeAttribute('style');
            
            // Add the active class for CSS transitions
            newSessionModal.classList.add('active');
            
            // As a backup, explicitly set all necessary styles
            const modalStyles = {
                'display': 'flex',
                'opacity': '1',
                'visibility': 'visible',
                'z-index': '1000',
                'pointer-events': 'auto',
                'position': 'fixed',
                'top': '0',
                'left': '0',
                'width': '100%',
                'height': '100%',
                'background-color': 'rgba(0, 0, 0, 0.6)',
                'justify-content': 'center',
                'align-items': 'center'
            };
            
            // Apply all styles
            Object.keys(modalStyles).forEach(key => {
                newSessionModal.style[key] = modalStyles[key];
            });
            
            // Make sure modal is at the end of body to avoid z-index issues
            document.body.appendChild(newSessionModal);

            console.log("Modal should now be visible");
        } catch(e) {
            console.error("Error showing modal:", e);
            alert("There was a problem showing the new session form. Please try again later.");
        }
    }
    
    function hideNewSessionModal() {
        try {
            if (newSessionModal) {
                console.log("Hiding modal");
                // Remove active class
                newSessionModal.classList.remove('active');
                
                // Reset all direct styles
                const modalHideStyles = {
                    'opacity': '0',
                    'visibility': 'hidden',
                    'pointer-events': 'none'
                };
                
                // Apply hide styles
                Object.keys(modalHideStyles).forEach(key => {
                    newSessionModal.style[key] = modalHideStyles[key];
                });
                
                console.log("Modal should now be hidden");
            }
        } catch(e) {
            console.error("Error hiding modal:", e);
        }
    }
    
    // Add event listeners with proper error checking
    if (modalCloseBtn) {
        console.log("Adding close button listener");
        modalCloseBtn.addEventListener('click', hideNewSessionModal);
    } else {
        console.error("Close button not found in modal");
    }
    
    if (modalCancelBtn) {
        console.log("Adding cancel button listener");
        modalCancelBtn.addEventListener('click', hideNewSessionModal);
    } else {
        console.error("Cancel button not found");
    }
    
    if (modalTodayBtn && modalSessionDateInput) {
        console.log("Adding today button listener");
        modalTodayBtn.addEventListener('click', () => {
            modalSessionDateInput.value = new Date().toISOString().split('T')[0];
        });
    } else {
        console.error("Today button or date input not found");
    }

    if (modalCreateBtn) modalCreateBtn.addEventListener('click', async () => {
        const date = modalSessionDateInput.value;
        const buyin = parseFloat(modalSessionBuyinInput.value);

        if (!date) {
            alert("Please select a date for the session.");
            return;
        }
        if (isNaN(buyin) || buyin <= 0) {
            alert("Please enter a valid positive buy-in amount.");
            return;
        }

        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: date, default_buy_in_value: buyin })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create session");
            }
            const newSession = await response.json();
            alert('Session created successfully!');
            hideNewSessionModal();
            if (window.location.hash === '#sessions' || window.location.hash === '') {
                loadSessions(); // Refresh if on sessions page or dashboard (which might show sessions)
            }
            window.location.hash = `#session/${newSession.session_id}`;
        } catch (error) {
            console.error('Error creating session:', error);
            alert(`Error: ${error.message}`);
        }
    });


    async function fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Network response was not ok: ${errorData.error || errorData.message}`);
        }
        return response.json();
    }

    async function loadDashboard() {
        const playersSummary = await fetchData('/api/players');
        let html = '<div class="dashboard-header">';        if (playersSummary.length > 0) {
            const sortedPlayers = [...playersSummary].sort((a, b) => b.net_profit - a.net_profit);
            const gambleKing = sortedPlayers[0];            if (gambleKing && gambleKing.net_profit > 0) {
                const profitClass = gambleKing.net_profit >= 0 ? 'profit-positive' : 'profit-negative';
                html += `<div class="gamble-king-container">
                            <h2>👑 The Gamble King 👑</h2>
                            <p class="gamble-king-name gamble-king-name-dash">${gambleKing.name}</p>
                            <div class="gamble-king-stats">
                                <p>Games: ${gambleKing.games_played} | Net Profit: <span class="${profitClass}">$${gambleKing.net_profit.toFixed(2)}</span></p>
                                <p>Win %: ${gambleKing.win_percentage.toFixed(1)}% | Avg Profit/Game: $${gambleKing.average_profit_per_game.toFixed(2)}</p>
                                <p>W-L-D: ${gambleKing.wins}-${gambleKing.losses}-${gambleKing.breakeven}</p>
                            </div>
                         </div>`;} else if (gambleKing) { // Case where there are players, but no one has positive profit
                const profitClass = gambleKing.net_profit >= 0 ? 'profit-positive' : 'profit-negative';
                html += `<div class="gamble-king-container">
                            <h2>Gamble King</h2>
                            <p>No Gamble King crowned yet! Current top player: ${gambleKing.name}</p>
                            <div class="gamble-king-stats">
                                <p>Games: ${gambleKing.games_played} | Net Profit: <span class="${profitClass}">$${gambleKing.net_profit.toFixed(2)}</span></p>
                                <p>Win %: ${gambleKing.win_percentage.toFixed(1)}% | Avg Profit/Game: $${gambleKing.average_profit_per_game.toFixed(2)}</p>
                                <p>W-L-D: ${gambleKing.wins}-${gambleKing.losses}-${gambleKing.breakeven}</p>
                            </div>
                         </div>`;} else { // Should not be reached if playersSummary.length > 0 but added for safety
                html += `<div class="gamble-king-container">
                            <h2>Gamble King</h2>
                            <p>Time to play and become the Gamble King!</p>
                         </div>`;
            }        } else {
            html += `<div class="gamble-king-container">
                        <h2>Welcome to Gamble King!</h2>
                        <p>No player data available yet.</p>
                     </div>`;
        }        html += `</div><div class="quick-actions">
                    <button class="quick-action-btn" id="session-action-btn">Start New Session</button>
                </div>`;

        html += '<div class="dashboard-content"><h3>Player Standings Overview</h3>';
        if (playersSummary.length === 0) {
            html += '<p>No players yet. Go to the "Players" section to add some!</p>';
        } else {
            html += `
                <div class="table-responsive">
                    <table class="players-stats-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Games</th>
                                <th>Net Profit</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            playersSummary.forEach((player, idx) => {
                const profitClass = player.net_profit >= 0 ? 'profit-positive' : 'profit-negative';
                // Add crown and label if this is the Gamble King
                const isGambleKing = idx === 0 && player.net_profit > 0;
                html += `
                    <tr${isGambleKing ? ' class="gamble-king-row"' : ''}>
                        <td>
                            ${isGambleKing ? '<span class="crown-icon">👑</span> ' : ''}
                            <a href="#player/${player.player_id}">${player.name}</a>
                            ${isGambleKing ? '<div class="gamble-king-label-container"><span class="gamble-king-label">Gamble King</span></div>' : ''}
                        </td>
                        <td>${player.games_played}</td>
                        <td class="${profitClass}">$${player.net_profit.toFixed(2)}</td>
                    </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                </div>
            </div>
            `;
        }

        appContent.innerHTML = html;

        document.querySelectorAll('.quick-action-btn[data-hash]').forEach(button => {
            button.addEventListener('click', (e) => {
                window.location.hash = e.target.dataset.hash;
            });
        });        const sessionActionBtn = document.getElementById('session-action-btn');
        if (sessionActionBtn) {
            console.log("Adding session action button listener");
            
            // First, check if there's an active session
            fetchData('/api/sessions/active').then(activeSessions => {
                if (activeSessions && activeSessions.length > 0) {
                    // There is an active session, change button style and text
                    const activeSession = activeSessions[0];
                    sessionActionBtn.textContent = "Open Active Session";
                    sessionActionBtn.classList.add("active-session-btn");
                    
                    // On click, navigate to the active session
                    sessionActionBtn.addEventListener('click', (e) => {
                        console.log("Navigating to active session");
                        e.preventDefault();
                        window.location.hash = `#session/${activeSession.session_id}`;
                    });
                } else {
                    // No active session, keep "Start New Session" functionality
                    sessionActionBtn.textContent = "Start New Session";
                    
                    sessionActionBtn.addEventListener('click', (e) => {
                        console.log("Start new session button clicked");
                        e.preventDefault();
                        showNewSessionModal();
                    });
                }
            }).catch(error => {
                console.error("Error fetching active sessions:", error);
                // Default to "Start New Session" in case of error
                sessionActionBtn.textContent = "Start New Session";
                sessionActionBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    showNewSessionModal();
                });
            });
        } else {
            console.error("Session action button not found in DOM");
        }
    }
    
    async function loadPlayers() {
        // Fetch both player details and player stats
        const players = await fetchData('/api/players/details');
        const playerStats = await fetchData('/api/players');
        
        // Create a map of player stats by player_id for easier lookup
        const statsMap = {};
        playerStats.forEach(stat => {
            statsMap[stat.player_id] = stat;
        });
        
        let html = `
            <h2>Manage Players</h2>
            <div class="add-player-form">
                <input type="text" id="new-player-name" placeholder="Enter New Player Name">
                <button id="add-player-btn">Add Player</button>
            </div>
            <h3>Current Players:</h3>
        `;
        if (players.length === 0) {
            html += '<p>No players added yet.</p>';
        } else {
            // First show the list of players with improved mobile layout and quick stats            html += '<div class="players-list-container">';
            html += '<ul class="players-list enhanced">';
            players.forEach(player => {
                // Get the stats for this player from the statsMap
                const stats = statsMap[player.player_id] || {
                    seven_two_wins: 0
                };
                
                html += `<li>
                    <div class="player-row">
                        <div class="player-name">
                            <a href="#player/${player.player_id}" class="player-name-link">${player.name}</a>
                        </div>
                        <div class="seven-two-counter">
                            <span class="seven-two-label">7-2 Wins:</span>
                            <span class="seven-two-value">${stats.seven_two_wins}</span>
                        </div>
                    </div>
                </li>`;
            });
            html += '</ul>';
            html += '</div>';
            
            // Now add a table with player statistics
            html += `
                <h3>Player Statistics</h3>
                <div class="table-responsive">
                    <table class="players-stats-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Games</th>
                                <th>Net Profit</th>
                                <th>Win %</th>
                                <th>Avg Profit/Game</th>
                                <th>W-L-D</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
              // Sort players by net profit (descending)
            const sortedPlayers = [...players].sort((a, b) => {
                const statA = statsMap[a.player_id] || { net_profit: 0 };
                const statB = statsMap[b.player_id] || { net_profit: 0 };
                return statB.net_profit - statA.net_profit;
            });
            
            // Flag to track if we've found a Gamble King (player with highest positive profit)
            let gambleKingFound = false;
            
            sortedPlayers.forEach((player, index) => {
                const stats = statsMap[player.player_id] || {
                    games_played: 0,
                    net_profit: 0,
                    win_percentage: 0,
                    average_profit_per_game: 0,
                    wins: 0,
                    losses: 0,
                    breakeven: 0
                };
                
                const profitClass = stats.net_profit >= 0 ? 'profit-positive' : 'profit-negative';
                
                // Add crown icon to player with highest positive profit (Gamble King)
                const isGambleKing = index === 0 && stats.net_profit > 0 && !gambleKingFound;
                if (isGambleKing) {
                    gambleKingFound = true;
                }
                
                html += `
                    <tr${isGambleKing ? ' class="gamble-king-row"' : ''}>
                        <td>
                            
                            <a href="#player/${player.player_id}">${player.name}</a>
                            ${isGambleKing ? '<span class="crown-icon">👑</span> ' : ''}
                            ${isGambleKing ? '<div class="gamble-king-label-container"><span class="gamble-king-label">Gamble King</span></div>' : ''}
                        </td>
                        <td>${stats.games_played}</td>
                        <td class="${profitClass}">$${stats.net_profit.toFixed(2)}</td>
                        <td>${stats.win_percentage.toFixed(1)}%</td>
                        <td>$${stats.average_profit_per_game.toFixed(2)}</td>
                        <td>${stats.wins}-${stats.losses}-${stats.breakeven}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        appContent.innerHTML = html;        // Add event listeners for the player list
        const addPlayerBtn = document.getElementById('add-player-btn');
        if (addPlayerBtn) addPlayerBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('new-player-name');
            const name = nameInput.value.trim();
            if (name) {
                try {
                    const response = await fetch('/api/players', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name })
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to add player");
                    }
                    nameInput.value = '';
                    loadPlayers();
                    alert('Player added/found successfully!');
                } catch (error) {
                    console.error('Error adding player:', error);
                    alert(`Error: ${error.message}`);
                }
            } else {
                alert('Please enter a player name.');
            }
        });
          // No 7-2 buttons in the player list anymore, as they're only for viewing count
    }

    async function loadPlayerDetail(playerId) {
        appContent.innerHTML = `<p>Loading player ${playerId} details...</p>`;
        try {
            const stats = await fetchData(`/api/players/${playerId}/stats`);
            const history = await fetchData(`/api/players/${playerId}/history`);

            let html = `<h2>${stats.name} - Statistics</h2>`;            html += `<div class="player-stats-summary">
                        <p><strong>Games Played:</strong> ${stats.games_played}</p>
                        <p><strong>Total Buy-ins:</strong> $${stats.total_buy_ins_value.toFixed(2)}</p>
                        <p><strong>Total Payouts:</strong> $${stats.total_payout.toFixed(2)}</p>
                        <p><strong>Wins:</strong> ${stats.wins} | <strong>Losses:</strong> ${stats.losses} | <strong>Breakeven:</strong> ${stats.breakeven}</p>                        <p><strong>Win Percentage:</strong> ${stats.win_percentage.toFixed(2)}%</p>                        <p><strong>Avg. Profit/Game:</strong> $${stats.average_profit_per_game.toFixed(2)}</p>
                        <div class="seven-two-stats-detail">
                            <span class="seven-two-label">7-2 Hand Wins:</span>
                            <span class="seven-two-value">${stats.seven_two_wins || 0}</span>
                        </div>
                     </div>`;
            html += `<h3>Session History:</h3>`;
            if (history.length === 0) {
                html += "<p>No session history for this player.</p>";
            } else {
                html += "<ul>";
                history.forEach(entry => {
                    const sessionDate = new Date(entry.session_date + 'T00:00:00');
                    const friendlyDate = sessionDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                    html += `<li>
                        Date: ${friendlyDate} (Buy-in Value: $${entry.session_buy_in_value.toFixed(2)}) - 
                        ${entry.buy_in_count} Buy-in(s) ($${entry.total_buy_in_amount.toFixed(2)}), 
                        Payout: $${entry.payout.toFixed(2)}, Profit: <span class="${entry.profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${entry.profit.toFixed(2)}</span>
                    </li>`;
                });
                html += "</ul>";
            }            appContent.innerHTML = html;
        } catch (error) {
            console.error(`Error loading player details for ${playerId}:`, error);
            appContent.innerHTML = `<p>Could not load details for player ${playerId}. ${error.message}</p>`;
        }
    }

    async function loadSessions() {
        // Get sessions data and also fetch entries to calculate total value
        const sessions = await fetchData('/api/sessions');
        
        // Create an object to map session IDs to their entries
        let sessionEntriesMap = {};
        
        // For each session, fetch its entries to calculate total value
        await Promise.all(sessions.map(async session => {
            try {
                const data = await fetchData(`/api/sessions/${session.session_id}`);
                sessionEntriesMap[session.session_id] = data.entries;
            } catch (error) {
                console.error(`Error fetching entries for session ${session.session_id}:`, error);
                sessionEntriesMap[session.session_id] = [];
            }
        }));
        
        let html = `
            <h2>Manage Sessions</h2>            <div class="sessions-actions">
                <button id="show-create-session-modal-btn" class="action-btn primary-btn">✨ New Session</button>
            </div>
            <h3>Past & Active Sessions:</h3>
        `;
        if (sessions.length === 0) {
            html += '<p>No sessions found.</p>';
        } else {
            html += '<ul class="sessions-list">';
            sessions.forEach(session => {
                const statusClass = session.is_active ? "status-active" : "status-ended";
                const statusText = session.is_active ? "Active" : "Ended";
                const sessionDate = new Date(session.date + 'T00:00:00');
                const friendlyDate = sessionDate.toLocaleDateString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric'
                });                // Calculate total value for this session
                const entries = sessionEntriesMap[session.session_id] || [];
                const totalSessionValue = entries.reduce((sum, entry) => sum + entry.total_buy_in_amount, 0);
                const buyInCount = entries.reduce((sum, entry) => sum + entry.buy_in_count, 0);
                
                // Calculate total amount paid out and amount not yet paid
                const totalPaidOut = entries.reduce((sum, entry) => sum + entry.payout, 0);
                const amountNotPaidOut = totalSessionValue - totalPaidOut;
                
                // Only show the unpaid amount if the session is active
                const showUnpaidAmount = session.is_active && amountNotPaidOut > 0;

                html += `<li class="session-item">
                            <a href="#session/${session.session_id}" class="session-link">
                                <span class="session-date">${friendlyDate}</span>
                                <span class="session-buyin">Buy-in: $${session.default_buy_in_value.toFixed(2)}</span>
                                <span class="session-total-value">Total Value: $${totalSessionValue.toFixed(2)} (${buyInCount} buy-ins)</span>
                                ${showUnpaidAmount ? `<span class="session-unpaid-value">Not Yet Paid Out: $${amountNotPaidOut.toFixed(2)}</span>` : ''}
                            </a>
                            <span class="session-status ${statusClass}">${statusText}</span>
                         </li>`;
            });
            html += '</ul>';
        }
        appContent.innerHTML = html;
        
        const showModalBtn = document.getElementById('show-create-session-modal-btn');
        if (showModalBtn) {
            console.log("Adding new session button listener on sessions page");
            showModalBtn.addEventListener('click', (e) => {
                console.log("New session button clicked from sessions page");
                e.preventDefault();
                showNewSessionModal();
            });
        } else {
            console.error("New session button not found on sessions page");
        }
    }

    async function loadSessionDetail(sessionId) {
        appContent.innerHTML = `<p>Loading session ${sessionId} details...</p>`;
        try {            const data = await fetchData(`/api/sessions/${sessionId}`);
            const sessionInfo = data.session_info;
            const entries = data.entries;
            const sessionDate = new Date(sessionInfo.date + 'T00:00:00');
            const friendlyDate = sessionDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });            // Calculate total value of the session (sum of all buy-ins)
            const totalSessionValue = entries.reduce((sum, entry) => sum + entry.total_buy_in_amount, 0);
            const totalBuyInCount = entries.reduce((sum, entry) => sum + entry.buy_in_count, 0);
            
            // Calculate total amount paid out
            const totalPaidOut = entries.reduce((sum, entry) => sum + entry.payout, 0);
            
            // Calculate amount not yet paid out (money still in play)
            const amountNotPaidOut = totalSessionValue - totalPaidOut;

            let html = `<h2>Session: ${friendlyDate} (Buy-in: $${sessionInfo.default_buy_in_value.toFixed(2)})</h2>`;
              // Add session total value display
            const isPaidOut = amountNotPaidOut === 0;
            html += `<div class="session-value-summary">
                        <p class="session-total-value"><strong>Total Session Value:</strong> $${totalSessionValue.toFixed(2)} (${totalBuyInCount} buy-ins)</p>
                        <p class="session-unpaid-value ${isPaidOut ? 'paid-out' : ''}"><strong>Amount Not Yet Paid Out:</strong> $${amountNotPaidOut.toFixed(2)}</p>
                    </div>`;
            
            html += sessionInfo.is_active ? `<p class="session-status status-active" style="display: inline-block; margin-bottom: 1rem;"><strong>Status: Active</strong></p>` : `<p class="session-status status-ended" style="display: inline-block; margin-bottom: 1rem;"><strong>Status: Ended</strong></p>`;            if (sessionInfo.is_active) {
                html += `
                    <div class="session-controls">
                        <h3>Add Player / Record Buy-in</h3>
                        <div class="session-add-player">
                            <select id="select-player-for-session">
                                <option value="">-- Select Player --</option>
                            </select>
                            <button id="add-player-entry-btn" class="primary-btn">Add Buy-in</button>
                        </div>
                        <div class="session-action-buttons">
                            <button id="end-session-btn" class="danger-btn">End Session</button>
                        </div>
                    </div>
                `;
            } else {
                // Add reactivate button for ended sessions
                html += `
                    <div class="session-action-buttons">
                        <button id="reactivate-session-btn" class="reactivate-session-btn">Reactivate Session</button>
                    </div>
                `;
            }
            html += `<h3>Players in Session:</h3>`;
            if (entries.length === 0) {
                html += "<p>No players have bought into this session yet.</p>";
            } else {
                // Get player details to show 7-2 wins
                const playerDetails = await fetchData('/api/players/details');
                const playerStatsData = await fetchData('/api/players');
                
                // Create a map of player stats by player_id for easier lookup
                const statsMap = {};
                playerStatsData.forEach(stat => {
                    statsMap[stat.player_id] = stat;
                });
                
                html += "<ul class='session-players-list'>";
                entries.sort((a, b) => a.player_name.localeCompare(b.player_name)).forEach(entry => {
                    // Get the player's 7-2 wins count
                    const playerStats = statsMap[entry.player_id] || {};
                    const sevenTwoWins = playerStats.seven_two_wins || 0;
                    
                    html += `<li>
                                <div class="session-player-details">
                                    <strong>${entry.player_name}</strong>: 
                                    ${entry.buy_in_count} Buy-in(s) ($${entry.total_buy_in_amount.toFixed(2)})
                                    | Payout: $${entry.payout.toFixed(2)}
                                    | Profit: <span class="${entry.profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${entry.profit.toFixed(2)}</span>
                                    ${sessionInfo.is_active ? 
                                        `<div class="session-player-actions">
                                            <button class="set-payout-btn small-btn" data-player-id="${entry.player_id}" data-player-name="${entry.player_name}" style="background-color: #ffc107; color: #212529;">Set Payout</button>
                                        </div>` : ''}
                                </div>
                                <div class="session-seven-two-controls">
                                    <span class="seven-two-label">7-2 Wins:</span>
                                    <span class="seven-two-value">${sevenTwoWins}</span>
                                    <div class="seven-two-buttons">
                                        <button class="seven-two-increment-btn" data-player-id="${entry.player_id}" title="Add a 7-2 win">+</button>
                                        <button class="seven-two-decrement-btn" data-player-id="${entry.player_id}" title="Remove a 7-2 win">-</button>
                                    </div>
                                </div>
                             </li>`;
                });
                html += "</ul>";
            }
            appContent.innerHTML = html;

            if (sessionInfo.is_active) {
                const players = await fetchData('/api/players/details');
                const selectPlayerEl = document.getElementById('select-player-for-session');
                if (selectPlayerEl) { // Ensure element exists
                    players.forEach(p => {
                        selectPlayerEl.innerHTML += `<option value="${p.player_id}">${p.name}</option>`;
                    });
                }

                const addPlayerEntryBtn = document.getElementById('add-player-entry-btn');                if (addPlayerEntryBtn) addPlayerEntryBtn.addEventListener('click', async () => {
                    const playerId = document.getElementById('select-player-for-session').value;
                    if (!playerId) { alert("Please select a player."); return; }
                    
                    // Always use 1 as the number of buy-ins
                    const numBuyIns = 1;

                    try {
                        const response = await fetch(`/api/sessions/${sessionId}/entries`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ player_id: playerId, num_buy_ins: numBuyIns })
                        });
                        if (!response.ok) throw new Error((await response.json()).error || "Failed to add entry");
                        loadSessionDetail(sessionId);
                    } catch (err) { alert(`Error: ${err.message}`); }
                });document.querySelectorAll('.set-payout-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const playerId = e.target.dataset.playerId;
                        const playerName = e.target.dataset.playerName;
                        const payoutStr = prompt(`Enter final payout for ${playerName}:`);
                        if (payoutStr !== null) {
                            const payoutAmount = parseFloat(payoutStr);
                            if (isNaN(payoutAmount) || payoutAmount < 0) {
                                alert("Invalid payout amount."); return;
                            }
                            try {
                                const response = await fetch(`/api/sessions/${sessionId}/entries/${playerId}/payout`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ payout_amount: payoutAmount })
                                });
                                if (!response.ok) throw new Error((await response.json()).error || "Failed to set payout");
                                loadSessionDetail(sessionId);
                            } catch (err) { alert(`Error: ${err.message}`); }
                        }
                    });
                });
                
                // Add event listeners for 7-2 wins increment buttons
                document.querySelectorAll('.seven-two-increment-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const playerId = e.target.dataset.playerId;
                        
                        try {
                            const response = await fetch(`/api/players/${playerId}/seven-two-wins`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || "Failed to increment 7-2 wins");
                            }
                            
                            // Reload the session detail page to show updated stats
                            loadSessionDetail(sessionId);
                        } catch (error) {
                            console.error('Error updating 7-2 wins:', error);
                            alert(`Error: ${error.message}`);
                        }
                    });
                });
                
                // Add event listeners for 7-2 wins decrement buttons
                document.querySelectorAll('.seven-two-decrement-btn').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const playerId = e.target.dataset.playerId;
                        
                        try {
                            const response = await fetch(`/api/players/${playerId}/seven-two-wins/decrement`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || "Failed to decrement 7-2 wins");
                            }
                            
                            // Reload the session detail page to show updated stats
                            loadSessionDetail(sessionId);
                        } catch (error) {
                            console.error('Error decrementing 7-2 wins:', error);
                            alert(`Error: ${error.message}`);
                        }
                    });
                });

                const endSessionBtn = document.getElementById('end-session-btn');
                if (endSessionBtn) endSessionBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to end this session? This will finalize profits.")) {
                        try {
                            const response = await fetch(`/api/sessions/${sessionId}/end`, { method: 'PUT' });
                            if (!response.ok) throw new Error((await response.json()).error || "Failed to end session");
                            alert("Session ended successfully!");
                            loadSessionDetail(sessionId);
                        } catch (err) { alert(`Error: ${err.message}`); }
                    }
                });
            } else {
                // Add event listener for reactivate session button
                const reactivateSessionBtn = document.getElementById('reactivate-session-btn');
                if (reactivateSessionBtn) reactivateSessionBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to reactivate this session?")) {
                        try {
                            const response = await fetch(`/api/sessions/${sessionId}/reactivate`, { method: 'PUT' });
                            if (!response.ok) throw new Error((await response.json()).error || "Failed to reactivate session");
                            alert("Session reactivated successfully!");
                            loadSessionDetail(sessionId);
                        } catch (err) { alert(`Error: ${err.message}`); }
                    }
                });
            }

        } catch (error) {
            console.error(`Error loading session details for ${sessionId}:`, error);
            appContent.innerHTML = `<p>Could not load details for session ${sessionId}. ${error.message}</p>`;
        }
    }

    function router() {
        const path = window.location.hash.slice(1) || 'dashboard';
        loadContent(path);
    }

    async function loadContent(path) {
        appContent.innerHTML = `<p>Loading ${path}...</p>`;
        try {
            if (path === 'dashboard') {
                await loadDashboard();
            } else if (path === 'players') {
                await loadPlayers();
            } else if (path === 'sessions') {
                await loadSessions();
            } else if (path.startsWith('player/')) {
                const playerId = path.split('/')[1];
                await loadPlayerDetail(playerId);
            } else if (path.startsWith('session/')) {
                const sessionId = path.split('/')[1];
                await loadSessionDetail(sessionId);
            }
            else {
                appContent.innerHTML = '<h2>Page Not Found</h2>';
            }
        } catch (error) {
            console.error("Error loading content:", error);
            appContent.innerHTML = `<p>Error loading content: ${error.message}. Check console.</p>`;
        }
    }

    window.addEventListener('hashchange', router);
    router(); // Initial load

    // Handle mobile bottom navigation clicks
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active states
            document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Navigate to the page
            window.location.hash = this.dataset.hash;
        });
    });

    // Set active nav button based on current hash
    function updateActiveNavButton() {
        const currentHash = window.location.hash || '#dashboard';
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            if (btn.dataset.hash === currentHash) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Update active button on page load and hash change
    updateActiveNavButton();
    window.addEventListener('hashchange', updateActiveNavButton);
});