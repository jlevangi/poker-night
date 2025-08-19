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
            
            // Calculate total gambled by fetching detailed session data with entries
            let totalGambled = 0;
            console.log(`Dashboard: Found ${sessions ? sessions.length : 0} sessions to process`);
            
            if (sessions && sessions.length > 0) {
                for (const session of sessions) {
                    try {
                        const sessionDetails = await this.api.get(`sessions/${session.session_id}`);
                        if (sessionDetails && sessionDetails.entries && sessionDetails.entries.length > 0) {
                            
                            const sessionTotal = sessionDetails.entries.reduce((sum, entry) => {
                                // Use the total_buy_in_amount field which contains the actual amount spent
                                const playerTotal = entry.total_buy_in_amount || 0;
                                console.log(`${entry.player_name}: $${playerTotal} (${entry.buy_in_count} buy-ins)`);
                                return sum + playerTotal;
                            }, 0);
                            
                            totalGambled += sessionTotal;
                            console.log(`Session ${session.session_id}: ${sessionDetails.entries.length} entries, total: $${sessionTotal}`);
                        } else {
                            console.log(`Session ${session.session_id}: No entries found`);
                        }
                    } catch (sessionError) {
                        console.warn(`Could not fetch session details for ${session.session_id}:`, sessionError);
                    }
                }
            }
            
            console.log(`Dashboard: Total gambled calculated as: $${totalGambled}`)
            
            // Prepare dashboard data
            const data = {
                players: players || [],
                allSessions: sessions || [],
                recentSessions: sessions ? sessions.slice(0, 5) : [],
                activeSession: activeSessions && activeSessions.length > 0 ? activeSessions[0] : null,
                gambleKing: players && players.length > 0 ? players[0] : null,
                totalGambled: totalGambled
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
            <div class="fade-in">
                <div style="text-align: center; margin-bottom: 2rem; position: relative;">
                    <h2 style="font-size: 2rem; font-weight: 700; color: var(--neutral-800); margin-bottom: 0.5rem; border: none; padding: 0;">
                        Dashboard
                    </h2>
                    <a href="/admin/" target="_blank" class="settings-btn" style="position: absolute; top: 0; right: 0; width: 40px; height: 40px; background: var(--neutral-100); border: 1px solid var(--neutral-200); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--neutral-600); text-decoration: none; font-size: 1.2rem; transition: all 0.2s ease; hover: transform: scale(1.05);" onmouseover="this.style.background='var(--neutral-200)'; this.style.color='var(--neutral-800)'" onmouseout="this.style.background='var(--neutral-100)'; this.style.color='var(--neutral-600)'" title="Admin Settings">⚙️</a>
                </div>
                
                <!-- Gamble King Section -->
                ${data.gambleKing ? this.renderGambleKingSection(data.gambleKing) : ''}
                
                <!-- Quick Actions Section -->
                ${this.renderQuickActionsSection(data.activeSession)}
                
                <!-- Stats Overview -->
                ${this.renderStatsOverview(data)}
                
                <!-- Top Players Section -->
                ${this.renderStandingsSection(data.players)}
                
                <!-- Recent Sessions Section -->
                ${this.renderRecentSessionsSection(data.recentSessions)}
            </div>
        `;
        
        this.appContent.innerHTML = html;
        
        // Add event listeners to buttons after rendering
        this.setupEventListeners(data.activeSession);
    }
    
    // Render stats overview section
    renderStatsOverview(data) {
        const { players, allSessions, totalGambled } = data;
        
        const totalPlayers = players ? players.length : 0;
        const totalSessions = allSessions ? allSessions.length : 0;
        
        return `
            <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1.5rem;">
                <div class="stat-card" style="padding: 1rem; text-align: center; border: 1px solid var(--neutral-200); background: white;">
                    <span class="stat-value" style="font-size: 1.5rem; font-weight: 600;">${totalPlayers}</span>
                    <span class="stat-label" style="font-size: 0.75rem;">Total Players</span>
                </div>
                <div class="stat-card" style="padding: 1rem; text-align: center; border: 1px solid var(--neutral-200); background: white;">
                    <span class="stat-value" style="font-size: 1.5rem; font-weight: 600;">${totalSessions}</span>
                    <span class="stat-label" style="font-size: 0.75rem;">Sessions Played</span>
                </div>
                <div class="stat-card" style="padding: 1rem; text-align: center; border: 1px solid var(--neutral-200); background: white;">
                    <span class="stat-value" style="font-size: 1.5rem; font-weight: 600; color: var(--neutral-800);">$${totalGambled ? totalGambled.toFixed(2) : '0.00'}</span>
                    <span class="stat-label" style="font-size: 0.75rem;">Total Gambled</span>
                </div>
            </div>
        `;
    }
    
    // Render Gamble King section
    renderGambleKingSection(gambleKing) {
        if (!gambleKing || gambleKing.net_profit <= 0) {
            return `
                <div class="ui-card" style="background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); border: 2px solid #f59e0b; margin-bottom: 2rem;">
                    <div class="ui-card-header" style="border-bottom: 1px solid #f59e0b;">
                        <h3 class="ui-card-title" style="font-size: 1.5rem; color: #d97706;">👑 Gamble King</h3>
                    </div>
                    <div style="text-align: center; padding: 2rem; font-size: 1.125rem; color: #92400e;">
                        <strong>No Gamble King crowned yet!</strong><br>
                        <span style="font-size: 1rem; color: #a16207;">Play some games to claim the throne!</span>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="ui-card" style="background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); border: 3px solid #f59e0b; margin-bottom: 1.5rem; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.1), 0 4px 6px -2px rgba(245, 158, 11, 0.04);">
                <div style="text-align: center; padding: 1.25rem 1.5rem 0.5rem 1.5rem;">
                    <h3 style="font-size: 1.5rem; color: #d97706; font-weight: 800; margin: 0 0 0.75rem 0;">
                        👑 CURRENT GAMBLE KING 👑
                    </h3>
                    <div class="gamble-king-name" style="font-size: 2.25rem; font-weight: 900; background: linear-gradient(45deg, #d97706, #f59e0b, #fbbf24, #f59e0b, #d97706); background-size: 300% 300%; -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 1rem; text-align: center; animation: goldShine 3s ease-in-out infinite;">
                        ${gambleKing.name}
                    </div>
                </div>
                <div style="padding: 0 1.5rem 1.5rem 1.5rem;">
                    <div class="gamble-king-stats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">
                        <div style="background: white; border: 2px solid #f59e0b; border-left: 2px solid #f59e0b; padding: 1rem; text-align: center; border-radius: var(--radius-lg);">
                            <span class="stat-value profit-${gambleKing.net_profit >= 0 ? 'positive' : 'negative'}" style="font-size: 1.5rem; font-weight: 800; display: block;">$${gambleKing.net_profit ? gambleKing.net_profit.toFixed(2) : '0.00'}</span>
                            <span class="stat-label" style="color: #92400e; font-weight: 600; font-size: 0.75rem; display: block;">Total Profit</span>
                        </div>
                        <div style="background: white; border: 2px solid #f59e0b; border-left: 2px solid #f59e0b; padding: 1rem; text-align: center; border-radius: var(--radius-lg);">
                            <span class="stat-value" style="font-size: 1.5rem; font-weight: 800; color: #d97706; display: block;">${gambleKing.games_played || 0}</span>
                            <span class="stat-label" style="color: #92400e; font-weight: 600; font-size: 0.75rem; display: block;">Sessions</span>
                        </div>
                        <div style="background: white; border: 2px solid #f59e0b; border-left: 2px solid #f59e0b; padding: 1rem; text-align: center; border-radius: var(--radius-lg);">
                            <span class="stat-value" style="font-size: 1.5rem; font-weight: 800; color: #d97706; display: block;">${gambleKing.win_percentage ? gambleKing.win_percentage.toFixed(1) : '0'}%</span>
                            <span class="stat-label" style="color: #92400e; font-weight: 600; font-size: 0.75rem; display: block;">Win Rate</span>
                        </div>
                        <div style="background: white; border: 2px solid #f59e0b; border-left: 2px solid #f59e0b; padding: 1rem; text-align: center; border-radius: var(--radius-lg);">
                            <span class="stat-value" style="font-size: 1.5rem; font-weight: 800; color: #d97706; display: block;">${gambleKing.seven_two_wins || 0}</span>
                            <span class="stat-label" style="color: #92400e; font-weight: 600; font-size: 0.75rem; display: block;">7-2 Wins</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render quick action buttons
    renderQuickActionsSection(activeSession) {
        return `
            <div class="ui-card">
                <div class="ui-card-header">
                    <h3 class="ui-card-title">Quick Actions</h3>
                </div>
                <div class="quick-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
                    ${activeSession ? `
                        <a href="#session/${activeSession.session_id}" class="btn btn-primary btn-lg ripple hover-lift" style="flex: 1; min-width: 140px; max-width: 300px; text-align: center; white-space: normal; line-height: 1.3; padding: 1rem 0.75rem;">
                            <span style="display: block;">🎯</span>
                            <span style="display: block; font-size: 0.9rem;">View Active Session</span>
                        </a>
                        <a href="#sessions" class="btn btn-secondary ripple hover-lift" style="flex: 1; min-width: 120px; max-width: 200px; text-align: center; white-space: normal; line-height: 1.3; padding: 1rem 0.75rem;">
                            <span style="display: block;">📊</span>
                            <span style="display: block; font-size: 0.9rem;">All Sessions</span>
                        </a>
                    ` : `
                        <button id="quick-start-session-btn" class="btn btn-primary btn-lg ripple hover-lift" style="flex: 1; min-width: 140px; max-width: 300px; text-align: center; white-space: normal; line-height: 1.3; padding: 1rem 0.75rem;">
                            <span style="display: block;">🎮</span>
                            <span style="display: block; font-size: 0.9rem;">Start New Session</span>
                        </button>
                        <a href="#sessions" class="btn btn-secondary ripple hover-lift" style="flex: 1; min-width: 120px; max-width: 200px; text-align: center; white-space: normal; line-height: 1.3; padding: 1rem 0.75rem;">
                            <span style="display: block;">📊</span>
                            <span style="display: block; font-size: 0.9rem;">View Sessions</span>
                        </a>
                    `}
                    <a href="#players" class="btn btn-secondary ripple hover-lift" style="flex: 1; min-width: 120px; max-width: 200px; text-align: center; white-space: normal; line-height: 1.3; padding: 1rem 0.75rem;">
                        <span style="display: block;">👥</span>
                        <span style="display: block; font-size: 0.9rem;">Manage Players</span>
                    </a>
                </div>
            </div>
        `;
    }
    
    // Render player standings section
    renderStandingsSection(players) {
        if (!players || players.length === 0) {
            return `
                <div class="ui-card">
                    <div class="ui-card-header">
                        <h3 class="ui-card-title">Player Standings</h3>
                    </div>
                    <p>No players found.</p>
                </div>
            `;
        }
        
        let html = `
            <div class="ui-card">
                <div class="ui-card-header">
                    <h3 class="ui-card-title">🏆 Player Standings</h3>
                </div>
                <div class="table-responsive">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Net Profit</th>
                                <th>Win Rate</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        players.forEach((player, index) => {
            const isGambleKing = index === 0 && player.net_profit > 0;
            html += `
                <tr${isGambleKing ? ' style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%);"' : ''}>
                    <td style="font-weight: 600; color: var(--neutral-700);">${index + 1}</td>
                    <td>
                        <a href="#player/${player.player_id}" style="color: var(--primary-color); text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
                            ${player.name}
                            ${isGambleKing ? '<span style="font-size: 1.2rem;">👑</span>' : ''}
                        </a>
                    </td>                    
                    <td class="${player.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-weight: 600;">
                        $${player.net_profit ? player.net_profit.toFixed(2) : '0.00'}
                    </td>
                    <td style="font-weight: 500; color: var(--neutral-600);">${player.win_percentage ? player.win_percentage.toFixed(1) : '0'}%</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
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
            return `
                <div class="ui-card">
                    <div class="ui-card-header">
                        <h3 class="ui-card-title">Recent Sessions</h3>
                    </div>
                    <p>No recent sessions found.</p>
                </div>
            `;
        }
        
        let html = `
            <div class="ui-card">
                <div class="ui-card-header">
                    <h3 class="ui-card-title">🃏 Recent Sessions</h3>
                    <a href="#sessions" class="btn btn-sm btn-secondary">View All</a>
                </div>
                <ul class="modern-list">
        `;
        
        sessions.forEach(session => {
            const statusColor = session.is_active ? 'var(--success-color)' : 'var(--neutral-500)';
            const statusText = session.is_active ? 'Active' : 'Ended';
            const statusIcon = session.is_active ? '🟢' : '⚪';
            
            html += `
                <li class="modern-list-item">
                    <a href="#session/${session.session_id}" style="text-decoration: none; color: inherit; display: block;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600; color: var(--neutral-800); margin-bottom: 0.25rem;">
                                    ${this.formatDate(session.date)}
                                </div>
                                <div style="font-size: 0.875rem; color: var(--neutral-600);">
                                    Buy-in: $${session.default_buy_in_value ? session.default_buy_in_value.toFixed(2) : '0.00'}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${statusColor};">${statusIcon}</span>
                                <span style="font-size: 0.875rem; font-weight: 500; color: ${statusColor};">
                                    ${statusText}
                                </span>
                            </div>
                        </div>
                    </a>
                </li>
            `;
        });
        
        html += `
                </ul>
            </div>
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
