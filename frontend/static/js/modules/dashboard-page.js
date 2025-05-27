// Dashboard page module
export default class DashboardPage {    
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }
    
    // Load the dashboard page
    async load() {
        try {
            // Fetch dashboard data using API service
            const data = await this.api.get('dashboard');
            
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
        return `
            <div class="gamble-king-container">
                <h2>Current Gamble King</h2>
                <div class="gamble-king-name gamble-king-name-dash">${gambleKing.name}</div>                
                <div class="gamble-king-stats">
                    <p>Total Profit: <strong class="${gambleKing.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$${gambleKing.totalProfit !== undefined ? gambleKing.totalProfit.toFixed(2) : '0.00'}</strong></p>
                    <p>Sessions Played: <strong>${gambleKing.sessionsPlayed || 0}</strong></p>
                    <p>Win Rate: <strong>${gambleKing.winRate !== undefined ? (gambleKing.winRate * 100).toFixed(0) : '0'}%</strong></p>
                    ${gambleKing.sevenTwoWins ? `<p>7-2 Wins: <strong>${gambleKing.sevenTwoWins}</strong></p>` : ''}
                </div>
            </div>
        `;
    }
    
    // Render quick action buttons
    renderQuickActionsSection(activeSession) {
        let html = `<div class="quick-actions">`;
        
        if (activeSession) {
            html += `
                <a href="#session/${activeSession.id}" class="quick-action-btn active-session-btn">
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
            const isGambleKing = index === 0;
            html += `
                <tr class="${isGambleKing ? 'gamble-king-row' : ''}">
                    <td>${index + 1}</td>
                    <td>
                        <a href="#player/${player.id}">
                            ${isGambleKing ? '<span class="crown-icon">👑</span>' : ''}
                            ${player.name}
                        </a>
                    </td>                    
                    <td class="${player.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
                        $${player.totalProfit !== undefined ? player.totalProfit.toFixed(2) : '0.00'}
                    </td>
                    <td>${player.winRate !== undefined ? (player.winRate * 100).toFixed(0) : '0'}%</td>
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
                    <a href="#session/${session.id}" class="session-link">
                        <span class="session-date">${this.formatDate(session.date)}</span>
                        <span class="session-buyin">Buy-in: $${session.buyin ? session.buyin.toFixed(2) : '0.00'}</span>
                        <span class="session-total-value">Total: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</span>
                    </a>                    
                    <span class="session-status status-${session.status && typeof session.status === 'string' ? session.status.toLowerCase() : 'unknown'}">
                        ${session.status || 'Unknown'}
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
