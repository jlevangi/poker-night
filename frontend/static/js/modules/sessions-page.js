// Sessions page module
import { staggerChildren } from './animations.js';
import { formatCurrency, formatDate } from './formatters.js';
import { renderEmptyState, renderSkeleton, renderSkeletonPage, showPageError } from './ui.js';

export default class SessionsPage {
    static skeleton() {
        let cards = '';
        for (let i = 0; i < 5; i++) {
            cards += renderSkeleton({ classes: 'neo-card', style: 'height: 4.5rem;' });
        }
        return renderSkeletonPage([
            // Title Skeleton
            renderSkeleton({ style: 'height: 2.5rem; width: 40%; margin-bottom: 2rem; border-radius: 4px;' }),
            // Create Button Skeleton
            renderSkeleton({ classes: 'neo-card', style: 'height: 4rem; margin-bottom: 2rem;' }),
            // Session Card Skeletons
            renderSkeleton({ style: 'height: 1.75rem; width: 30%; margin-bottom: 1.5rem; border-radius: 4px;' }),
            '<div class="skeleton-list">' + cards + '</div>'
        ]);
    }

    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }

    // Load the sessions page
    async load() {
        try {
            document.title = 'Sessions - Gamble King';
            // Fetch sessions and upcoming events in parallel
            const [data, events] = await Promise.all([
                this.api.get('sessions'),
                this.api.get('events?upcoming=true').catch(() => [])
            ]);

            // Map API response to match template expectations
            const mappedSessions = data.map(session => ({
                ...session,
                id: session.session_id,
                buyin: session.default_buy_in_value,
                totalValue: session.total_value || 0,
                unpaidValue: 0 // Sessions list doesn't include calculated totals
            }));

            // Map upcoming events (without a session yet) as upcoming entries
            const upcomingEvents = (events || [])
                .filter(evt => !evt.is_cancelled)
                .map(evt => ({
                    type: 'upcoming',
                    event_id: evt.event_id,
                    date: evt.date,
                    title: evt.title || 'Poker Night',
                    buyin: evt.default_buy_in_value || 20,
                    rsvp_counts: evt.rsvp_counts || { yes: 0, maybe: 0, no: 0 },
                    status: 'UPCOMING'
                }));

            // Render the sessions page
            this.render(mappedSessions, upcomingEvents);
        } catch (error) {
            console.error('Error loading sessions:', error);
            showPageError(this.appContent, {
                message: 'Could not load the sessions list. ' + error.message,
                actionLabel: 'Try Again',
                onAction: () => this.load()
            });
        }
    }

    // Render sessions content
    render(sessions, upcomingEvents = []) {
        let html = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 class="page-title">🃏 Sessions</h2>

                <div class="neo-card neo-card-green" style="margin-bottom: 2rem; text-align: center;">
                    <div class="modal-actions">
                        <button id="create-session-btn" class="neo-btn neo-btn-green neo-btn-lg">+ Create Session</button>
                        <a href="#import" id="import-session-btn" class="neo-btn neo-btn-lg">📥 Import Log</a>
                    </div>
                </div>
        `;

        // Active sessions section (shown at top)
        const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
        if (activeSessions.length > 0) {
            html += `
                <h3 class="section-title" style="font-size: 1.5rem; margin-bottom: 1.5rem;">Active Sessions</h3>
                <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
            `;

            activeSessions.forEach(session => {
                html += `
                    <a href="#session/${session.session_id}" class="neo-card neo-card-gold list-card-row" style="text-decoration: none; color: inherit;">
                        <div>
                            <div class="list-card-text">
                                📅 ${formatDate(session.date)}
                            </div>
                            <div class="list-card-subtitle">
                                Buy-in: ${formatCurrency(session.buyin)} | Total: ${formatCurrency(session.totalValue)}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: var(--casino-gold); font-size: 1.25rem;">🟡</span>
                            <span style="font-size: 0.875rem; font-weight: 600; color: var(--casino-gold);">
                                ACTIVE
                            </span>
                        </div>
                    </a>
                `;
            });

            html += `</div>`;
        }

        // Upcoming events section
        if (upcomingEvents.length > 0) {
            html += `
                <h3 class="section-title" style="font-size: 1.5rem; margin-bottom: 1.5rem;">Upcoming</h3>
                <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
            `;

            upcomingEvents.forEach(evt => {
                const playerCount = evt.rsvp_counts.yes + evt.rsvp_counts.maybe + evt.rsvp_counts.no;
                html += `
                    <a href="#event/${evt.event_id}" class="neo-card neo-card-purple list-card-row" style="text-decoration: none; color: inherit;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div class="list-card-text">
                                    ${this.escapeHtml(evt.title)} — ${formatDate(evt.date)}
                                </div>
                                <div class="list-card-subtitle">
                                    Buy-in: ${formatCurrency(evt.buyin)}${playerCount > 0 ? ` | ${playerCount} player${playerCount !== 1 ? 's' : ''} responding` : ''}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 1.25rem;">🟠</span>
                                <span style="font-size: 0.875rem; font-weight: 600; color: #fff;">
                                    Upcoming
                                </span>
                            </div>
                        </div>
                    </a>
                `;
            });

            html += `</div>`;
        }

        // Past/active sessions section
        html += `
                <h3 class="section-title" style="font-size: 1.5rem; margin-bottom: 1.5rem;">All Sessions</h3>
        `;

        if (sessions && sessions.length > 0) {
            html += `<div style="display: grid; gap: 1rem;">`;

            sessions.forEach(session => {
                const isActive = session.status === 'ACTIVE';
                const cardColor = isActive ? 'neo-card-gold' : '';
                const statusColor = isActive ? 'var(--casino-gold)' : 'var(--text-secondary)';
                const statusIcon = isActive ? '🟡' : '⚪';

                html += `
                    <a href="#session/${session.session_id}" class="neo-card ${cardColor} list-card-row" style="text-decoration: none; color: inherit;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div class="list-card-text">
                                    📅 ${formatDate(session.date)}
                                </div>
                                <div class="list-card-subtitle">
                                    Buy-in: ${formatCurrency(session.buyin)} | Total: ${formatCurrency(session.totalValue)}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${statusColor}; font-size: 1.25rem;">${statusIcon}</span>
                                <span style="font-size: 0.875rem; font-weight: 600; color: ${statusColor};">
                                    ${session.status || 'Unknown'}
                                </span>
                            </div>
                        </div>
                    </a>
                `;
            });

            html += `</div>`;
        } else {
            html += `
                ${renderEmptyState({ icon: '🎯', message: 'No sessions found. Create your first session above!' })}
            `;
        }

        html += `
            </div>
        `;

        this.appContent.innerHTML = html;

        // Add event listeners
        this.setupEventListeners();
    }


    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Setup event listeners for the page
    setupEventListeners() {
        const createSessionBtn = document.getElementById('create-session-btn');

        if (createSessionBtn) {
            createSessionBtn.addEventListener('click', () => {
                // Trigger new session modal
                document.dispatchEvent(new CustomEvent('showNewSessionModal'));
            });
        }

        // Animate cards
        staggerChildren(this.appContent, '.neo-card', 50);
    }
}
