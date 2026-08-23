// Calendar page module
import { staggerChildren } from './animations.js';
import EventBus from './event-bus.js';
import { formatDateLong } from './formatters.js';
import { renderEmptyState, renderSkeleton, renderSkeletonPage, showPageError } from './ui.js';

export default class CalendarPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.events = [];
        this.players = [];
    }

    static skeleton() {
        let events = '';
        for (let i = 0; i < 3; i++) {
            // Mirrors the real event card: when | title | RSVP zones
            events +=
                '<div class="neo-event-card neo-card" style="margin-bottom: 1rem;">' +
                    '<div class="event-card-when">' +
                        renderSkeleton({ classes: 'skeleton-text', style: 'width: 85%;' }) +
                        renderSkeleton({ classes: 'skeleton-text', style: 'width: 55%;' }) +
                    '</div>' +
                    '<div class="event-card-title">' +
                        renderSkeleton({ classes: 'skeleton-text', style: 'width: 75%;' }) +
                    '</div>' +
                    '<div class="neo-rsvp-badges">' +
                        renderSkeleton({ classes: 'skeleton-badge' }) +
                        renderSkeleton({ classes: 'skeleton-badge' }) +
                        renderSkeleton({ classes: 'skeleton-badge' }) +
                    '</div>' +
                '</div>';
        }
        return renderSkeletonPage([
            // Title
            renderSkeleton({ style: 'width: 60%; height: 2.5rem; margin: 0 0 2rem 0;' }),
            // Month navigation
            '<div class="neo-card" style="margin-bottom: 2rem; text-align: center;">' +
                renderSkeleton({ style: 'width: 50%; height: 48px; margin: 0 auto; border-radius: 4px;' }) +
            '</div>',
            // Event cards
            events
        ]);
    }

    async load() {
        try {
            document.title = 'Calendar - Gamble King';
            const [events, players] = await Promise.all([
                this.api.get('events?upcoming=true').catch(() => []),
                this.api.get('players').catch(() => [])
            ]);
            this.events = events || [];
            this.players = players || [];
            this.render();
        } catch (error) {
            console.error('Error loading calendar:', error);
            showPageError(this.appContent, {
                message: 'Could not load the calendar. ' + error.message,
                actionLabel: 'Try Again',
                onAction: () => this.load()
            });
        }
    }

    render() {
        let html = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 class="page-title">&#128197; Upcoming Poker Nights</h2>

                <div class="neo-card neo-card-green calendar-cta-card">
                    <button id="schedule-event-btn" class="neo-btn neo-btn-green neo-btn-lg">+ Schedule Event</button>
                </div>

                <div id="create-event-form-container" class="neo-create-event-form" style="display: none;">
                    ${this.renderCreateForm()}
                </div>

                <div id="events-list">
                    ${this.events.length === 0
                        ? renderEmptyState({ icon: '📅', message: 'No upcoming events scheduled. Click "Schedule Event" to plan the next poker night!' })
                        : this.events.map(evt => this.renderEventCard(evt)).join('')
                    }
                </div>
            </div>
        `;

        this.appContent.innerHTML = html;
        this.setupEventListeners();

        // Animate event cards
        staggerChildren(this.appContent, '.neo-card', 50);
    }

    renderCreateForm() {
        const today = new Date().toISOString().split('T')[0];
        return `
            <div class="neo-card" style="margin-bottom: 1.5rem;">
                <h3 class="section-heading">Schedule a Poker Night</h3>
                <div class="create-event-grid">
                    <div>
                        <label class="modal-form-label">Date *</label>
                        <input type="date" id="event-date" value="${today}" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label class="modal-form-label">Time</label>
                        <input type="time" id="event-time" value="19:00" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label class="modal-form-label">Title</label>
                        <input type="text" id="event-title" placeholder="Poker Night" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label class="modal-form-label">Location</label>
                        <input type="text" id="event-location" placeholder="Location" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label class="modal-form-label">Buy-in ($)</label>
                        <input type="number" id="event-buyin" value="20" min="0" step="0.01" class="neo-input" style="width: 100%;">
                    </div>
                    <div>
                        <label class="modal-form-label">Max Players</label>
                        <input type="number" id="event-max-players" placeholder="No limit" min="2" max="50" class="neo-input" style="width: 100%;">
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <label class="modal-form-label">Description</label>
                        <textarea id="event-description" placeholder="Optional details..." class="neo-input" style="width: 100%; min-height: 60px; resize: vertical; margin-bottom: 0;"></textarea>
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
        const dateFormatted = formatDateLong(event.date);

        const timeFormatted = event.time ? this.formatTime(event.time) : '';
        const counts = event.rsvp_counts || { yes: 0, maybe: 0, no: 0 };
        const totalPlayers = counts.yes + counts.maybe + counts.no;
        const isCancelled = event.is_cancelled;

        // One scannable row: the date leads (calendar identity), the title
        // + status name the event, and the RSVP counts sit at a glance on
        // the right.  All layout lives in _calendar.css — no inline styles.
        const statusBadge = isCancelled
            ? '<span class="event-status-badge event-status-badge--cancelled">Cancelled</span>'
            : '<span class="event-status-badge event-status-badge--upcoming">Upcoming</span>';

        const rsvpBadges = totalPlayers > 0
            ? `<span class="neo-rsvp-badge neo-rsvp-badge-yes">${counts.yes} In</span>
               <span class="neo-rsvp-badge neo-rsvp-badge-maybe">${counts.maybe} Maybe</span>
               <span class="neo-rsvp-badge neo-rsvp-badge-no">${counts.no} Out</span>`
            : '<span class="neo-rsvp-badge neo-rsvp-badge--empty">No RSVPs yet</span>';

        const meta = [timeFormatted, event.location ? '📍 ' + this.escapeHtml(event.location) : '']
            .filter(part => part !== '')
            .join(' · ');

        return `
            <a href="#event/${event.event_id}" class="neo-event-card-link">
                <div class="neo-event-card neo-card ${isCancelled ? 'neo-event-cancelled' : ''}">
                    <div class="event-card-when">
                        <div class="event-card-date">${dateFormatted}</div>
                        ${meta ? `<div class="event-card-meta">${meta}</div>` : ''}
                    </div>
                    <div class="event-card-title">
                        <span class="event-card-title-text">${this.escapeHtml(event.title || 'Poker Night')}</span>
                        ${statusBadge}
                    </div>
                    <div class="neo-rsvp-badges">${rsvpBadges}</div>
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
            EventBus.emit('data:events-changed');
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
