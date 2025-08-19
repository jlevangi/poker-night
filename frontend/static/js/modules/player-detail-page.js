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
    
    // Render player detail content
    render(player) {
        let html = `
            <h2>Player Details: ${player.name}</h2>
              <div class="player-stats-summary">
                <p>Total Profit: <span class="${player.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$${player.totalProfit !== undefined ? player.totalProfit.toFixed(2) : '0.00'}</span></p>
                <p>Sessions Played: ${player.sessionsPlayed || 0}</p>
                <p>Win Rate: ${player.winRate !== undefined ? (player.winRate * 100).toFixed(0) : '0'}%</p>
            </div>
            
            <div class="seven-two-stats-detail">
                <span class="seven-two-label">7-2 Wins (Total):</span>
                <span class="seven-two-value">${player.seven_two_wins || 0}</span>
                <div class="seven-two-buttons">
                    <button class="seven-two-increment-btn" data-player-id="${player.id}">+</button>
                    <button class="seven-two-decrement-btn" data-player-id="${player.id}">-</button>
                </div>
            </div>
        `;
        
        // Add sessions section
        if (player.sessions && player.sessions.length > 0) {
            html += `
                <h3>Sessions</h3>
                <div class="table-responsive">
                    <table class="players-stats-table">
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
                        <td><a href="#session/${session.sessionId}">${session.date}</a></td>
                        <td>$${buyIn.toFixed(2)}</td>
                        <td>$${cashOut.toFixed(2)}</td>
                        <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            html += `<p>No sessions found for this player.</p>`;
        }
        
        html += `<p><a href="#players">&laquo; Back to Players</a></p>`;
        
        this.appContent.innerHTML = html;
        
        // Add event listeners
        this.setupEventListeners(player);
    }
    
    // Setup event listeners for the page
    setupEventListeners(player) {
        // 7-2 increment button
        const incrementBtn = document.querySelector('.seven-two-increment-btn');
        if (incrementBtn) {
            incrementBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`/api/players/${player.id}/seven-two-wins/increment`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to increment 7-2 wins");
                    }
                    
                    // Reload the player detail page
                    this.load(player.id);
                } catch (error) {
                    console.error('Error incrementing 7-2 wins:', error);
                    alert(`Error: ${error.message}`);
                }
            });
        }
        
        // 7-2 decrement button
        const decrementBtn = document.querySelector('.seven-two-decrement-btn');
        if (decrementBtn) {
            decrementBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`/api/players/${player.id}/seven-two-wins/decrement`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to decrement 7-2 wins");
                    }
                    
                    // Reload the player detail page
                    this.load(player.id);
                } catch (error) {
                    console.error('Error decrementing 7-2 wins:', error);
                    alert(`Error: ${error.message}`);
                }
            });
        }
    }
}
