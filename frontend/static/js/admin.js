// Admin panel controller. Extracted verbatim (dedented) from
// frontend/templates/admin.html's inline <script>; see plan.md.
// Loaded as <script type="module">, so its scope is module-scoped (not
// global): the template's inline onclick="..." handlers are re-exposed on
// window at the end of this file.
let isAuthenticated = false;
let currentModalSave = null;
let allEntries = [];
let entriesShown = 0;
const ENTRIES_PAGE_SIZE = 20;

// --- Utilities ---
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showMessage(message, type) {
    const messagesDiv = document.getElementById('messages');
    const cls = type === 'error' ? 'error' : 'success';
    messagesDiv.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
    setTimeout(() => { messagesDiv.innerHTML = ''; }, 5000);
}

// --- Modal Infrastructure ---
function openModal(title, bodyHtml, saveFn) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    currentModalSave = saveFn;
    document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    currentModalSave = null;
}

function saveModal() {
    if (currentModalSave) currentModalSave();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
});

// --- Authentication ---
async function login() {
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (response.ok) {
            isAuthenticated = true;
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
            loadDashboard();
            loadPlayers();
        } else {
            errorDiv.textContent = result.error || 'Login failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error: ' + error.message;
        errorDiv.classList.remove('hidden');
    }
}

async function logout() {
    try { await fetch('/admin/logout', { method: 'POST' }); } catch (e) {}
    isAuthenticated = false;
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('adminContent').classList.add('hidden');
    document.getElementById('password').value = '';
    document.getElementById('loginError').classList.add('hidden');
}

document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') login();
});

// --- Dashboard ---
async function loadDashboard() {
    try {
        const response = await fetch('/admin/status');
        if (!response.ok) throw new Error('Failed to load dashboard');
        const data = await response.json();
        await displayStats(data.database_stats, data.financial_stats);
    } catch (error) {
        showMessage('Error loading dashboard: ' + error.message, 'error');
    }
}

async function displayStats(dbStats, finStats) {
    let upcomingCount = 0;
    try {
        const r = await fetch('/api/events?upcoming=true');
        if (r.ok) { const evts = await r.json(); upcomingCount = evts.length; }
    } catch (e) {}

    document.getElementById('stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${escapeHtml(dbStats.players)}</div>
            <div class="stat-label">Total Players</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${escapeHtml(dbStats.sessions)}</div>
            <div class="stat-label">Total Sessions</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${escapeHtml(dbStats.entries)}</div>
            <div class="stat-label">Total Entries</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${escapeHtml(dbStats.active_sessions)}</div>
            <div class="stat-label">Active Sessions</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${escapeHtml(upcomingCount)}</div>
            <div class="stat-label">Upcoming Events</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$${Number(finStats.total_buy_ins).toFixed(2)}</div>
            <div class="stat-label">Total Buy-ins</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$${Number(finStats.total_payouts).toFixed(2)}</div>
            <div class="stat-label">Total Payouts</div>
        </div>
    `;
}

// --- Tab Management ---
function showTab(tabName, clickedEl) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');

    // Sync desktop tab
    const desktopTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (desktopTab) desktopTab.classList.add('active');

    // Sync bottom nav
    const bottomBtn = document.querySelector(`.bottom-nav-btn[data-tab="${tabName}"]`);
    if (bottomBtn) bottomBtn.classList.add('active');

    if (tabName === 'players') loadPlayers();
    else if (tabName === 'sessions') loadSessions();
    else if (tabName === 'entries') loadEntries();
    else if (tabName === 'events') loadEvents();
    else if (tabName === 'backups') loadBackups();
}

// --- Data Loading ---
async function loadPlayers() {
    try {
        const r = await fetch('/admin/players');
        if (!r.ok) throw new Error('Failed to load players');
        displayPlayersCards(await r.json());
    } catch (e) { showMessage('Error loading players: ' + e.message, 'error'); }
}

async function loadSessions() {
    try {
        const r = await fetch('/admin/sessions');
        if (!r.ok) throw new Error('Failed to load sessions');
        displaySessionsCards(await r.json());
    } catch (e) { showMessage('Error loading sessions: ' + e.message, 'error'); }
}

async function loadEntries() {
    try {
        const r = await fetch('/admin/entries');
        if (!r.ok) throw new Error('Failed to load entries');
        allEntries = await r.json();
        entriesShown = 0;
        document.getElementById('entriesGrid').innerHTML = '';
        const oldSentinel = document.getElementById('entriesSentinel');
        if (oldSentinel) oldSentinel.remove();
        appendEntryCards();
    } catch (e) { showMessage('Error loading entries: ' + e.message, 'error'); }
}

async function loadEvents() {
    try {
        const r = await fetch('/api/events');
        if (!r.ok) throw new Error('Failed to load events');
        displayEventsCards(await r.json());
    } catch (e) { showMessage('Error loading events: ' + e.message, 'error'); }
}

async function loadBackups() {
    try {
        const r = await fetch('/admin/backups');
        if (!r.ok) throw new Error('Failed to load backups');
        displayBackupsTable(await r.json());
    } catch (e) { showMessage('Error loading backups: ' + e.message, 'error'); }
}

// --- Card Displays ---
function displayPlayersCards(players) {
    const grid = document.getElementById('playersGrid');
    if (!players.length) { grid.innerHTML = '<p>No players found.</p>'; return; }
    grid.innerHTML = players.map(p => {
        const created = new Date(p.created_at).toLocaleDateString();
        return `<div class="data-card">
            <div class="card-header">
                <div class="card-title">${escapeHtml(p.name)}</div>
            </div>
            <div class="card-id">${escapeHtml(p.player_id)}</div>
            <div class="card-detail"><span class="detail-label">7-2 Wins</span><span>${escapeHtml(p.seven_two_wins)}</span></div>
            <div class="card-detail"><span class="detail-label">Created</span><span>${created}</span></div>
            <div class="card-actions">
                <button onclick="openEditPlayerModal('${escapeHtml(p.player_id)}','${escapeHtml(p.name)}',${Number(p.seven_two_wins)})">Edit</button>
                <button class="danger" onclick="deletePlayer('${escapeHtml(p.player_id)}')">Delete</button>
            </div>
        </div>`;
    }).join('');
}

function displaySessionsCards(sessions) {
    const grid = document.getElementById('sessionsGrid');
    if (!sessions.length) { grid.innerHTML = '<p>No sessions found.</p>'; return; }
    grid.innerHTML = sessions.map(s => {
        const badgeClass = s.is_active ? 'badge-active' : 'badge-ended';
        const badgeText = s.is_active ? 'Active' : 'Ended';
        return `<div class="data-card">
            <div class="card-header">
                <div class="card-title">${escapeHtml(s.date)}</div>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="card-id">${escapeHtml(s.session_id)}</div>
            <div class="card-detail"><span class="detail-label">Buy-in</span><span>$${Number(s.default_buy_in_value).toFixed(2)}</span></div>
            <div class="card-actions">
                <button onclick="openEditSessionModal('${escapeHtml(s.session_id)}','${escapeHtml(s.date)}',${Number(s.default_buy_in_value)},${!!s.is_active})">Edit</button>
                <button class="danger" onclick="deleteSession('${escapeHtml(s.session_id)}')">Delete</button>
            </div>
        </div>`;
    }).join('');
}

function renderEntryCard(e) {
    const profitClass = e.profit > 0 ? 'profit-positive' : e.profit < 0 ? 'profit-negative' : '';
    return `<div class="data-card">
        <div class="card-header">
            <div class="card-title">${escapeHtml(e.player_name)}</div>
            <span class="${profitClass}">$${e.profit.toFixed(2)}</span>
        </div>
        <div class="card-id">${escapeHtml(e.entry_id)}</div>
        <div class="card-detail"><span class="detail-label">Session</span><span>${escapeHtml(e.session_id)}</span></div>
        <div class="card-detail"><span class="detail-label">Buy-ins</span><span>${e.buy_in_count} ($${Number(e.total_buy_in_amount).toFixed(2)})</span></div>
        <div class="card-detail"><span class="detail-label">Payout</span><span>$${Number(e.payout).toFixed(2)}</span></div>
        <div class="card-detail"><span class="detail-label">7-2 Wins</span><span>${escapeHtml(e.session_seven_two_wins)}</span></div>
        <div class="card-detail"><span class="detail-label">Strikes</span><span>${escapeHtml(e.session_strikes || 0)}</span></div>
        <div class="card-actions">
            <button onclick="openEditEntryModal('${escapeHtml(e.entry_id)}',${Number(e.buy_in_count)},${Number(e.total_buy_in_amount)},${Number(e.payout)},${Number(e.session_seven_two_wins)},${Number(e.session_strikes||0)})">Edit</button>
            <button class="danger" onclick="deleteEntry('${escapeHtml(e.entry_id)}')">Delete</button>
        </div>
    </div>`;
}

function appendEntryCards() {
    const grid = document.getElementById('entriesGrid');
    if (!allEntries.length) { grid.innerHTML = '<p>No entries found.</p>'; return; }

    const nextBatch = allEntries.slice(entriesShown, entriesShown + ENTRIES_PAGE_SIZE);
    if (!nextBatch.length) return;

    // Remove existing sentinel before appending
    const oldSentinel = document.getElementById('entriesSentinel');
    if (oldSentinel) oldSentinel.remove();

    grid.insertAdjacentHTML('beforeend', nextBatch.map(renderEntryCard).join(''));
    entriesShown += nextBatch.length;

    // Show count
    const counter = document.getElementById('entriesCounter');
    if (counter) counter.textContent = `Showing ${entriesShown} of ${allEntries.length}`;

    // Add sentinel if more entries remain
    if (entriesShown < allEntries.length) {
        grid.insertAdjacentHTML('afterend', '<div id="entriesSentinel" style="height:1px;"></div>');
        entriesObserver.observe(document.getElementById('entriesSentinel'));
    }
}

const entriesObserver = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) {
        entriesObserver.unobserve(entries[0].target);
        appendEntryCards();
    }
}, { rootMargin: '200px' });

function getEventBadge(evt) {
    if (evt.is_cancelled) return '<span class="badge badge-cancelled">Cancelled</span>';
    if (evt.session_id) return '<span class="badge badge-started">Session Started</span>';
    const d = new Date(evt.date + 'T' + (evt.time || '23:59'));
    if (d < new Date()) return '<span class="badge badge-past">Past</span>';
    return '<span class="badge badge-upcoming">Upcoming</span>';
}

function displayEventsCards(events) {
    const grid = document.getElementById('eventsGrid');
    if (!events.length) { grid.innerHTML = '<p>No events found.</p>'; return; }

    // Sort: upcoming first, then by date descending
    events.sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        const now = new Date();
        const aUpcoming = aDate >= now && !a.is_cancelled;
        const bUpcoming = bDate >= now && !b.is_cancelled;
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;
        return bDate - aDate;
    });

    grid.innerHTML = events.map(evt => {
        const rsvpCounts = evt.rsvp_counts || { yes: 0, no: 0, maybe: 0 };
        const rsvps = evt.rsvps || [];
        const rsvpId = 'rsvp_' + evt.event_id.replace(/[^a-zA-Z0-9]/g, '_');
        const isCancelled = evt.is_cancelled;
        const hasSession = !!evt.session_id;

        let rsvpListHtml = '';
        if (rsvps.length) {
            rsvpListHtml = `<button class="rsvp-toggle" onclick="document.getElementById('${rsvpId}').classList.toggle('open')">
                RSVPs: ${rsvpCounts.yes} Yes, ${rsvpCounts.maybe} Maybe, ${rsvpCounts.no} No
            </button>
            <div class="rsvp-list" id="${rsvpId}">
                ${rsvps.map(r => `<div class="rsvp-item"><span>${escapeHtml(r.player_name)}</span><span class="rsvp-${escapeHtml(r.status.toLowerCase())}">${escapeHtml(r.status)}</span></div>`).join('')}
            </div>`;
        } else {
            rsvpListHtml = `<div style="font-size:0.85em;color:var(--gray-500);">No RSVPs yet</div>`;
        }

        let actions = '';
        if (!isCancelled && !hasSession) {
            actions = `
                <button onclick="openEditEventModal('${escapeHtml(evt.event_id)}')">Edit</button>
                <button class="danger" style="background: var(--gold); color: var(--dark);" onclick="cancelEvent('${escapeHtml(evt.event_id)}')">Cancel</button>
                <button class="danger" onclick="deleteEvent('${escapeHtml(evt.event_id)}')">Delete</button>`;
        } else if (isCancelled) {
            actions = `
                <button onclick="uncancelEvent('${escapeHtml(evt.event_id)}')">Restore</button>
                <button class="danger" onclick="deleteEvent('${escapeHtml(evt.event_id)}')">Delete</button>`;
        } else {
            actions = `<button class="danger" onclick="deleteEvent('${escapeHtml(evt.event_id)}')">Delete</button>`;
        }

        return `<div class="data-card" ${isCancelled ? 'style="opacity:0.6"' : ''}>
            <div class="card-header">
                <div class="card-title">${escapeHtml(evt.title || 'Poker Night')}</div>
                ${getEventBadge(evt)}
            </div>
            <div class="card-id">${escapeHtml(evt.event_id)}</div>
            <div class="card-detail"><span class="detail-label">Date</span><span>${escapeHtml(evt.date)}${evt.time ? ' at ' + escapeHtml(evt.time) : ''}</span></div>
            ${evt.location ? `<div class="card-detail"><span class="detail-label">Location</span><span>${escapeHtml(evt.location)}</span></div>` : ''}
            <div class="card-detail"><span class="detail-label">Buy-in</span><span>$${Number(evt.default_buy_in_value || 20).toFixed(2)}</span></div>
            ${evt.max_players ? `<div class="card-detail"><span class="detail-label">Max Players</span><span>${escapeHtml(evt.max_players)}</span></div>` : ''}
            ${rsvpListHtml}
            <div class="card-actions">${actions}</div>
        </div>`;
    }).join('');
}

function displayBackupsTable(backups) {
    const tableDiv = document.getElementById('backupsTable');
    if (!backups.length) { tableDiv.innerHTML = '<p>No backups found.</p>'; return; }
    let html = '<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Description</th><th>Size</th><th>Status</th></tr></thead><tbody>';
    backups.forEach(b => {
        const date = new Date(b.backup_date).toLocaleString();
        const size = b.backup_size ? Math.round(b.backup_size / 1024) + ' KB' : 'Unknown';
        const status = b.backup_exists ? 'Available' : 'Missing';
        html += `<tr><td>${escapeHtml(date)}</td><td>${escapeHtml(b.description)}</td><td>${size}</td><td>${status}</td></tr>`;
    });
    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
}

// --- Create / Edit Modals ---

// Players
function openCreatePlayerModal() {
    openModal('Add New Player', `
        <div class="form-group">
            <label for="m_playerName">Player Name</label>
            <input type="text" id="m_playerName" placeholder="Enter player name">
        </div>
    `, async function() {
        const name = document.getElementById('m_playerName').value.trim();
        if (!name) { showMessage('Player name cannot be empty', 'error'); return; }
        try {
            const r = await fetch('/admin/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const result = await r.json();
            if (r.ok) { showMessage('Player created successfully', 'success'); closeModal(); loadPlayers(); }
            else { showMessage('Failed to create player: ' + result.error, 'error'); }
        } catch (e) { showMessage('Error creating player: ' + e.message, 'error'); }
    });
}

function openEditPlayerModal(playerId, name, sevenTwoWins) {
    openModal('Edit Player', `
        <div class="form-group">
            <label for="m_playerName">Name</label>
            <input type="text" id="m_playerName" value="${escapeHtml(name)}">
        </div>
        <div class="form-group">
            <label for="m_player72">7-2 Wins</label>
            <input type="number" id="m_player72" value="${sevenTwoWins}" min="0">
        </div>
    `, async function() {
        const newName = document.getElementById('m_playerName').value.trim();
        const new72 = parseInt(document.getElementById('m_player72').value);
        if (!newName) { showMessage('Player name cannot be empty', 'error'); return; }
        if (isNaN(new72) || new72 < 0) { showMessage('7-2 wins must be a non-negative integer', 'error'); return; }
        try {
            const r = await fetch(`/admin/players/${playerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, seven_two_wins: new72 })
            });
            const result = await r.json();
            if (r.ok) { showMessage('Player updated successfully', 'success'); closeModal(); loadPlayers(); }
            else { showMessage('Failed to update player: ' + result.error, 'error'); }
        } catch (e) { showMessage('Error updating player: ' + e.message, 'error'); }
    });
}

// Sessions
function openCreateSessionModal() {
    const today = new Date().toISOString().split('T')[0];
    openModal('Add New Session', `
        <div class="form-group">
            <label for="m_sessDate">Date</label>
            <input type="date" id="m_sessDate" value="${today}">
        </div>
        <div class="form-group">
            <label for="m_sessBuyIn">Default Buy-in ($)</label>
            <input type="number" id="m_sessBuyIn" value="20.00" min="0" step="0.01">
        </div>
    `, async function() {
        const date = document.getElementById('m_sessDate').value;
        const buyIn = parseFloat(document.getElementById('m_sessBuyIn').value);
        if (!date) { showMessage('Date is required', 'error'); return; }
        if (isNaN(buyIn) || buyIn <= 0) { showMessage('Buy-in must be a positive number', 'error'); return; }
        try {
            const r = await fetch('/admin/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, default_buy_in_value: buyIn })
            });
            const result = await r.json();
            if (r.ok) { showMessage('Session created successfully', 'success'); closeModal(); loadSessions(); }
            else { showMessage('Failed to create session: ' + result.error, 'error'); }
        } catch (e) { showMessage('Error creating session: ' + e.message, 'error'); }
    });
}

function openEditSessionModal(sessionId, date, buyIn, isActive) {
    openModal('Edit Session', `
        <div class="form-group">
            <label for="m_sessDate">Date</label>
            <input type="date" id="m_sessDate" value="${escapeHtml(date)}">
        </div>
        <div class="form-group">
            <label for="m_sessBuyIn">Default Buy-in ($)</label>
            <input type="number" id="m_sessBuyIn" value="${buyIn}" min="0" step="0.01">
        </div>
        <div class="form-group">
            <label for="m_sessStatus">Status</label>
            <select id="m_sessStatus">
                <option value="true" ${isActive ? 'selected' : ''}>Active</option>
                <option value="false" ${!isActive ? 'selected' : ''}>Ended</option>
            </select>
        </div>
    `, async function() {
        const newDate = document.getElementById('m_sessDate').value;
        const newBuyIn = parseFloat(document.getElementById('m_sessBuyIn').value);
        const newActive = document.getElementById('m_sessStatus').value === 'true';
        if (!newDate) { showMessage('Date is required', 'error'); return; }
        if (isNaN(newBuyIn) || newBuyIn <= 0) { showMessage('Buy-in must be positive', 'error'); return; }
        try {
            const r = await fetch(`/admin/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: newDate, default_buy_in_value: newBuyIn, is_active: newActive })
            });
            const result = await r.json();
            if (r.ok) { showMessage('Session updated successfully', 'success'); closeModal(); loadSessions(); }
            else { showMessage('Failed to update session: ' + result.error, 'error'); }
        } catch (e) { showMessage('Error updating session: ' + e.message, 'error'); }
    });
}

// Entries
function openEditEntryModal(entryId, buyInCount, totalBuyIn, payout, sevenTwoWins, strikes) {
    openModal('Edit Entry', `
        <div class="form-group">
            <label for="m_entBuyInCount">Buy-in Count</label>
            <input type="number" id="m_entBuyInCount" value="${buyInCount}" min="0">
        </div>
        <div class="form-group">
            <label for="m_entTotalBuyIn">Total Buy-in ($)</label>
            <input type="number" id="m_entTotalBuyIn" value="${totalBuyIn}" min="0" step="0.01">
        </div>
        <div class="form-group">
            <label for="m_entPayout">Payout ($)</label>
            <input type="number" id="m_entPayout" value="${payout}" min="0" step="0.01">
        </div>
        <div class="form-group">
            <label for="m_ent72">7-2 Wins</label>
            <input type="number" id="m_ent72" value="${sevenTwoWins}" min="0">
        </div>
        <div class="form-group">
            <label for="m_entStrikes">Strikes</label>
            <input type="number" id="m_entStrikes" value="${strikes}" min="0">
        </div>
    `, async function() {
        const data = {
            buy_in_count: parseInt(document.getElementById('m_entBuyInCount').value),
            total_buy_in_amount: parseFloat(document.getElementById('m_entTotalBuyIn').value),
            payout: parseFloat(document.getElementById('m_entPayout').value),
            session_seven_two_wins: parseInt(document.getElementById('m_ent72').value),
            session_strikes: parseInt(document.getElementById('m_entStrikes').value)
        };
        for (const [k, v] of Object.entries(data)) {
            if (isNaN(v) || v < 0) { showMessage(k.replace(/_/g, ' ') + ' must be non-negative', 'error'); return; }
        }
        try {
            const r = await fetch(`/admin/entries/${entryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await r.json();
            if (r.ok) { showMessage('Entry updated successfully', 'success'); closeModal(); loadEntries(); }
            else { showMessage('Failed to update entry: ' + result.error, 'error'); }
        } catch (e) { showMessage('Error updating entry: ' + e.message, 'error'); }
    });
}

// Events
function openCreateEventModal() {
    const today = new Date().toISOString().split('T')[0];
    openModal('Create Event', `
        <div class="form-group">
            <label for="m_evtTitle">Title</label>
            <input type="text" id="m_evtTitle" value="Poker Night">
        </div>
        <div class="form-group">
            <label for="m_evtDate">Date</label>
            <input type="date" id="m_evtDate" value="${today}">
        </div>
        <div class="form-group">
            <label for="m_evtTime">Time</label>
            <input type="time" id="m_evtTime" value="19:00">
        </div>
        <div class="form-group">
            <label for="m_evtLocation">Location</label>
            <input type="text" id="m_evtLocation" placeholder="Optional">
        </div>
        <div class="form-group">
            <label for="m_evtBuyIn">Buy-in ($)</label>
            <input type="number" id="m_evtBuyIn" value="20.00" min="0" step="0.01">
        </div>
        <div class="form-group">
            <label for="m_evtMaxPlayers">Max Players</label>
            <input type="number" id="m_evtMaxPlayers" value="8" min="2" max="50">
        </div>
        <div class="form-group">
            <label for="m_evtDesc">Description</label>
            <textarea id="m_evtDesc" placeholder="Optional"></textarea>
        </div>
    `, async function() {
        const date = document.getElementById('m_evtDate').value;
        if (!date) { showMessage('Date is required', 'error'); return; }
        const body = {
            title: document.getElementById('m_evtTitle').value.trim() || 'Poker Night',
            date,
            time: document.getElementById('m_evtTime').value || undefined,
            location: document.getElementById('m_evtLocation').value.trim() || undefined,
            default_buy_in_value: parseFloat(document.getElementById('m_evtBuyIn').value) || 20,
            max_players: parseInt(document.getElementById('m_evtMaxPlayers').value) || undefined,
            description: document.getElementById('m_evtDesc').value.trim() || undefined
        };
        try {
            const r = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await r.json();
            if (r.ok) { showMessage('Event created successfully', 'success'); closeModal(); loadEvents(); loadDashboard(); }
            else { showMessage('Failed to create event: ' + result.error, 'error'); }
        } catch (e) { showMessage('Error creating event: ' + e.message, 'error'); }
    });
}

async function openEditEventModal(eventId) {
    try {
        const r = await fetch(`/api/events/${eventId}`);
        if (!r.ok) throw new Error('Failed to load event');
        const evt = await r.json();

        openModal('Edit Event', `
            <div class="form-group">
                <label for="m_evtTitle">Title</label>
                <input type="text" id="m_evtTitle" value="${escapeHtml(evt.title || '')}">
            </div>
            <div class="form-group">
                <label for="m_evtDate">Date</label>
                <input type="date" id="m_evtDate" value="${escapeHtml(evt.date)}">
            </div>
            <div class="form-group">
                <label for="m_evtTime">Time</label>
                <input type="time" id="m_evtTime" value="${escapeHtml(evt.time || '')}">
            </div>
            <div class="form-group">
                <label for="m_evtLocation">Location</label>
                <input type="text" id="m_evtLocation" value="${escapeHtml(evt.location || '')}">
            </div>
            <div class="form-group">
                <label for="m_evtBuyIn">Buy-in ($)</label>
                <input type="number" id="m_evtBuyIn" value="${evt.default_buy_in_value || 20}" min="0" step="0.01">
            </div>
            <div class="form-group">
                <label for="m_evtMaxPlayers">Max Players</label>
                <input type="number" id="m_evtMaxPlayers" value="${evt.max_players || 8}" min="2" max="50">
            </div>
            <div class="form-group">
                <label for="m_evtDesc">Description</label>
                <textarea id="m_evtDesc">${escapeHtml(evt.description || '')}</textarea>
            </div>
        `, async function() {
            const date = document.getElementById('m_evtDate').value;
            if (!date) { showMessage('Date is required', 'error'); return; }
            const body = {
                title: document.getElementById('m_evtTitle').value.trim() || 'Poker Night',
                date,
                time: document.getElementById('m_evtTime').value || null,
                location: document.getElementById('m_evtLocation').value.trim() || null,
                default_buy_in_value: parseFloat(document.getElementById('m_evtBuyIn').value) || 20,
                max_players: parseInt(document.getElementById('m_evtMaxPlayers').value) || null,
                description: document.getElementById('m_evtDesc').value.trim() || null
            };
            try {
                const r = await fetch(`/api/events/${eventId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const result = await r.json();
                if (r.ok) { showMessage('Event updated successfully', 'success'); closeModal(); loadEvents(); loadDashboard(); }
                else { showMessage('Failed to update event: ' + result.error, 'error'); }
            } catch (e) { showMessage('Error updating event: ' + e.message, 'error'); }
        });
    } catch (e) { showMessage('Error loading event: ' + e.message, 'error'); }
}

async function cancelEvent(eventId) {
    if (!confirm('Cancel this event? RSVPs will be preserved but the event will be marked as cancelled.')) return;
    try {
        const r = await fetch(`/api/events/${eventId}/cancel`, { method: 'PUT' });
        const result = await r.json();
        if (r.ok) { showMessage('Event cancelled', 'success'); loadEvents(); loadDashboard(); }
        else { showMessage('Failed to cancel event: ' + result.error, 'error'); }
    } catch (e) { showMessage('Error cancelling event: ' + e.message, 'error'); }
}

async function uncancelEvent(eventId) {
    if (!confirm('Restore this event? It will become active again.')) return;
    try {
        const r = await fetch(`/api/events/${eventId}/uncancel`, { method: 'PUT' });
        const result = await r.json();
        if (r.ok) { showMessage('Event restored', 'success'); loadEvents(); loadDashboard(); }
        else { showMessage('Failed to restore event: ' + result.error, 'error'); }
    } catch (e) { showMessage('Error restoring event: ' + e.message, 'error'); }
}

async function deleteEvent(eventId) {
    if (!confirm('Permanently delete this event? This cannot be undone.')) return;
    try {
        const r = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
        const result = await r.json();
        if (r.ok) { showMessage('Event deleted', 'success'); loadEvents(); loadDashboard(); }
        else { showMessage('Failed to delete event: ' + result.error, 'error'); }
    } catch (e) { showMessage('Error deleting event: ' + e.message, 'error'); }
}

// --- Delete functions (existing) ---
async function deletePlayer(playerId) {
    if (!confirm('Are you sure you want to delete this player? This will also delete all their entries!')) return;
    try {
        const r = await fetch(`/admin/players/${playerId}?force=true`, { method: 'DELETE' });
        const result = await r.json();
        if (r.ok) { showMessage('Player deleted successfully', 'success'); loadPlayers(); }
        else { showMessage('Failed to delete player: ' + result.error, 'error'); }
    } catch (e) { showMessage('Error deleting player: ' + e.message, 'error'); }
}

async function deleteSession(sessionId) {
    try {
        const [sessionsRes, entriesRes] = await Promise.all([
            fetch('/admin/sessions'),
            fetch('/admin/entries')
        ]);
        if (!sessionsRes.ok || !entriesRes.ok) { showMessage('Failed to check session details', 'error'); return; }

        const allSessions = await sessionsRes.json();
        const allEntries = await entriesRes.json();
        const sessionEntries = allEntries.filter(e => e.session_id === sessionId);

        let confirmMessage = 'Are you sure you want to delete this session?';
        let hasMoneyInvolved = false;

        if (sessionEntries.length > 0) {
            const totalBuyIns = sessionEntries.reduce((sum, e) => sum + (e.total_buy_in_amount || 0), 0);
            const totalPayouts = sessionEntries.reduce((sum, e) => sum + (e.payout || 0), 0);
            if (totalBuyIns > 0 || totalPayouts > 0) {
                hasMoneyInvolved = true;
                confirmMessage = `WARNING: This session contains financial data!\n\n${sessionEntries.length} entries will be deleted:\n- Total Buy-ins: $${totalBuyIns.toFixed(2)}\n- Total Payouts: $${totalPayouts.toFixed(2)}\n\nThis cannot be undone. Delete?`;
            } else {
                confirmMessage = `This session has ${sessionEntries.length} entries that will also be deleted. Continue?`;
            }
        }

        const userConfirmed = hasMoneyInvolved
            ? confirm(confirmMessage) && confirm('FINAL CONFIRMATION: Delete session with $' + sessionEntries.reduce((sum, e) => sum + (e.total_buy_in_amount || 0), 0).toFixed(2) + ' in buy-ins?')
            : confirm(confirmMessage);
        if (!userConfirmed) return;

        const r = await fetch(`/admin/sessions/${sessionId}?force=true`, { method: 'DELETE' });
        const result = await r.json();
        if (r.ok) { showMessage('Session deleted successfully', 'success'); loadSessions(); loadDashboard(); }
        else { showMessage('Failed to delete session: ' + result.error, 'error'); }
    } catch (e) { showMessage('Error deleting session: ' + e.message, 'error'); }
}

async function deleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) return;
    try {
        const r = await fetch(`/admin/entries/${entryId}`, { method: 'DELETE' });
        const result = await r.json();
        if (r.ok) { showMessage('Entry deleted successfully', 'success'); loadEntries(); loadDashboard(); }
        else { showMessage('Failed to delete entry: ' + result.error, 'error'); }
    } catch (e) { showMessage('Error deleting entry: ' + e.message, 'error'); }
}

// --- Toolbar Actions ---
async function createBackup() {
    try {
        const description = prompt('Backup description (optional):') || 'Manual backup from admin interface';
        const r = await fetch('/admin/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        });
        const result = await r.json();
        if (r.ok) {
            showMessage('Backup created successfully: ' + result.backup_path, 'success');
            if (document.getElementById('backups').classList.contains('active')) loadBackups();
        } else { showMessage('Backup failed: ' + result.error, 'error'); }
    } catch (e) { showMessage('Backup error: ' + e.message, 'error'); }
}

async function validateData() {
    showMessage('Validating data...', 'success');
    setTimeout(() => { showMessage('Data validation completed. Check logs for details.', 'success'); }, 2000);
}

// --- Inline onclick bridge ---
// <script type="module"> scopes function declarations to the module; the
// template still calls these via inline onclick="..." attributes, so attach
// each handler to window. (The pre-extraction inline classic <script> made
// them global implicitly.)
window.login = login;
window.logout = logout;
window.loadDashboard = loadDashboard;
window.createBackup = createBackup;
window.validateData = validateData;
window.showTab = showTab;
window.openCreatePlayerModal = openCreatePlayerModal;
window.openEditPlayerModal = openEditPlayerModal;
window.deletePlayer = deletePlayer;
window.openCreateSessionModal = openCreateSessionModal;
window.openEditSessionModal = openEditSessionModal;
window.deleteSession = deleteSession;
window.openEditEntryModal = openEditEntryModal;
window.deleteEntry = deleteEntry;
window.openCreateEventModal = openCreateEventModal;
window.openEditEventModal = openEditEventModal;
window.cancelEvent = cancelEvent;
window.uncancelEvent = uncancelEvent;
window.deleteEvent = deleteEvent;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveModal = saveModal;
