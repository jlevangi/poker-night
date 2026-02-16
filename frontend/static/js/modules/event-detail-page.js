// Event detail page module
export default class EventDetailPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.event = null;
        this.players = [];
        this.editing = false;
    }

    async load(eventId) {
        try {
            const [event, players] = await Promise.all([
                this.api.get(`events/${eventId}`),
                this.api.get('players').catch(() => [])
            ]);
            this.event = event;
            this.players = players || [];
            this.editing = false;
            this.render();
        } catch (error) {
            console.error('Error loading event:', error);
            this.appContent.innerHTML = `
                <div class="fade-in" style="padding: 1.5rem; max-width: 800px; margin: 0 auto; text-align: center;">
                    <p style="color: var(--text-secondary); font-weight: 600;">Error loading event: ${this.escapeHtml(error.message)}</p>
                    <a href="#calendar" class="neo-btn neo-btn-green" style="margin-top: 1rem; display: inline-block;">Back to Calendar</a>
                </div>`;
        }
    }

    render() {
        const event = this.event;
        const dateObj = new Date(event.date + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const timeFormatted = event.time ? this.formatTime(event.time) : '';
        const counts = event.rsvp_counts || { yes: 0, maybe: 0, no: 0 };
        const yesPlayers = (event.rsvps || []).filter(r => r.status === 'YES');
        const maybePlayers = (event.rsvps || []).filter(r => r.status === 'MAYBE');
        const noPlayers = (event.rsvps || []).filter(r => r.status === 'NO');
        const isCancelled = event.is_cancelled;

        this.appContent.innerHTML = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 800px; margin: 0 auto;">
                <!-- Header with navigation -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <a href="#calendar" class="neo-btn neo-btn-purple">&larr; Back to Calendar</a>
                    <button id="share-event-btn" class="neo-btn neo-btn-gold">&#128203; Share</button>
                </div>

                <div class="neo-card ${isCancelled ? 'neo-event-cancelled' : ''}" style="${isCancelled ? 'opacity: 0.6;' : ''}">
                    ${this.editing ? this.renderEditForm(event) : this.renderEventDetails(event, dateFormatted, timeFormatted, counts, isCancelled)}
                </div>

                ${!isCancelled && !this.editing ? `
                <div class="neo-card" style="margin-top: 1rem; padding: 1rem;">
                    <h3 style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); margin: 0 0 0.5rem 0; ">RSVP</h3>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <select id="rsvp-player-select" class="neo-input" style="flex: 1 1 100%; padding: 0.5rem;">
                            <option value="">Select player...</option>
                            ${[...this.players].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.player_id}">${this.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                            <button class="neo-btn neo-rsvp-btn-yes rsvp-btn" data-status="YES" style="flex: 1;">I'm In</button>
                            <button class="neo-btn neo-rsvp-btn-maybe rsvp-btn" data-status="MAYBE" style="flex: 1;">Maybe</button>
                            <button class="neo-btn neo-rsvp-btn-no rsvp-btn" data-status="NO" style="flex: 1;">Can't Make It</button>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${!this.editing && (yesPlayers.length > 0 || maybePlayers.length > 0 || noPlayers.length > 0) ? `
                <div class="neo-card" style="margin-top: 1rem; padding: 1rem;">
                    <h3 style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); margin: 0 0 0.5rem 0; ">Responses</h3>
                    ${yesPlayers.length > 0 ? `
                        <div style="margin-bottom: 0.5rem;">
                            <span style="font-weight: 700; color: var(--casino-green);">Playing:</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${yesPlayers.map(r => this.escapeHtml(r.player_name)).join(', ')}</span>
                        </div>
                    ` : ''}
                    ${maybePlayers.length > 0 ? `
                        <div style="margin-bottom: 0.5rem;">
                            <span style="font-weight: 700; color: var(--casino-gold-dark);">Maybe:</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${maybePlayers.map(r => this.escapeHtml(r.player_name)).join(', ')}</span>
                        </div>
                    ` : ''}
                    ${noPlayers.length > 0 ? `
                        <div>
                            <span style="font-weight: 700; color: var(--casino-red);">Out:</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${noPlayers.map(r => this.escapeHtml(r.player_name)).join(', ')}</span>
                        </div>
                    ` : ''}
                </div>
                ` : ''}

                ${!isCancelled && !this.editing ? `
                <div class="neo-card" style="margin-top: 1rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
                    ${event.session_id
                        ? `<a href="#session/${event.session_id}" class="neo-btn neo-btn-green">Go to Session &rarr;</a>`
                        : `<button id="start-session-btn" class="neo-btn neo-btn-green">Start Session</button>`
                    }
                    <button id="edit-event-btn" class="neo-btn neo-btn-purple">Edit Session</button>
                    <button id="add-to-cal-btn" class="neo-btn neo-btn-gold">&#128197; Add to Cal</button>
                    <button id="cancel-event-btn" class="neo-btn neo-btn-red">Cancel Session</button>
                </div>
                ` : ''}
            </div>
        `;

        this.setupEventListeners();
    }

    renderEventDetails(event, dateFormatted, timeFormatted, counts, isCancelled) {
        return `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
                <div>
                    <h2 style="font-size: 1.75rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); margin: 0;">
                        ${this.escapeHtml(event.title || 'Poker Night')}
                        ${isCancelled ? '<span style="color: var(--casino-red); font-size: 1rem; margin-left: 0.5rem;">CANCELLED</span>' : ''}
                    </h2>
                    <div style="font-weight: 700; color: var(--text-secondary); margin-top: 0.25rem; font-size: 1.1rem;">
                        ${dateFormatted}${timeFormatted ? ' at ' + timeFormatted : ''}
                    </div>
                </div>
                <div class="neo-rsvp-badges">
                    <span class="neo-rsvp-badge neo-rsvp-badge-yes">${counts.yes} In</span>
                    <span class="neo-rsvp-badge neo-rsvp-badge-maybe">${counts.maybe} Maybe</span>
                    <span class="neo-rsvp-badge neo-rsvp-badge-no">${counts.no} Out</span>
                </div>
            </div>
            ${event.location ? `<div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">&#128205; ${this.escapeHtml(event.location)}</div>` : ''}
            ${event.description ? `<div style="color: var(--text-secondary); margin-bottom: 0.5rem;">${this.escapeHtml(event.description)}</div>` : ''}
            <div style="font-weight: 600; color: var(--text-secondary);">&#128176; Buy-in: $${(event.default_buy_in_value || 20).toFixed(2)}${event.max_players ? ' | Max: ' + event.max_players + ' players' : ''}</div>
        `;
    }

    renderEditForm(event) {
        return `
            <h3 style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); margin-bottom: 1rem;">Edit Session</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Title</label>
                    <input type="text" id="edit-title" value="${this.escapeHtml(event.title || 'Poker Night')}" class="neo-input" style="width: 100%;">
                </div>
                <div>
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Location</label>
                    <input type="text" id="edit-location" value="${this.escapeHtml(event.location || '')}" placeholder="Location" class="neo-input" style="width: 100%;">
                </div>
                <div>
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Date</label>
                    <input type="date" id="edit-date" value="${event.date}" class="neo-input" style="width: 100%;">
                </div>
                <div>
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Time</label>
                    <input type="time" id="edit-time" value="${event.time || '19:00'}" class="neo-input" style="width: 100%;">
                </div>
                <div>
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Buy-in ($)</label>
                    <input type="number" id="edit-buyin" value="${event.default_buy_in_value || 20}" min="0" step="0.01" class="neo-input" style="width: 100%;">
                </div>
                <div>
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Max Players</label>
                    <input type="number" id="edit-max-players" value="${event.max_players || ''}" placeholder="No limit" min="2" max="50" class="neo-input" style="width: 100%;">
                </div>
                <div style="grid-column: 1 / -1;">
                    <label style="font-weight: 700; display: block; margin-bottom: 0.25rem; color: var(--text-primary);">Description</label>
                    <textarea id="edit-description" placeholder="Optional details..." class="neo-input" style="width: 100%; min-height: 60px; resize: vertical;">${this.escapeHtml(event.description || '')}</textarea>
                </div>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button id="save-edit-btn" class="neo-btn neo-btn-green">Save Changes</button>
                <button id="cancel-edit-btn" class="neo-btn neo-btn-red">Cancel</button>
            </div>
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
        const event = this.event;

        // Share button (always visible in header)
        const shareBtn = document.getElementById('share-event-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.handleShareEvent(shareBtn));
        }

        if (this.editing) {
            const saveBtn = document.getElementById('save-edit-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.handleSaveEdit());
            }
            const cancelEditBtn = document.getElementById('cancel-edit-btn');
            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', () => {
                    this.editing = false;
                    this.render();
                });
            }
            return;
        }

        // RSVP buttons
        document.querySelectorAll('.rsvp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.target.dataset.status;
                const select = document.getElementById('rsvp-player-select');
                const playerId = select ? select.value : '';
                if (!playerId) {
                    alert('Please select a player first.');
                    return;
                }
                this.handleRSVP(event.event_id, playerId, status);
            });
        });

        // Add to calendar
        const calBtn = document.getElementById('add-to-cal-btn');
        if (calBtn) {
            calBtn.addEventListener('click', () => this.handleAddToCalendar(event, calBtn));
        }

        // Cancel event
        const cancelBtn = document.getElementById('cancel-event-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to cancel this session?')) {
                    this.handleCancelEvent(event.event_id);
                }
            });
        }

        // Start session
        const startBtn = document.getElementById('start-session-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.handleStartSession(event.event_id));
        }

        // Edit event
        const editBtn = document.getElementById('edit-event-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editing = true;
                this.render();
            });
        }
    }

    async handleSaveEdit() {
        const data = {};
        const title = document.getElementById('edit-title')?.value;
        const date = document.getElementById('edit-date')?.value;
        const time = document.getElementById('edit-time')?.value;
        const location = document.getElementById('edit-location')?.value;
        const buyin = document.getElementById('edit-buyin')?.value;
        const maxPlayers = document.getElementById('edit-max-players')?.value;
        const description = document.getElementById('edit-description')?.value;

        if (!date) {
            alert('Please select a date.');
            return;
        }

        if (title !== undefined) data.title = title || 'Poker Night';
        data.date = date;
        if (time) data.time = time;
        if (location !== undefined) data.location = location;
        if (buyin) data.default_buy_in_value = parseFloat(buyin);
        if (maxPlayers) data.max_players = parseInt(maxPlayers);
        if (description !== undefined) data.description = description;

        try {
            await this.api.put(`events/${this.event.event_id}`, data);
            this.editing = false;
            await this.load(this.event.event_id);
        } catch (error) {
            alert(`Error updating event: ${error.message}`);
        }
    }

    async handleRSVP(eventId, playerId, status) {
        try {
            await this.api.post(`events/${eventId}/rsvp`, {
                player_id: playerId,
                status: status
            });
            await this.load(eventId);
        } catch (error) {
            alert(`Error submitting RSVP: ${error.message}`);
        }
    }

    async handleCancelEvent(eventId) {
        try {
            await this.api.put(`events/${eventId}/cancel`);
            await this.load(eventId);
        } catch (error) {
            alert(`Error cancelling event: ${error.message}`);
        }
    }

    async handleStartSession(eventId) {
        try {
            const event = this.event;
            const rawTime = event.time || '19:00';
            const eventDateTime = new Date(`${event.date}T${rawTime}:00`);
            const msUntilEvent = eventDateTime - new Date();
            const hoursUntil = msUntilEvent / (1000 * 60 * 60);

            if (hoursUntil >= 4) {
                const h = Math.floor(hoursUntil);
                const m = Math.round((hoursUntil - h) * 60);
                const timeStr = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
                if (!confirm(`This session is scheduled to start in ${timeStr}. Are you sure you want to start it now?`)) {
                    return;
                }
            }

            const result = await this.api.startSessionFromEvent(eventId);
            if (result && result.session) {
                window.location.hash = `#session/${result.session.session_id}`;
            }
        } catch (error) {
            alert(`Error starting session: ${error.message}`);
        }
    }

    async handleShareEvent(btn) {
        const url = window.location.origin + window.location.pathname + `#event/${this.event.event_id}`;
        if (navigator.share) {
            try {
                await navigator.share({ url });
                return;
            } catch (e) { /* user cancelled or error, fall through to clipboard */ }
        }
        try {
            await navigator.clipboard.writeText(url);
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '&#9989; Copied!';
            setTimeout(() => btn.innerHTML = original, 2000);
        }
    }

    handleAddToCalendar(event, btn) {
        const existing = document.querySelector('.cal-popover');
        if (existing) existing.remove();
        const existingBackdrop = document.querySelector('.cal-popover-backdrop');
        if (existingBackdrop) existingBackdrop.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'cal-popover-backdrop';
        backdrop.style.cssText = 'position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.3);';

        const popover = document.createElement('div');
        popover.className = 'cal-popover';
        popover.style.cssText = 'position: fixed; z-index: 1000; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--card-bg); border: 3px solid var(--border-color); box-shadow: 6px 6px 0px var(--border-color); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; min-width: 220px; max-width: 90vw;';

        popover.innerHTML = `
            <div style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); text-align: center; font-size: 0.875rem;">Add to Calendar</div>
            <button class="neo-btn neo-btn-green neo-btn-sm cal-popover-google" style="width: 100%; text-align: center;">Google Calendar</button>
            <button class="neo-btn neo-btn-gold neo-btn-sm cal-popover-ics" style="width: 100%; text-align: center;">Download .ics</button>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(popover);

        const closePopover = () => {
            popover.remove();
            backdrop.remove();
        };

        backdrop.addEventListener('click', closePopover);

        popover.querySelector('.cal-popover-google').addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(this.generateGoogleCalendarUrl(event), '_blank');
            closePopover();
        });

        popover.querySelector('.cal-popover-ics').addEventListener('click', (e) => {
            e.stopPropagation();
            this.generateICSFile(event);
            closePopover();
        });
    }

    generateGoogleCalendarUrl(event) {
        const title = event.title || 'Poker Night';
        const date = event.date.replace(/-/g, '');
        const rawTime = event.time || '19:00';
        const timePadded = (rawTime + ':00').slice(0, 8).replace(/:/g, '');
        const startDT = `${date}T${timePadded}`;

        const startDate = new Date(`${event.date}T${rawTime}:00`);
        const endDate = new Date(startDate.getTime() + 6 * 60 * 60 * 1000);
        const endDT = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}${String(endDate.getMinutes()).padStart(2, '0')}${String(endDate.getSeconds()).padStart(2, '0')}`;

        const details = `Buy-in: $${(event.default_buy_in_value || 20).toFixed(2)}${event.description ? '\n' + event.description : ''}`;

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${startDT}/${endDT}`,
            details: details
        });
        if (event.location) params.set('location', event.location);

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    generateICSFile(event) {
        const title = event.title || 'Poker Night';
        const rawTime = event.time || '19:00';
        const startDate = new Date(`${event.date}T${rawTime}:00`);
        const endDate = new Date(startDate.getTime() + 6 * 60 * 60 * 1000);
        const now = new Date();

        const fmt = (d) => {
            return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
        };

        const fmtUTC = (d) => {
            return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`;
        };

        const escICS = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

        const description = `Buy-in: $${(event.default_buy_in_value || 20).toFixed(2)}${event.description ? '\\n' + escICS(event.description) : ''}`;

        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//PokerNight//EN',
            'BEGIN:VEVENT',
            `DTSTAMP:${fmtUTC(now)}`,
            `DTSTART:${fmt(startDate)}`,
            `DTEND:${fmt(endDate)}`,
            `SUMMARY:${escICS(title)}`,
            `DESCRIPTION:${description}`,
            event.location ? `LOCATION:${escICS(event.location)}` : '',
            `UID:poker-night-${event.event_id}@poker-night`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(Boolean).join('\r\n');

        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
