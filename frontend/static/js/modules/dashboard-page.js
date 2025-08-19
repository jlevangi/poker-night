// Dashboard page module
export default class DashboardPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }
    
    // Load the dashboard page
    async load() {
        try {
            // Fetch data from existing API endpoints
            const players = await this.api.get('players');
            const sessions = await this.api.get('sessions');
            const activeSessions = await this.api.get('sessions/active');
            
            // Prepare dashboard data
            const data = {
                players: players || [],
                recentSessions: sessions ? sessions.slice(0, 5) : [],
                activeSession: activeSessions && activeSessions.length > 0 ? activeSessions[0] : null,
                gambleKing: players && players.length > 0 ? players[0] : null
            };
            
            // Render the dashboard
            this.render(data);
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.appContent.innerHTML = `<p>Error loading dashboard: ${error.message}</p>`;
        }
    }
    
    // Render dashboard content
    render(data) {
        let html = `
            <div class="dashboard-header">
                <h2>Poker Dashboard</h2>
            </div>
        `;
        
        // Add Gamble King section if one exists
        if (data.gambleKing) {
            html += this.renderGambleKingSection(data.gambleKing);
        }
        
        // Add quick action buttons
        html += this.renderQuickActionsSection(data.activeSession);
        
        // Add standings table
        html += this.renderStandingsSection(data.players);
        
        // Add recent sessions section
        html += this.renderRecentSessionsSection(data.recentSessions);
        
        this.appContent.innerHTML = html;
        
        // Add event listeners to buttons after rendering
        this.setupEventListeners(data.activeSession);
    }
    
    // Render Gamble King section
    renderGambleKingSection(gambleKing) {
        if (!gambleKing || gambleKing.net_profit <= 0) {
            return `
                <div class="gamble-king-container">
                    <h2>Gamble King</h2>
                    <p>No Gamble King crowned yet! Play some games to claim the throne!</p>
                </div>
            `;
        }
        
        return `
            <div class="gamble-king-container">
                <h2>Current Gamble King</h2>
                <div class="gamble-king-name gamble-king-name-dash">${gambleKing.name}</div>                
                <div class="gamble-king-stats">
                    <p>Total Profit: <strong class="${gambleKing.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${gambleKing.net_profit ? gambleKing.net_profit.toFixed(2) : '0.00'}</strong></p>
                    <p>Sessions Played: <strong>${gambleKing.games_played || 0}</strong></p>
                    <p>Win Rate: <strong>${gambleKing.win_percentage ? gambleKing.win_percentage.toFixed(1) : '0'}%</strong></p>
                    ${gambleKing.seven_two_wins ? `<p>7-2 Wins (Total): <strong>${gambleKing.seven_two_wins}</strong></p>` : ''}
                </div>
            </div>
        `;
    }
    
    // Render quick action buttons
    renderQuickActionsSection(activeSession) {
        let html = `<div class="quick-actions">`;
        
        if (activeSession) {
            html += `
                <a href="#session/${activeSession.session_id}" class="quick-action-btn active-session-btn">
                    View Active Session
                </a>
            `;
        } else {
            html += `
                <button id="quick-start-session-btn" class="quick-action-btn">
                    Start New Session
                </button>
            `;
        }
        
        html += `
            <a href="#players" class="quick-action-btn">Manage Players</a>
            <a href="#sessions" class="quick-action-btn">View All Sessions</a>
        </div>`;
        
        return html;
    }
    
    // Render player standings section
    renderStandingsSection(players) {
        if (!players || players.length === 0) {
            return `<h3>Player Standings</h3><p>No players found.</p>`;
        }
        
        let html = `
            <h3>Player Standings</h3>
            <div class="table-responsive">
                <table class="players-dashboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Profit</th>
                            <th>Win Rate</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        players.forEach((player, index) => {
            const isGambleKing = index === 0 && player.net_profit > 0;
            html += `
                <tr class="${isGambleKing ? 'gamble-king-row' : ''}">
                    <td>${index + 1}</td>
                    <td>
                        <a href="#player/${player.player_id}">
                            ${isGambleKing ? '<span class="crown-icon">👑</span>' : ''}
                            ${player.name}
                        </a>
                    </td>                    
                    <td class="${player.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                        $${player.net_profit ? player.net_profit.toFixed(2) : '0.00'}
                    </td>
                    <td>${player.win_percentage ? player.win_percentage.toFixed(1) : '0'}%</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }
    
    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown Date';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    // Render recent sessions section
    renderRecentSessionsSection(sessions) {
        if (!sessions || sessions.length === 0) {
            return `<h3>Recent Sessions</h3><p>No recent sessions found.</p>`;
        }
        
        let html = `
            <h3>Recent Sessions</h3>
            <ul class="sessions-list">
        `;
        
        sessions.forEach(session => {
            html += `                <li class="session-item">
                    <a href="#session/${session.session_id}" class="session-link">
                        <span class="session-date">${this.formatDate(session.date)}</span>
                        <span class="session-buyin">Buy-in: $${session.default_buy_in_value ? session.default_buy_in_value.toFixed(2) : '0.00'}</span>
                        <span class="session-total-value">${session.is_active ? 'Active' : 'Ended'}</span>
                    </a>                    
                    <span class="session-status status-${session.is_active ? 'active' : 'ended'}">
                        ${session.is_active ? 'Active' : 'Ended'}
                    </span>
                </li>
            `;
        });
        
        html += `
            </ul>
            <p><a href="#sessions">View all sessions</a></p>
        `;
        
        return html;
    }
    
    // Setup event listeners for buttons
    setupEventListeners(activeSession) {
        if (!activeSession) {
            const quickStartBtn = document.getElementById('quick-start-session-btn');
            if (quickStartBtn) {
                quickStartBtn.addEventListener('click', () => {
                    // Trigger new session modal
                    document.dispatchEvent(new CustomEvent('showNewSessionModal'));
                });
            }
        }
    }
}
