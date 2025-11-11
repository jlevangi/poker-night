// Player detail page module
export default class PlayerDetailPage {    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }
      // Load player detail page
    async load(playerId) {
        try {
            // Fetch player data and history
            const player = await this.api.get(`players/${playerId}/stats`);
            const history = await this.api.get(`players/${playerId}/history`);
            player.sessions = this.processPlayerHistory(history);
            
            // Map API response properties to match template expectations
            player.id = player.player_id;
            player.totalProfit = player.net_profit;
            player.sessionsPlayed = player.games_played;
            player.winRate = player.win_percentage / 100; // Convert percentage to decimal
            
            // Render player details
            this.render(player);
        } catch (error) {
            console.error(`Error loading player details for ${playerId}:`, error);
            this.appContent.innerHTML = `<p>Could not load details for player ${playerId}. ${error.message}</p>`;
        }
    }
    
    // Process player history into session data
    processPlayerHistory(history) {
        if (!history || !Array.isArray(history)) return [];
        
        return history.map(entry => {
            return {
                sessionId: entry.session_id,
                date: entry.session_date,
                buyIn: entry.total_buy_in_amount || 0,
                cashOut: entry.payout || 0,
                profit: entry.profit || 0
            };
        });
    }
    
    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; // Return original if can't parse
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    // Render player detail content
    render(player) {
        const isTopPerformer = player.totalProfit > 0;
        
        let html = `
            <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <!-- Header with navigation -->
                <div style="margin-bottom: 2rem;">
                    <a href="#players" class="neo-btn neo-btn-purple">← Back to Players</a>
                </div>
                
                <!-- Player Header Card -->
                <div class="neo-card ${isTopPerformer ? 'neo-card-gold' : 'neo-card-primary'}">
                    <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: inherit; display: flex; align-items: center; gap: 1rem;">
                        ${player.name}
                    </h2>
                    
                    <!-- Main Stats Grid -->
                    <div class="neo-stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 1.5rem;">
                        <div class="neo-stat-card" style="border-color: ${player.totalProfit >= 0 ? 'var(--casino-green)' : 'var(--casino-red)'};">
                            <div class="neo-stat-value ${player.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$${player.totalProfit !== undefined ? player.totalProfit.toFixed(2) : '0.00'}</div>
                            <div class="neo-stat-label">Total Profit</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-purple);">
                            <div class="neo-stat-value">${player.sessionsPlayed || 0}</div>
                            <div class="neo-stat-label">Sessions Played</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-gold);">
                            <div class="neo-stat-value">${player.winRate !== undefined ? (player.winRate * 100).toFixed(0) : '0'}%</div>
                            <div class="neo-stat-label">Win Rate</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-gold);">
                            <div class="neo-stat-value">${player.seven_two_wins || 0}</div>
                            <div class="neo-stat-label">7-2 Wins Total</div>
                        </div>
                    </div>
                </div>
        `;
        
        // Add sessions section
        if (player.sessions && player.sessions.length > 0) {
            html += `
                <!-- Sessions History -->
                <div class="neo-card">
                    <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">📊 Session History</h3>
                    <div class="table-responsive">
                        <table class="neo-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Buy-In</th>
                                    <th>Cash Out</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
              player.sessions.forEach(session => {
                // Ensure buyIn and cashOut are defined before calculating profit
                const buyIn = session.buyIn || 0;
                const cashOut = session.cashOut || 0; 
                const profit = cashOut - buyIn;
                
                html += `
                    <tr>
                        <td><a href="#session/${session.sessionId}" style="color: var(--primary-color); text-decoration: none; font-weight: 700;">${this.formatDate(session.date)}</a></td>
                        <td style="font-weight: 700; color: var(--casino-red);">$${buyIn.toFixed(2)}</td>
                        <td style="font-weight: 700; color: var(--casino-gold);">$${cashOut.toFixed(2)}</td>
                        <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-weight: 700;">$${profit.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">📈</div>
                    <p style="font-size: 1.25rem; font-weight: 700; color: var(--text-secondary); margin: 0;">No sessions found for this player.</p>
                </div>
            `;
        }
        
        html += `
            </div>
        `;
        
        
        this.appContent.innerHTML = html;
        
        // Add event listeners
        this.setupEventListeners(player);
    }
    
    // Setup event listeners for the page
    setupEventListeners(player) {
        // No event listeners needed for player detail page
        // 7-2 win buttons are only available during active sessions
    }
}
