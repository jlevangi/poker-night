// Dashboard page module
import { staggerChildren, animateAllValues } from './animations.js';
import { formatCurrency, formatPercent, formatDate } from './formatters.js';
import { renderEmptyState, renderSkeleton, renderSkeletonPage, renderSkeletonRows, renderSkeletonStatGrid, showPageError } from './ui.js';

export default class DashboardPage {
    static skeleton() {
        return renderSkeletonPage([
            // Gamble King Banner Skeleton
            renderSkeleton({ classes: 'neo-card', style: 'height: 210px; margin-bottom: 1rem;' }),
            // Active Session Hero Skeleton
            renderSkeleton({ classes: 'neo-card', style: 'height: 96px; margin-bottom: 1rem;' }),
            // Quick Actions Skeleton (icon tiles)
            renderSkeletonStatGrid({ count: 4 }),
            // Metrics Strip Skeleton
            renderSkeletonStatGrid({ count: 3 }),
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
            showPageError(this.appContent, {
                message: 'Could not load the dashboard. ' + error.message,
                actionLabel: 'Try Again',
                onAction: () => this.load()
            });
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

                <!-- Next Event Card (promoted: "what's coming" pairs with "what's happening") -->
                ${data.nextEvent ? this.renderNextEventCard(data.nextEvent) : ''}

                <!-- Quick Actions and Stats Grid -->
                ${this.renderQuickActionsAndStatsGrid(data)}

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
                            <span class="neo-live-badge"><span class="neo-live-dot"></span>LIVE</span>
                            <span class="neo-card-eyebrow">Active Session</span>
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
            <a href="#calendar" class="neo-card neo-next-event-card list-card-row" style="text-decoration: none; color: inherit;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <div class="section-title" style="color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="neo-upcoming-badge"><span class="neo-upcoming-dot"></span>UPCOMING</span>
                            <span class="neo-card-eyebrow">Next Poker Night</span>
                        </div>
                        <div class="card-subtitle" style="margin-top: 0.25rem;">
                            ${dateFormatted}${timeFormatted}${event.location ? ' - ' + event.location : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <span style="background: var(--casino-green); color: #fff; padding: 0.25rem 0.5rem; border-radius: 50px; font-weight: 600; font-size: 0.75rem;">${counts.yes} In</span>
                        <span style="background: var(--casino-gold); color: #222; padding: 0.25rem 0.5rem; border-radius: 50px; font-weight: 600; font-size: 0.75rem;">${counts.maybe} Maybe</span>
                        <span style="background: var(--casino-red); color: #fff; padding: 0.25rem 0.5rem; border-radius: 50px; font-weight: 600; font-size: 0.75rem;">${counts.no} Out</span>
                    </div>
                </div>
            </a>
        `;
    }

    // Render quick actions: icon-led tiles wired to real routes/workflows
    // (view live session / start session, schedule poker night, players,
    // stats), followed by the neutral metric strip.
    static chipIcon() {
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="8.5"/>
            <circle cx="12" cy="12" r="4.2" stroke-width="1.3"/>
            <path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.8 1.8M16.2 16.2L18 18M18 6l-1.8 1.8M7.8 16.2L6 18"/>
        </svg>`;
    }

    static calendarIcon() {
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <rect x="3" y="5" width="18" height="16" rx="2.5"/>
            <path d="M3 9.5h18M8 3v4M16 3v4"/>
            <path d="M8 13.5h3M8 16.5h6"/>
        </svg>`;
    }

    static playersIcon() {
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <circle cx="9" cy="8" r="3.4"/>
            <path d="M2.5 20c.9-3.3 3.4-5.4 6.5-5.4s5.6 2.1 6.5 5.4"/>
            <circle cx="17.3" cy="9" r="2.6"/>
            <path d="M15.7 14.9c2.7.4 4.8 2.3 5.6 5.1"/>
        </svg>`;
    }

    static statsIcon() {
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
            <path d="M5 20v-6M10 20V6M15 20v-9M20 20v-3.5"/>
            <path d="M3 20.5h18"/>
        </svg>`;
    }

    renderQuickActionsAndStatsGrid(data) {
        const { totalGambled, totalPlayers, totalSessions, activeSession } = data;

        // Session tile: links to the live session when one is running,
        // otherwise opens the new-session modal (handler in setupEventListeners).
        const sessionTile = activeSession
            ? `<a href="#session/${activeSession.session_id}" class="neo-quick-action neo-quick-action--green">
                    <span class="neo-quick-action-icon">${DashboardPage.chipIcon()}</span>
                    <span class="neo-quick-action-label">View Live Session</span>
                </a>`
            : `<button id="quick-start-session-btn" class="neo-quick-action neo-quick-action--gold" type="button">
                    <span class="neo-quick-action-icon">${DashboardPage.chipIcon()}</span>
                    <span class="neo-quick-action-label">Start Session</span>
                </button>`;

        return `
            <section class="neo-quick-actions" aria-label="Quick actions">
                ${sessionTile}
                <a href="#calendar" class="neo-quick-action neo-quick-action--purple">
                    <span class="neo-quick-action-icon">${DashboardPage.calendarIcon()}</span>
                    <span class="neo-quick-action-label">Poker Night</span>
                </a>
                <a href="#players" class="neo-quick-action neo-quick-action--blue">
                    <span class="neo-quick-action-icon">${DashboardPage.playersIcon()}</span>
                    <span class="neo-quick-action-label">Players</span>
                </a>
                <a href="#stats" class="neo-quick-action neo-quick-action--red">
                    <span class="neo-quick-action-icon">${DashboardPage.statsIcon()}</span>
                    <span class="neo-quick-action-label">Stats</span>
                </a>
            </section>

            <div class="neo-stats-grid">
                <div class="neo-stat-card neo-stat-card--metric">
                    <div class="neo-stat-value" data-animate-value="${totalPlayers || 0}">${totalPlayers || 0}</div>
                    <div class="neo-stat-label">Players</div>
                </div>
                <div class="neo-stat-card neo-stat-card--metric">
                    <div class="neo-stat-value" data-animate-value="${totalGambled || 0}" data-animate-prefix="$" data-animate-decimals="2">${formatCurrency(totalGambled || 0)}</div>
                    <div class="neo-stat-label">Total Gambled</div>
                </div>
                <div class="neo-stat-card neo-stat-card--metric">
                    <div class="neo-stat-value" data-animate-value="${totalSessions || 0}">${totalSessions || 0}</div>
                    <div class="neo-stat-label">Sessions Played</div>
                </div>
            </div>
        `;
    }

    // Render Gamble King section
    // Render Gamble King section — the theatrical hero: crown, name, profit,
    // and compact supporting metrics.
    static crownIcon() {
        return `<svg class="neo-gamble-king-crown" viewBox="0 0 24 21" width="72" height="63" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M2.6 17.5 L1.2 5.4 L7.1 9.9 L12 2 L16.9 9.9 L22.8 5.4 L21.4 17.5 Z"/>
            <circle cx="1.2" cy="5.4" r="1.15"/>
            <circle cx="12" cy="2" r="1.15"/>
            <circle cx="22.8" cy="5.4" r="1.15"/>
            <rect x="2.6" y="17.5" width="18.8" height="2" rx="1"/>
        </svg>`;
    }

    renderGambleKingSection(gambleKing) {
        if (!gambleKing || gambleKing.net_profit <= 0) {
            return `
                <div class="neo-gamble-king neo-gamble-king--empty">
                    <div class="neo-gamble-king-top">
                        ${DashboardPage.crownIcon()}
                        <span class="neo-gamble-king-title">Current Gamble King</span>
                    </div>
                    <div class="neo-gamble-king-name">No Gamble King crowned yet</div>
                    <div class="neo-gamble-king-empty">Win a session to claim the throne.</div>
                </div>
            `;
        }

        const profit = gambleKing.net_profit || 0;

        return `
            <article class="neo-gamble-king" aria-label="Current Gamble King: ${gambleKing.name}">
                <div class="neo-gamble-king-top">
                    ${DashboardPage.crownIcon()}
                    <span class="neo-gamble-king-title">Current Gamble King</span>
                </div>
                <a class="neo-gamble-king-name" href="#player/${gambleKing.player_id}">${gambleKing.name}</a>
                <div class="neo-gamble-king-lead">
                    <div class="neo-gamble-king-lead-value">${formatCurrency(profit)}</div>
                    <div class="neo-gamble-king-lead-label">All-time profit</div>
                </div>
                <div class="neo-gamble-king-metrics">
                    <div class="neo-gamble-king-metric">
                        <div class="neo-gamble-king-metric-value">${gambleKing.games_played || 0}</div>
                        <div class="neo-gamble-king-metric-label">Sessions</div>
                    </div>
                    <div class="neo-gamble-king-metric">
                        <div class="neo-gamble-king-metric-value">${formatPercent(gambleKing.win_percentage || 0)}</div>
                        <div class="neo-gamble-king-metric-label">Win rate</div>
                    </div>
                    <div class="neo-gamble-king-metric">
                        <div class="neo-gamble-king-metric-value">${gambleKing.seven_two_wins || 0}</div>
                        <div class="neo-gamble-king-metric-label">7-2 wins</div>
                    </div>
                </div>
            </article>
        `;
    }
    
    // Render player standings section — compact top-3 podium only; the full
    // leaderboard lives on the players page (no report-like dump on home).
    renderStandingsSection(players) {
        if (!players || players.length === 0) {
            return `
                <div class="neo-card neo-standings-card">
                    <h3 class="section-title" style="margin-bottom: 1.5rem;">🏆 Top Players</h3>
                    ${renderEmptyState({ icon: '🏆', message: 'No players found.', card: false })}
                </div>
            `;
        }

        const top = players.slice(0, 3);

        let html = `
            <div class="neo-card neo-standings-card">
                <div class="neo-standings-head">
                    <h3 class="section-title">🏆 Top Players</h3>
                    <a href="#players" class="neo-standings-all">See all players →</a>
                </div>
                <div class="table-responsive">
                    <table class="neo-table neo-standings-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th class="text-right">Net Profit</th>
                                <th class="text-right">Win Rate</th>
                        </thead>
                        <tbody>
        `;

        top.forEach((player, index) => {
            const isGambleKing = index === 0 && player.net_profit > 0;
            html += `
                <tr${isGambleKing ? ' class="neo-standings-king--full"' : ''}>
                    <td class="neo-standings-rank${isGambleKing ? ' is-king' : ''}">${index + 1}</td>
                    <td>
                        <a href="#player/${player.player_id}" class="neo-standings-name">
                            ${player.name}
                            ${isGambleKing ? '<span aria-hidden="true">👑</span>' : ''}
                        </a>
                    </td>
                    <td class="text-right neo-standings-pl ${player.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                        ${formatCurrency(player.net_profit || 0)}
                    </td>
                    <td class="text-right neo-standings-winrate">${formatPercent(player.win_percentage || 0)}</td>
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
                <a href="#session/${session.session_id}" class="neo-card ${cardColor} list-card-row" style="text-decoration: none; color: inherit;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div class="list-card-text">
                                📅 ${formatDate(session.date)}
                            </div>
                            <div class="list-card-subtitle">
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
