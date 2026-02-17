// Sessions page module
export default class SessionsPage {    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }

    // Load the sessions page
    async load() {
        try {
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
            this.appContent.innerHTML = `<p>Error loading sessions: ${error.message}</p>`;
        }
    }

    // Render sessions content
    render(sessions, upcomingEvents = []) {
        let html = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-green);">🃏 Sessions</h2>

                <div class="neo-card neo-card-green" style="margin-bottom: 2rem; text-align: center;">
                    <button id="create-session-btn" class="neo-btn neo-btn-green neo-btn-lg">+ Create Session</button>
                </div>
        `;

        // Upcoming events section
        if (upcomingEvents.length > 0) {
            html += `
                <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary);">Upcoming</h3>
                <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
            `;

            upcomingEvents.forEach(evt => {
                const playerCount = evt.rsvp_counts.yes + evt.rsvp_counts.maybe + evt.rsvp_counts.no;
                html += `
                    <a href="#event/${evt.event_id}" class="neo-card neo-card-purple" style="text-decoration: none; color: inherit; padding: 1rem; margin: 0; transition: all var(--transition-neo);" onmouseover="this.style.transform='translate(-2px, -2px)'; this.style.boxShadow='var(--neo-shadow-lg)'" onmouseout="this.style.transform='translate(0, 0)'; this.style.boxShadow='var(--neo-shadow-md)'">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 800; color: inherit; margin-bottom: 0.25rem; font-size: 1.125rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                    ${this.escapeHtml(evt.title)} — ${this.formatDate(evt.date)}
                                </div>
                                <div style="font-size: 0.875rem; color: inherit; font-weight: 600; opacity: 0.8;">
                                    Buy-in: $${evt.buyin.toFixed(2)}${playerCount > 0 ? ` | ${playerCount} player${playerCount !== 1 ? 's' : ''} responding` : ''}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 1.25rem;">🟠</span>
                                <span style="font-size: 0.875rem; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.05em;">
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
                <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary);">All Sessions</h3>
        `;

        if (sessions && sessions.length > 0) {
            html += `<div style="display: grid; gap: 1rem;">`;

            sessions.forEach(session => {
                const isActive = session.status === 'ACTIVE';
                const cardColor = isActive ? 'neo-card-gold' : '';
                const statusColor = isActive ? 'var(--casino-gold)' : 'var(--text-secondary)';
                const statusIcon = isActive ? '🟡' : '⚪';

                html += `
                    <a href="#session/${session.session_id}" class="neo-card ${cardColor}" style="text-decoration: none; color: inherit; padding: 1rem; margin: 0; transition: all var(--transition-neo);" onmouseover="this.style.transform='translate(-2px, -2px)'; this.style.boxShadow='var(--neo-shadow-lg)'" onmouseout="this.style.transform='translate(0, 0)'; this.style.boxShadow='var(--neo-shadow-md)'">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 800; color: inherit; margin-bottom: 0.25rem; font-size: 1.125rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                    📅 ${this.formatDate(session.date)}
                                </div>
                                <div style="font-size: 0.875rem; color: inherit; font-weight: 600; opacity: 0.8;">
                                    Buy-in: $${session.buyin ? session.buyin.toFixed(2) : '0.00'} | Total: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${statusColor}; font-size: 1.25rem;">${statusIcon}</span>
                                <span style="font-size: 0.875rem; font-weight: 700; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.05em;">
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
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🎯</div>
                    <p style="font-size: 1.25rem; font-weight: 700; color: var(--text-secondary); margin: 0;">No sessions found. Create your first session above!</p>
                </div>
            `;
        }

        html += `
            </div>
        `;

        this.appContent.innerHTML = html;

        // Add event listeners
        this.setupEventListeners();
    }

    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; // Return original if can't parse
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
    }
}
