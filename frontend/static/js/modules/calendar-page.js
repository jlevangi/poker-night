// Calendar page module
export default class CalendarPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.events = [];
        this.players = [];
    }

    async load() {
        try {
            const [events, players] = await Promise.all([
                this.api.get('events?upcoming=true').catch(() => []),
                this.api.get('players').catch(() => [])
            ]);
            this.events = events || [];
            this.players = players || [];
            this.render();
        } catch (error) {
            console.error('Error loading calendar:', error);
            this.appContent.innerHTML = `<p>Error loading calendar: ${error.message}</p>`;
        }
    }

    render() {
        let html = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-green); text-align: center;">&#128197; Upcoming Poker Nights</h2>

                <div class="neo-card neo-card-green" style="margin-bottom: 2rem; text-align: center;">
                    <button id="schedule-event-btn" class="neo-btn neo-btn-green neo-btn-lg">+ Schedule Event</button>
                </div>

                <div id="create-event-form-container" class="neo-create-event-form" style="display: none;">
                    ${this.renderCreateForm()}
                </div>

                <div id="events-list">
                    ${this.events.length === 0
                        ? '<div class="neo-card"><p style="font-weight: 600; color: var(--text-secondary); text-align: center;">No upcoming events scheduled. Click "Schedule Event" to plan the next poker night!</p></div>'
                        : this.events.map(evt => this.renderEventCard(evt)).join('')
                    }
                </div>
            </div>
        `;

        this.appContent.innerHTML = html;
        this.setupEventListeners();
    }

    renderCreateForm() {
        const today = new Date().toISOString().split('T')[0];
        return `
            <div class="neo-card" style="margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.125rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">Schedule a Poker Night</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Date *</label>
                        <input type="date" id="event-date" value="${today}" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Time</label>
                        <input type="time" id="event-time" value="19:00" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Title</label>
                        <input type="text" id="event-title" placeholder="Poker Night" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Location</label>
                        <input type="text" id="event-location" placeholder="Location" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Buy-in ($)</label>
                        <input type="number" id="event-buyin" value="20" min="0" step="0.01" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Max Players</label>
                        <input type="number" id="event-max-players" placeholder="No limit" min="2" max="50" class="neo-input" style="width: 100%;">
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Description</label>
                        <textarea id="event-description" placeholder="Optional details..." class="neo-input" style="width: 100%; min-height: 60px; resize: vertical;"></textarea>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button id="submit-event-btn" class="neo-btn neo-btn-green">Create Event</button>
                    <button id="cancel-event-btn" class="neo-btn neo-btn-red">Cancel</button>
                </div>
            </div>
        `;
    }

    renderEventCard(event) {
        const dateObj = new Date(event.date + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const timeFormatted = event.time ? this.formatTime(event.time) : '';
        const counts = event.rsvp_counts || { yes: 0, maybe: 0, no: 0 };
        const totalPlayers = counts.yes + counts.maybe;
        const isCancelled = event.is_cancelled;

        return `
            <a href="#event/${event.event_id}" class="neo-event-card-link" style="text-decoration: none; color: inherit; display: block; margin-bottom: 1rem;">
                <div class="neo-event-card neo-card ${isCancelled ? 'neo-event-cancelled' : ''}" style="${isCancelled ? 'opacity: 0.6;' : ''} cursor: pointer; transition: transform 0.1s, box-shadow 0.1s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <div style="font-weight: 800; font-size: 1.25rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">
                                ${this.escapeHtml(event.title || 'Poker Night')}
                                ${isCancelled ? '<span style="color: var(--casino-red); font-size: 0.875rem; margin-left: 0.5rem;">CANCELLED</span>' : ''}
                            </div>
                            <div style="font-weight: 700; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${dateFormatted}${timeFormatted ? ' at ' + timeFormatted : ''}
                            </div>
                            ${event.location ? `<div style="font-weight: 600; color: var(--text-secondary); margin-top: 0.25rem;">&#128205; ${this.escapeHtml(event.location)}</div>` : ''}
                            ${totalPlayers > 0 ? `<div style="font-weight: 600; color: var(--text-secondary); margin-top: 0.25rem;">${totalPlayers} player${totalPlayers !== 1 ? 's' : ''} responding</div>` : ''}
                        </div>

                        <div class="neo-rsvp-badges">
                            <span class="neo-rsvp-badge neo-rsvp-badge-yes">${counts.yes} In</span>
                            <span class="neo-rsvp-badge neo-rsvp-badge-maybe">${counts.maybe} Maybe</span>
                            <span class="neo-rsvp-badge neo-rsvp-badge-no">${counts.no} Out</span>
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    formatTime(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Schedule event button
        const scheduleBtn = document.getElementById('schedule-event-btn');
        const formContainer = document.getElementById('create-event-form-container');
        if (scheduleBtn && formContainer) {
            scheduleBtn.addEventListener('click', () => {
                formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
            });
        }

        // Cancel form
        const cancelBtn = document.getElementById('cancel-event-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                formContainer.style.display = 'none';
            });
        }

        // Submit event
        const submitBtn = document.getElementById('submit-event-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleCreateEvent());
        }

        // Auto-start sessions for events near their scheduled time
        this.autoStartSessions();
    }

    async handleCreateEvent() {
        const date = document.getElementById('event-date')?.value;
        const time = document.getElementById('event-time')?.value;
        const title = document.getElementById('event-title')?.value || 'Poker Night';
        const location = document.getElementById('event-location')?.value;
        const buyin = parseFloat(document.getElementById('event-buyin')?.value || 20);
        const maxPlayers = document.getElementById('event-max-players')?.value;
        const description = document.getElementById('event-description')?.value;

        if (!date) {
            alert('Please select a date.');
            return;
        }

        try {
            const data = { date, title, default_buy_in_value: buyin };
            if (time) data.time = time;
            if (location) data.location = location;
            if (description) data.description = description;
            if (maxPlayers) data.max_players = parseInt(maxPlayers);

            const newEvent = await this.api.post('events', data);
            window.location.hash = `#event/${newEvent.event_id}`;
        } catch (error) {
            alert(`Error creating event: ${error.message}`);
        }
    }

    async autoStartSessions() {
        const now = new Date();
        let anyStarted = false;

        for (const event of this.events) {
            if (event.is_cancelled || event.session_id || !event.time) continue;

            const eventDateTime = new Date(event.date + 'T' + event.time);
            const diffMs = eventDateTime - now;

            // Auto-start if within 1 hour before to 4 hours after scheduled time
            if (diffMs <= 60 * 60 * 1000 && diffMs >= -4 * 60 * 60 * 1000) {
                try {
                    await this.api.startSessionFromEvent(event.event_id);
                    anyStarted = true;
                } catch (error) {
                    console.warn(`Auto-start failed for event ${event.event_id}:`, error.message);
                }
            }
        }

        if (anyStarted) {
            await this.load();
        }
    }

}
