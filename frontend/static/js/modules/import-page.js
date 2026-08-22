// Import page module — turns a PokerNow CSV export into a session.
//
// Two steps, because a PokerNow log records chips rather than cash: rebuys,
// stack transfers between seats, and admin corrections all look alike in the
// log, so the reconstructed ledger is a starting point the user confirms
// rather than a result we can trust blindly. Step 1 uploads and parses; step 2
// maps each PokerNow nickname to a player, lets the money be corrected, and
// will not submit until buy-ins and cash-outs balance.
import { staggerChildren } from './animations.js';
import { formatCurrency } from './formatters.js';
import { renderAwardCard, renderSkeleton, renderSkeletonPage, renderSkeletonRows, showPageError } from './ui.js';

const SKIP = '__skip__';
const NEW_PLAYER = '__new__';

export default class ImportPage {
    static skeleton() {
        return renderSkeletonPage([
            renderSkeleton({ style: 'height: 2.5rem; width: 45%; margin-bottom: 2rem;' }),
            renderSkeleton({ classes: 'neo-card', style: 'height: 12rem; margin-bottom: 2rem;' }),
            renderSkeletonRows({ count: 4, height: '3rem' })
        ]);
    }

    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.reset();
    }

    reset() {
        this.files = [];
        this.analysis = null;
        this.roster = [];
        this.rows = [];          // one per PokerNow seat, mirrors the form state
        this.date = '';
        this.buyIn = 20;
        this.busy = false;
        this.error = '';
    }

    async load() {
        document.title = 'Import Session - Gamble King';
        this.reset();
        try {
            this.roster = await this.api.getPlayers();
        } catch (error) {
            // The roster only powers the mapping dropdowns; uploading still
            // works without it, and every player can be created fresh.
            console.error('Could not load players for import:', error);
            this.roster = [];
        }
        this.renderUpload();
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str === null || str === undefined ? '' : String(str);
        return div.innerHTML;
    }

    // --- Step 1: upload ----------------------------------------------------

    renderUpload() {
        this.appContent.innerHTML = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 900px; margin: 0 auto;">
                <h2 class="section-title" style="font-size: 2rem; margin-bottom: 0.5rem;">📥 Import a Session</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Upload a PokerNow log and we'll rebuild the night — every hand, every pot,
                    and the awards to go with them.
                </p>

                ${this.error ? `
                    <div class="neo-card neo-card-red" style="margin-bottom: 1.5rem;">
                        <strong>⚠️ ${this.escapeHtml(this.error)}</strong>
                    </div>` : ''}

                <div class="neo-card" style="margin-bottom: 1.5rem;">
                    <div id="import-dropzone" class="import-dropzone" role="button" tabindex="0"
                         aria-label="Choose PokerNow CSV files">
                        <div class="import-dropzone__icon">🃏</div>
                        <strong>Drop your PokerNow CSV here</strong>
                        <div class="import-dropzone__hint">or tap to choose a file</div>
                    </div>
                    <input type="file" id="import-file-input" accept=".csv,text/csv"
                           multiple style="display: none;">
                    <ul class="import-files" id="import-file-list"></ul>
                    <div class="modal-actions" style="margin-top: 1.5rem;">
                        <button id="import-analyze-btn" class="neo-btn neo-btn-green neo-btn-lg" disabled>
                            Read the Log
                        </button>
                        <a href="#sessions" class="neo-btn">Cancel</a>
                    </div>
                </div>

                <div class="neo-card">
                    <h3 class="section-title">Where do I get the file?</h3>
                    <ol style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary); line-height: 1.8;">
                        <li>Open the finished game on pokernow.club.</li>
                        <li>Choose <strong>Download Game Log</strong> — that's the file with all the hands in it.</li>
                        <li>If the game has a <strong>Ledger</strong> download too, add it: it carries the
                            real buy-ins and cash-outs, so the money comes in exact.</li>
                    </ol>
                </div>
            </div>
        `;
        this.setupUploadListeners();
        // Re-list anything already chosen, so a failed parse does not make the
        // user hunt for the file again.
        this.setFiles(this.files);
        staggerChildren(this.appContent, '.neo-card', 50);
    }

    setupUploadListeners() {
        const dropzone = document.getElementById('import-dropzone');
        const input = document.getElementById('import-file-input');
        const analyzeBtn = document.getElementById('import-analyze-btn');
        if (!dropzone || !input || !analyzeBtn) return;

        dropzone.addEventListener('click', () => input.click());
        dropzone.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                input.click();
            }
        });

        ['dragenter', 'dragover'].forEach(name => {
            dropzone.addEventListener(name, (event) => {
                event.preventDefault();
                dropzone.classList.add('is-dragging');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            dropzone.addEventListener(name, (event) => {
                event.preventDefault();
                dropzone.classList.remove('is-dragging');
            });
        });
        dropzone.addEventListener('drop', (event) => {
            this.setFiles(Array.from(event.dataTransfer?.files || []));
        });
        input.addEventListener('change', () => {
            this.setFiles(Array.from(input.files || []));
        });

        analyzeBtn.addEventListener('click', () => this.analyze());
    }

    setFiles(files) {
        // Two files at most: PokerNow only ever exports a log and a ledger.
        this.files = files.filter(f => /\.csv$/i.test(f.name)).slice(0, 2);
        const list = document.getElementById('import-file-list');
        const analyzeBtn = document.getElementById('import-analyze-btn');
        if (list) {
            list.innerHTML = this.files
                .map(f => `<li>📄 ${this.escapeHtml(f.name)} <span style="color: var(--text-secondary); font-weight: 500;">(${Math.round(f.size / 1024)} KB)</span></li>`)
                .join('');
        }
        if (analyzeBtn) analyzeBtn.disabled = this.files.length === 0;
    }

    async analyze() {
        if (!this.files.length || this.busy) return;
        const analyzeBtn = document.getElementById('import-analyze-btn');
        this.busy = true;
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Reading…';
        }

        const form = new FormData();
        this.files.forEach(file => form.append('log', file));
        // The log is stamped in UTC; send the browser's offset so a game that
        // ran past midnight is dated the night it started, not the next day.
        form.append('tz_offset_hours', String(-Math.round(new Date().getTimezoneOffset() / 60)));

        try {
            const analysis = await this.api.analyzePokerNowUpload(form);
            this.analysis = analysis;
            this.error = '';
            this.date = analysis.suggested_date || new Date().toISOString().slice(0, 10);
            this.buyIn = analysis.suggested_buy_in || 20;
            this.rows = (analysis.players || []).map(player => ({
                seat: player.seat,
                stats: player,
                choice: player.suggested_player_id || NEW_PLAYER,
                newName: player.name,
                buyIn: player.buy_in,
                cashOut: player.cash_out
            }));
            this.renderReview();
        } catch (error) {
            this.error = error.message || 'That file could not be read.';
            this.renderUpload();
        } finally {
            this.busy = false;
        }
    }

    // --- Step 2: review ----------------------------------------------------

    renderReview() {
        const summary = this.analysis.summary || {};
        const hours = Math.floor((summary.duration_minutes || 0) / 60);
        const minutes = (summary.duration_minutes || 0) % 60;
        const blinds = summary.small_blind && summary.big_blind
            ? `${formatCurrency(summary.small_blind)} / ${formatCurrency(summary.big_blind)}`
            : '—';

        this.appContent.innerHTML = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1000px; margin: 0 auto;">
                <h2 class="section-title" style="font-size: 2rem; margin-bottom: 0.5rem;">📥 Review the Import</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    ${summary.hands_played || 0} hands read from
                    ${this.escapeHtml(this.analysis.filename || 'your log')}. Check the money
                    below, then import.
                </p>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
                    ${this.renderStat('🃏', summary.hands_played || 0, 'Hands')}
                    ${this.renderStat('👥', summary.players || 0, 'Players')}
                    ${this.renderStat('⏱️', hours ? `${hours}h ${minutes}m` : `${minutes}m`, 'Duration')}
                    ${this.renderStat('💰', formatCurrency(summary.biggest_pot || 0), 'Biggest Pot')}
                    ${this.renderStat('🎚️', blinds, 'Blinds')}
                </div>

                <div class="neo-card" style="margin-bottom: 1.5rem;">
                    <h3 class="section-title">Session Details</h3>
                    <div class="modal-date-row">
                        <div class="modal-form-group" style="margin-bottom: 0;">
                            <label for="import-date">Date</label>
                            <input type="date" id="import-date" value="${this.escapeHtml(this.date)}">
                        </div>
                        <div class="modal-form-group" style="margin-bottom: 0;">
                            <label for="import-buyin">Standard Buy-in ($)</label>
                            <input type="number" id="import-buyin" min="0.01" step="0.01"
                                   value="${Number(this.buyIn).toFixed(2)}">
                        </div>
                    </div>
                </div>

                <div class="neo-card" style="margin-bottom: 1.5rem;">
                    <h3 class="section-title">Players &amp; Money</h3>
                    <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem;">
                        ${this.analysis.has_ledger
                            ? 'Buy-ins and cash-outs came from the ledger file, so they should already be right.'
                            : 'Buy-ins and cash-outs were reconstructed from the log — rebuys and chip transfers between seats look the same in there, so give these a once-over.'}
                    </p>
                    <div class="import-col-heads">
                        <span>PokerNow</span><span>Player</span><span>Buy-in</span><span>Cash-out</span><span>Net</span>
                    </div>
                    <div id="import-rows">${this.rows.map((row, i) => this.renderRow(row, i)).join('')}</div>
                    <div id="import-balance"></div>
                </div>

                ${this.renderAwards()}

                <div class="neo-card" style="text-align: center;">
                    <div id="import-error" style="color: var(--color-danger); font-weight: 600; margin-bottom: 1rem;"></div>
                    <div class="modal-actions">
                        <button id="import-commit-btn" class="neo-btn neo-btn-green neo-btn-lg">
                            Import Session
                        </button>
                        <button id="import-back-btn" class="neo-btn">Start Over</button>
                    </div>
                </div>
            </div>
        `;

        this.setupReviewListeners();
        this.updateBalance();
        staggerChildren(this.appContent, '.neo-card', 50);
    }

    renderStat(icon, value, label) {
        return `
            <div class="neo-stat-card">
                <div style="font-size: 1.25rem;">${icon}</div>
                <div class="neo-stat-value" style="font-size: 1.375rem;">${this.escapeHtml(value)}</div>
                <div class="neo-stat-label">${label}</div>
            </div>
        `;
    }

    renderRow(row, index) {
        const options = [
            `<option value="${NEW_PLAYER}"${row.choice === NEW_PLAYER ? ' selected' : ''}>➕ Create new player</option>`,
            `<option value="${SKIP}"${row.choice === SKIP ? ' selected' : ''}>🚫 Don't import</option>`,
            ...this.roster.map(p => `<option value="${this.escapeHtml(p.player_id)}"${row.choice === p.player_id ? ' selected' : ''}>${this.escapeHtml(p.name)}</option>`)
        ].join('');

        const stats = row.stats;
        const rebuys = (stats.buy_in_events || []).length;

        return `
            <div class="import-player-row${row.choice === SKIP ? ' is-skipped' : ''}" data-index="${index}">
                <div class="import-player-row__name">
                    ${this.escapeHtml(stats.name)}
                    <span class="import-player-row__meta">
                        ${stats.hands_dealt} hands${rebuys ? ` · ${rebuys} buy-in${rebuys !== 1 ? 's' : ''}` : ''}
                    </span>
                </div>
                <div class="import-player-row__who">
                    <label class="import-field-label" for="import-who-${index}">Player</label>
                    <select id="import-who-${index}" data-role="who">${options}</select>
                    ${row.choice === NEW_PLAYER ? `
                        <input type="text" data-role="new-name" placeholder="New player name"
                               value="${this.escapeHtml(row.newName)}" style="margin-top: 0.5rem;">` : ''}
                </div>
                <div>
                    <label class="import-field-label" for="import-buyin-${index}">Buy-in</label>
                    <input type="number" id="import-buyin-${index}" data-role="buy-in"
                           min="0" step="0.01" value="${Number(row.buyIn).toFixed(2)}">
                </div>
                <div>
                    <label class="import-field-label" for="import-cashout-${index}">Cash-out</label>
                    <input type="number" id="import-cashout-${index}" data-role="cash-out"
                           min="0" step="0.01" value="${Number(row.cashOut).toFixed(2)}">
                </div>
                <div class="import-player-row__net" data-role="net"></div>
            </div>
        `;
    }

    renderAwards() {
        const awards = this.analysis.awards || [];
        if (!awards.length) return '';
        return `
            <div class="neo-card" style="margin-bottom: 1.5rem;">
                <h3 class="section-title">🏅 Awards from this Night</h3>
                <div class="award-grid">${awards.map(a => renderAwardCard(a)).join('')}</div>
            </div>
        `;
    }

    setupReviewListeners() {
        const container = document.getElementById('import-rows');
        if (container) {
            container.addEventListener('input', (event) => this.onRowInput(event));
            container.addEventListener('change', (event) => this.onRowInput(event));
        }

        const dateInput = document.getElementById('import-date');
        if (dateInput) dateInput.addEventListener('change', () => { this.date = dateInput.value; });

        const buyInInput = document.getElementById('import-buyin');
        if (buyInInput) buyInInput.addEventListener('change', () => { this.buyIn = Number(buyInInput.value); });

        const commitBtn = document.getElementById('import-commit-btn');
        if (commitBtn) commitBtn.addEventListener('click', () => this.commit());

        const backBtn = document.getElementById('import-back-btn');
        if (backBtn) backBtn.addEventListener('click', () => this.load());
    }

    onRowInput(event) {
        const rowEl = event.target.closest('.import-player-row');
        if (!rowEl) return;
        const index = Number(rowEl.dataset.index);
        const row = this.rows[index];
        if (!row) return;

        const role = event.target.dataset.role;
        if (role === 'who') {
            const previous = row.choice;
            row.choice = event.target.value;
            rowEl.classList.toggle('is-skipped', row.choice === SKIP);
            // The free-text name field only exists for "create new", so the
            // row has to be redrawn when it appears or disappears.
            if ((previous === NEW_PLAYER) !== (row.choice === NEW_PLAYER)) {
                rowEl.outerHTML = this.renderRow(row, index);
            }
        } else if (role === 'new-name') {
            row.newName = event.target.value;
        } else if (role === 'buy-in') {
            row.buyIn = Number(event.target.value);
        } else if (role === 'cash-out') {
            row.cashOut = Number(event.target.value);
        }

        this.updateBalance();
    }

    activeRows() {
        return this.rows.filter(row => row.choice !== SKIP);
    }

    updateBalance() {
        const rows = this.activeRows();
        const totalIn = rows.reduce((sum, r) => sum + (Number(r.buyIn) || 0), 0);
        const totalOut = rows.reduce((sum, r) => sum + (Number(r.cashOut) || 0), 0);
        const difference = Math.round((totalOut - totalIn) * 100) / 100;
        const balanced = Math.abs(difference) < 0.01;

        this.rows.forEach((row, index) => {
            const netEl = this.appContent.querySelector(`.import-player-row[data-index="${index}"] [data-role="net"]`);
            if (!netEl) return;
            const net = (Number(row.cashOut) || 0) - (Number(row.buyIn) || 0);
            netEl.textContent = formatCurrency(net);
            netEl.style.color = net >= 0 ? 'var(--profit-positive)' : 'var(--profit-negative)';
        });

        const banner = document.getElementById('import-balance');
        if (!banner) return;
        banner.innerHTML = `
            <div class="import-balance ${balanced ? 'is-balanced' : 'is-off'}">
                <span class="import-balance__figure">
                    ${balanced ? '✅' : '⚠️'} In ${formatCurrency(totalIn)} · Out ${formatCurrency(totalOut)}
                </span>
                <span class="import-balance__figure">
                    ${balanced
                        ? 'Balanced'
                        : `${difference > 0 ? 'Over' : 'Short'} by ${formatCurrency(Math.abs(difference))}`}
                </span>
            </div>
        `;
    }

    async commit() {
        if (this.busy) return;
        const errorEl = document.getElementById('import-error');
        const commitBtn = document.getElementById('import-commit-btn');
        const setError = (message) => { if (errorEl) errorEl.textContent = message; };

        const rows = this.activeRows();
        if (!rows.length) return setError('Pick at least one player to import.');
        if (!this.date) return setError('Choose a date for this session.');
        if (!(this.buyIn > 0)) return setError('Enter the standard buy-in.');

        const unnamed = rows.find(r => r.choice === NEW_PLAYER && !r.newName.trim());
        if (unnamed) return setError(`Give ${unnamed.stats.name} a name, or set them to "Don't import".`);

        const chosen = rows.filter(r => r.choice !== NEW_PLAYER).map(r => r.choice);
        if (new Set(chosen).size !== chosen.length) {
            return setError('Two PokerNow names are mapped to the same player.');
        }

        setError('');
        this.busy = true;
        if (commitBtn) {
            commitBtn.disabled = true;
            commitBtn.textContent = 'Importing…';
        }

        try {
            const result = await this.api.commitPokerNowImport({
                date: this.date,
                default_buy_in_value: this.buyIn,
                filename: this.analysis.filename,
                stats: this.analysis,
                end_session: true,
                players: rows.map(row => ({
                    seat: row.seat,
                    player_id: row.choice === NEW_PLAYER ? '' : row.choice,
                    new_player_name: row.choice === NEW_PLAYER ? row.newName.trim() : '',
                    buy_in: Number(row.buyIn) || 0,
                    cash_out: Number(row.cashOut) || 0,
                    buy_in_count: Math.max((row.stats.buy_in_events || []).length, 1),
                    seven_two_wins: row.stats.seven_two_wins || 0
                }))
            });
            window.location.hash = `#session/${result.session_id}`;
        } catch (error) {
            setError(error.message || 'The import failed.');
            if (commitBtn) {
                commitBtn.disabled = false;
                commitBtn.textContent = 'Import Session';
            }
        } finally {
            this.busy = false;
        }
    }
}
