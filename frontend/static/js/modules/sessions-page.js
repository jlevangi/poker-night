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
                <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; margin-bottom: 2rem;">
            `;

            activeSessions.forEach(session => {
                html += this._renderSessionCard(session);
            });

            html += `</div>`;
        }

        // Upcoming events section
        if (upcomingEvents.length > 0) {
            html += `
                <h3 class="section-title" style="font-size: 1.5rem; margin-bottom: 1.5rem;">Upcoming</h3>
                <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; margin-bottom: 2rem;">
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
            html += `<div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem;">`;

            sessions.forEach(session => {
                html += this._renderSessionCard(session);
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


    // Build one scannable session card: date + status + buy-in on the
    // left (context); the total money at the table as the headline on
    // the right.  Mirrors the dashboard hero's left-meta / right-headline
    // language so the sessions list scans the same way the dashboard does.
    _renderSessionCard(session) {
        const isActive = session.status === 'ACTIVE';
        const cardClass = isActive
            ? 'neo-card neo-card-gold session-card session-card--active'
            : 'neo-card session-card';
        const status = session.status || 'Unknown';
        const statusState = isActive ? 'active' : 'ended';

        // Roster: who's at the table.  The count is the anchor; the names
        // are scannable context, capped at three with a "+N more" tail.
        const names = Array.isArray(session.player_names) ? session.player_names : [];
        const playerCount = Number(session.player_count) || names.length;
        let roster = '';
        if (playerCount > 0 && names.length > 0) {
            const shown = names.slice(0, 3).map(n => this.escapeHtml(n)).join(' · ');
            const extra = playerCount - Math.min(3, names.length);
            const more = extra > 0
                ? ` <span class="session-card__roster-more">+${extra} more</span>`
                : '';
            roster = `
                    <div class="session-card__roster" title="${this.escapeHtml(names.join(', '))}">
                        <span class="session-card__roster-count">👥 ${playerCount}</span>
                        <span class="session-card__roster-names">${shown}${more}</span>
                    </div>`;
        }

        return `
            <a href="#session/${session.session_id}" class="${cardClass} list-card-row" style="text-decoration: none; color: inherit;">
                <div class="session-card__meta">
                    <div class="session-card__when">
                        <span class="session-card__date">${formatDate(session.date)}</span>
                    </div>
                    <div class="session-card__buyin"><b>${formatCurrency(session.buyin)}</b> buy-in</div>
                    ${roster}
                </div>
                <div class="session-card__lead">
                    <span class="session-card__status session-card__status--${statusState}">${status}</span>
                    <span class="session-card__total-value">${formatCurrency(session.totalValue)}</span>
                    <span class="session-card__total-label">Total</span>
                </div>
            </a>
        `;
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
