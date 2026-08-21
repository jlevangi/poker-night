// Dashboard page module
import { staggerChildren, animateAllValues } from './animations.js';
import { formatCurrency, formatPercent, formatDate } from './formatters.js';
import { renderEmptyState, renderSkeleton, renderSkeletonPage, renderSkeletonRows, renderSkeletonStatGrid } from './ui.js';

export default class DashboardPage {
    static skeleton() {
        return renderSkeletonPage([
            // Gamble King Banner Skeleton
            renderSkeleton({ classes: 'neo-card', style: 'height: 140px; margin-bottom: 1rem;' }),
            // Active Session Hero Skeleton
            renderSkeleton({ classes: 'neo-card', style: 'height: 96px; margin-bottom: 1rem;' }),
            // Stats Grid Skeleton (2x2)
            renderSkeletonStatGrid({ count: 4 }),
            // Standings Table Skeleton
            '<div class="neo-card" style="margin-bottom: 1rem;">' +
                renderSkeleton({ style: 'height: 1.25rem; width: 50%; margin-bottom: 1.5rem; border-radius: 4px;' }) +
                renderSkeletonRows({ count: 3 }) +
            '</div>',
            // Recent Sessions Skeleton
            '<div class="neo-card">' +
                renderSkeleton({ style: 'height: 1.25rem; width: 50%; margin-bottom: 1.5rem; border-radius: 4px;' }) +
                renderSkeletonRows({ count: 3, height: '4rem' }) +
            '</div>'
        ]);
    }

    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }
    
    // Load the dashboard page
    async load() {
        try {
            document.title = 'Gamble King';
            // Use the dedicated dashboard API endpoint for better performance
            // This gets all the dashboard data in a single optimized call
            const [dashboardData, players, activeSessions, upcomingEvents] = await Promise.all([
                this.api.get('dashboard'),
                this.api.get('players'),
                this.api.get('sessions/active'),
                this.api.get('events?upcoming=true').catch(() => [])
            ]);
            
            // Prepare dashboard data using the optimized dashboard API
            const data = {
                players: players || [],
                allSessions: dashboardData?.recent_sessions || [],
                recentSessions: dashboardData?.recent_sessions || [],
                activeSession: activeSessions && activeSessions.length > 0 ? activeSessions[0] : null,
                gambleKing: players && players.length > 0 ? players[0] : null,
                totalGambled: dashboardData?.total_buy_ins || 0,
                totalPlayers: dashboardData?.total_players || 0,
                totalSessions: dashboardData?.total_sessions || 0,
                nextEvent: upcomingEvents ? upcomingEvents.find(e => !e.is_cancelled) || null : null
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
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                
                <!-- Gamble King Section -->
                ${data.gambleKing ? this.renderGambleKingSection(data.gambleKing) : ''}

                <!-- Active Session Hero (leads: what's happening right now) -->
                ${data.activeSession ? this.renderActiveSessionCard(data.activeSession) : ''}

                <!-- Quick Actions and Stats Grid -->
                ${this.renderQuickActionsAndStatsGrid(data)}

                <!-- Next Event Card -->
                ${data.nextEvent ? this.renderNextEventCard(data.nextEvent) : ''}

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
    
    // Render active session hero card — answers "what's happening right now"
    renderActiveSessionCard(session) {
        const buyIn = formatCurrency(session.default_buy_in_value || 0);
        const heroHref = '#session/' + session.session_id;
        return `
            <a href="${heroHref}" class="neo-card neo-card-gold neo-active-session-hero">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <div class="section-title" style="color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="neo-live-badge">LIVE</span>
                            Active Session
                        </div>
                        <div class="card-subtitle" style="margin-top: 0.25rem;">
                            ${formatDate(session.date)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div class="neo-stat-value profit-positive" style="margin-bottom: 0;">${buyIn}</div>
                        <div class="neo-stat-label">to sit down</div>
                    </div>
                </div>
            </a>
        `;
    }

    // Render next upcoming event card
    renderNextEventCard(event) {
        const dateFormatted = formatDate(event.date);
        let timeFormatted = '';
        if (event.time) {
            const [hours, minutes] = event.time.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            timeFormatted = ` at ${h12}:${minutes} ${ampm}`;
        }
        const counts = event.rsvp_counts || { yes: 0, maybe: 0, no: 0 };

        return `
            <a href="#calendar" class="neo-card neo-next-event-card neo-card-primary" style="text-decoration: none; color: inherit; display: block; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <div class="section-title" style="color: var(--text-primary);">
                            Next Poker Night
                        </div>
                        <div class="card-subtitle" style="margin-top: 0.25rem;">
                            ${dateFormatted}${timeFormatted}${event.location ? ' - ' + event.location : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <span style="background: var(--casino-green); color: #fff; padding: 0.25rem 0.625rem; border-radius: 50px; font-weight: 600; font-size: 0.75rem;">${counts.yes} In</span>
                        <span style="background: var(--casino-gold); color: #222; padding: 0.25rem 0.625rem; border-radius: 50px; font-weight: 600; font-size: 0.75rem;">${counts.maybe} Maybe</span>
                        <span style="background: var(--casino-red); color: #fff; padding: 0.25rem 0.625rem; border-radius: 50px; font-weight: 600; font-size: 0.75rem;">${counts.no} Out</span>
                    </div>
                </div>
            </a>
        `;
    }

    // Render quick actions and stats in a 2x2 grid
    renderQuickActionsAndStatsGrid(data) {
        const { totalGambled, totalPlayers, totalSessions, activeSession } = data;
        
        return `
            <div class="neo-stats-grid">
                <!-- Quick Action / Players Tile (Top Left) -->
                ${activeSession ? `
                    <div class="neo-stat-card neo-card-primary">
                        <div class="neo-stat-value" data-animate-value="${totalPlayers || 0}">${totalPlayers || 0}</div>
                        <div class="neo-stat-label">Players</div>
                    </div>
                ` : `
                    <button id="quick-start-session-btn" class="neo-stat-card neo-card-primary" style="background: var(--bg-card); border: var(--neo-border); cursor: pointer; color: inherit; padding: var(--spacing-neo); text-align: center; position: relative; width: 100%; font-family: inherit;">
                        <div class="neo-stat-value">🃏</div>
                        <div class="neo-stat-label">Start New Session</div>
                    </button>
                `}
                <a href="#calendar" class="neo-stat-card neo-card-purple" style="text-decoration: none; cursor: pointer;">
                    <div class="neo-stat-value">📅</div>
                    <div class="neo-stat-label">Schedule Session</div>
                </a>

                <div class="neo-stat-card neo-card-gold">
                    <div class="neo-stat-value" data-animate-value="${totalGambled || 0}" data-animate-prefix="$" data-animate-decimals="2">${formatCurrency(totalGambled || 0)}</div>
                    <div class="neo-stat-label">Total Gambled</div>
                </div>

                <div class="neo-stat-card neo-card-green">
                    <div class="neo-stat-value" data-animate-value="${totalSessions || 0}">${totalSessions || 0}</div>
                    <div class="neo-stat-label">Sessions Played</div>
                </div>

            </div>
        `;
    }
    
    // Render Gamble King section
    renderGambleKingSection(gambleKing) {
        if (!gambleKing || gambleKing.net_profit <= 0) {
            return `
                <div class="neo-gamble-king">
                    <div class="neo-gamble-king-title">👑 Gamble King 👑</div>
                    <div style="text-align: center; font-size: 1.25rem; font-weight: 700; color: var(--casino-gold-dark);">
                        <strong>No Gamble King crowned yet!</strong><br>
                        <span style="font-size: 1rem; margin-top: 0.5rem; display: block;">Play some games to claim the throne!</span>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="neo-gamble-king neo-bounce">
                <div class="neo-gamble-king-title">Current Gamble King</div>
                <div class="neo-gamble-king-name">${gambleKing.name}</div>
                <div class="neo-stats-grid">
                    <div class="neo-stat-card" style="background: var(--bg-card);">
                        <div class="neo-stat-value profit-${gambleKing.net_profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(gambleKing.net_profit || 0)}</div>
                        <div class="neo-stat-label">Total Profit</div>
                    </div>
                    <div class="neo-stat-card" style="background: var(--bg-card);">
                        <div class="neo-stat-value">${gambleKing.games_played || 0}</div>
                        <div class="neo-stat-label">Sessions</div>
                    </div>
                    <div class="neo-stat-card" style="background: var(--bg-card);">
                        <div class="neo-stat-value">${formatPercent(gambleKing.win_percentage || 0)}</div>
                        <div class="neo-stat-label">Win Rate</div>
                    </div>
                    <div class="neo-stat-card" style="background: var(--bg-card);">
                        <div class="neo-stat-value">${gambleKing.seven_two_wins || 0}</div>
                        <div class="neo-stat-label">7-2 Wins</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render player standings section
    renderStandingsSection(players) {
        if (!players || players.length === 0) {
            return `
                <div class="neo-card">
                    <h3 class="section-title" style="margin-bottom: 1.5rem;">🏆 Player Standings</h3>
                    ${renderEmptyState({ icon: '🏆', message: 'No players found.', card: false })}
                </div>
            `;
        }
        
        let html = `
            <div class="neo-card">
                <h3 class="section-title" style="margin-bottom: 1.5rem;">🏆 Player Standings</h3>
                <div class="table-responsive">
                    <table class="neo-table">
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
                <tr${isGambleKing ? ' style="background: var(--casino-gold-light);"' : ''}>
                    <td style="font-weight: 600;">${index + 1}</td>
                    <td>
                        <a href="#player/${player.player_id}" style="color: var(--link-color); text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                            ${player.name}
                            ${isGambleKing ? '<span style="font-size: 1.2rem;">👑</span>' : ''}
                        </a>
                    </td>
                    <td class="${player.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-weight: 600;">
                        ${formatCurrency(player.net_profit || 0)}
                    </td>
                    <td style="font-weight: 600;">${formatPercent(player.win_percentage || 0)}</td>
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
    
    
    // Render recent sessions section
    renderRecentSessionsSection(sessions) {
        if (!sessions || sessions.length === 0) {
            return `
                <div class="neo-card">
                    <h3 class="section-title" style="margin-bottom: 1.5rem;">🃏 Recent Sessions</h3>
                    ${renderEmptyState({ icon: '🃏', message: 'No recent sessions found.', card: false })}
                </div>
            `;
        }
        
        let html = `
            <div class="neo-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 class="section-title" style="margin: 0;">🃏 Recent Sessions</h3>
                    <a href="#sessions" class="neo-btn neo-btn-sm neo-btn-purple">View All</a>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
        `;
        
        sessions.forEach(session => {
            const statusColor = session.is_active ? 'var(--casino-green)' : 'var(--text-secondary)';
            const statusText = session.is_active ? 'Active' : 'Ended';
            const statusIcon = session.is_active ? '🟢' : '⚪';
            
            const cardColor = session.is_active ? 'neo-card-gold' : '';
            
            html += `
                <a href="#session/${session.session_id}" class="neo-card ${cardColor}" style="text-decoration: none; color: inherit; padding: 1rem; margin: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: inherit; margin-bottom: 0.25rem; font-size: 1.125rem;">
                                📅 ${formatDate(session.date)}
                            </div>
                            <div style="font-size: 0.875rem; color: inherit; font-weight: 600; opacity: 0.8;">
                                Buy-in: ${formatCurrency(session.default_buy_in_value || 0)}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: ${statusColor}; font-size: 1.25rem;">${statusIcon}</span>
                            <span style="font-size: 0.875rem; font-weight: 600; color: ${statusColor};">
                                ${statusText}
                            </span>
                        </div>
                    </div>
                </a>
            `;
        });
        
        html += `
                </div>
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

        // Animate cards and values
        staggerChildren(this.appContent, '.neo-card', 60);
        animateAllValues(this.appContent);
    }
}
