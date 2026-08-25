// Session detail page module
import ApiService from './api-service.js';
import { NotificationManager } from './notification-manager.js';
import { staggerChildren } from './animations.js';
import Router from './router.js';
import EventBus from './event-bus.js';
import { formatCurrency, formatDate } from './formatters.js';
import { renderSkeleton, renderSkeletonPage, renderSkeletonStatGrid, showPageError } from './ui.js';
import { renderChipDistribution, renderLogStats, renderPlayersListHTML } from './session-detail-renderers.js';
import AddPlayersPickerController from './session-add-players-picker.js';

export default class SessionDetailPage {
    static skeleton() {
        let players = '';
        for (let i = 0; i < 5; i++) {
            players +=
                '<div class="neo-card" style="margin-bottom: 1rem;">' +
                    renderSkeleton({ classes: 'skeleton-text', style: 'width: 40%;' }) +
                    '<div style="display: flex; gap: 2rem;">' +
                        renderSkeleton({ classes: 'skeleton-text', style: 'width: 80px;' }) +
                        renderSkeleton({ classes: 'skeleton-text', style: 'width: 80px;' }) +
                        renderSkeleton({ classes: 'skeleton-text', style: 'width: 80px;' }) +
                    '</div>' +
                '</div>';
        }
        return renderSkeletonPage([
            // Action bar (back + primary button)
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">' +
                renderSkeleton({ classes: 'skeleton-btn', style: 'width: 160px;' }) +
                renderSkeleton({ classes: 'skeleton-btn', style: 'width: 100px;' }) +
            '</div>',
            // Session header card
            '<div class="neo-card">' +
                renderSkeleton({ style: 'width: 60%; height: 1.75rem; margin-bottom: 1.5rem;' }) +
                renderSkeletonStatGrid({ count: 4 }) +
            '</div>',
            // Player table
            renderSkeleton({ style: 'width: 30%; height: 1.5rem; margin: 2rem 0 1.5rem 0;' }),
            players
        ]);
    }

    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.notificationManager = new NotificationManager(apiService);
        this.addPlayersPicker = new AddPlayersPickerController();
    }
    

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Load session detail page
    async load(sessionId) {
        try {
            // Fetch session data using API service
            const session = await this.api.get(`sessions/${sessionId}`);
            
            // Fetch player directory for the add-players picker
            const availablePlayers = await this.api.get('players/details');

            // Hand statistics, when this session was imported from a PokerNow
            // log. Most sessions have none, so a 404 here is the normal case.
            session.logStats = await this.api.getSessionImport(sessionId).catch(() => null);

            // Calculate total value and unpaid value
            if (session.entries) {
                session.totalValue = session.entries.reduce((sum, entry) => sum + entry.total_buy_in_amount, 0);
                const totalPayout = session.entries.reduce((sum, entry) => sum + entry.payout, 0);
                const rawUnpaidValue = session.totalValue - totalPayout;
                // Round to nearest cent to avoid floating point precision issues
                session.unpaidValue = Math.round(rawUnpaidValue * 100) / 100;
                
                // Map entries to players for easier display
                session.players = session.entries.map(entry => ({
                    id: entry.player_id,
                    name: entry.player_name,
                    buyIn: entry.total_buy_in_amount,
                    cashOut: entry.payout,
                    isCashedOut: entry.is_cashed_out || false,
                    sevenTwoWins: entry.session_seven_two_wins || 0,
                    strikes: entry.session_strikes || 0,
                    buyInCount: entry.buy_in_count || 1
                }));
            } else {
                session.totalValue = 0;
                session.unpaidValue = 0;
                session.players = [];
            }

            session.allPlayers = availablePlayers || [];
            this.addPlayersPicker.reset();
            
            // Ensure the buy-in value is available for the form
            if (session.session_info && session.session_info.default_buy_in_value) {
                session.buyin = session.session_info.default_buy_in_value;
            } else if (session.default_buy_in_value) {
                session.buyin = session.default_buy_in_value;
            } else {
                session.buyin = 20.00; // Default value
            }
            
            const dateForTitle = (session.session_info || session).date;
            document.title = `Session - ${formatDate(dateForTitle)} - Gamble King`;

            // Render session details
            this.render(session, sessionId);
        } catch (error) {
            console.error(`Error loading session details for ${sessionId}:`, error);
            showPageError(this.appContent, {
                message: 'Could not load this session. ' + error.message
            });
        }
    }
    

    // Context object handed to the add-players picker controller: the live
    // session plus the callbacks it needs, so the controller never touches
    // page internals directly.
    pickerContext() {
        return {
            currentSession: this.currentSession,
            api: this.api,
            refreshEntries: (newEntries, sessionId) => this.refreshEntries(newEntries, sessionId)
        };
    }

    // Partially refresh the session page after an action — no full reload needed
    refreshEntries(newEntries, sessionId) {
        const session = this.currentSession;
        const sessionData = session.session_info || session;
        const isActive = sessionData.is_active === true;

        // Remap entries → players
        session.players = newEntries.map(entry => ({
            id: entry.player_id,
            name: entry.player_name,
            buyIn: entry.total_buy_in_amount,
            cashOut: entry.payout,
            isCashedOut: entry.is_cashed_out || false,
            sevenTwoWins: entry.session_seven_two_wins || 0,
            strikes: entry.session_strikes || 0,
            buyInCount: entry.buy_in_count || 1
        }));

        // Recalculate totals
        session.totalValue = newEntries.reduce((sum, e) => sum + e.total_buy_in_amount, 0);
        const totalPayout = newEntries.reduce((sum, e) => sum + e.payout, 0);
        session.unpaidValue = Math.round((session.totalValue - totalPayout) * 100) / 100;

        // Update totals in header card
        const totalValueEl = document.getElementById('session-total-value');
        if (totalValueEl) totalValueEl.textContent = formatCurrency(session.totalValue);

        const unpaidLabelEl = document.getElementById('session-unpaid-label');
        const unpaidValueEl = document.getElementById('session-unpaid-value');
        if (unpaidLabelEl) {
            unpaidLabelEl.textContent = session.unpaidValue > 0.01 ? 'Unpaid' : session.unpaidValue < -0.01 ? 'House Loss' : 'Payout';
        }
        if (unpaidValueEl) {
            unpaidValueEl.className = session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'profit-negative' : 'profit-positive';
            if (session.unpaidValue > 0.01) {
                unpaidValueEl.textContent = formatCurrency(session.unpaidValue);
            } else if (session.unpaidValue < -0.01) {
                unpaidValueEl.textContent = formatCurrency(session.unpaidValue);
            } else {
                unpaidValueEl.textContent = !isActive ? 'PAID OUT' : formatCurrency(0);
            }
        }

        // Re-render players list
        const container = document.getElementById('players-list-container');
        if (container) {
            container.innerHTML = renderPlayersListHTML(session, isActive);
        }

        // Update end-session button state
        const allCashedOut = session.players.length > 0 && session.players.every(p => !!p.isCashedOut);
        const endNote = document.getElementById('end-session-note');
        const endBtn = document.getElementById('end-session-btn');
        if (endNote) endNote.style.display = allCashedOut ? 'none' : '';
        if (endBtn) {
            endBtn.disabled = !allCashedOut;
            endBtn.style.opacity = allCashedOut ? '' : '0.5';
            endBtn.style.cursor = allCashedOut ? '' : 'not-allowed';
        }

        if (isActive) {
            this.addPlayersPicker.refresh(this.pickerContext(), sessionData, sessionId);
        }

        // Re-attach player-specific event listeners
        this.setupPlayerEventListeners(sessionData, sessionId);

        // Brief highlight animation on all updated player cards
        if (container) {
            container.querySelectorAll('.neo-card[data-player-id]').forEach(card => {
                card.classList.add('entry-updated');
                setTimeout(() => card.classList.remove('entry-updated'), 700);
            });
        }
    }

    // Render session detail content
    render(session, sessionId) {
        console.log("Full session in render:", JSON.stringify(session, null, 2));

        // Store session for use in event handlers
        this.currentSession = session;

        // Extract the session data from the response structure
        const sessionData = session.session_info || session;
        console.log("Session data extracted:", JSON.stringify(sessionData, null, 2));
        
        // Check if session is active based on multiple possible indicators
        // If is_active is explicitly false OR status is explicitly ENDED, then it's not active
        // Default to inactive if is_active is missing
        const isActive = sessionData.is_active === true;
        const shouldShowWisdomSection = isActive || !!sessionData.wisdom_quote;
        const wisdomStartsExpanded = !isActive && !!sessionData.wisdom_quote;
        
        console.log("Session active calculation:",
            "is_active =", sessionData.is_active,
            "status =", sessionData.status,
            "final isActive =", isActive);
        
        let html = `
            <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <!-- Header with navigation -->
                <div class="detail-action-bar">
                    <button id="session-detail-back-btn" type="button" class="neo-btn neo-btn-purple detail-back-btn">← Back</button>
                    <button id="share-btn" class="neo-btn neo-btn-gold">&#128203; Share</button>
                </div>
                ${isActive ?
                    `<div style="margin-bottom: 2rem;">
                        <button id="notification-btn" class="neo-btn neo-btn-gold" data-state="loading" style="width: 100%;">
                            <span class="btn-text">🔔 Notifications</span>
                        </button>
                    </div>` :
                    '<div style="margin-bottom: 1rem;"></div>'
                }
                
                <!-- Session Info Card -->
                <div class="neo-card ${isActive ? 'neo-card-gold' : 'neo-card-primary'}">
                    <h2 class="page-title--detail" style="margin-bottom: 1.5rem;">
                        🎯 ${formatDate(sessionData.date)}
                    </h2>
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.25rem;">
                        <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; ${isActive ? 'background: rgba(245, 158, 11, 0.15); color: var(--casino-gold-dark);' : 'background: rgba(22, 163, 74, 0.15); color: var(--casino-green-dark);'}">
                            ${isActive ? '● ACTIVE' : '● ENDED'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 0.5rem;">
                        <div>
                            <div class="stat-label">Buy-in</div>
                            <div class="stat-value-lg">${formatCurrency(sessionData.default_buy_in_value || 0)}</div>
                        </div>
                        <div style="width: 1px; background: var(--border-light, #E2E8F0);"></div>
                        <div>
                            <div class="stat-label">Total Value</div>
                            <div id="session-total-value" class="stat-value-lg">${formatCurrency(session.totalValue || 0)}</div>
                        </div>
                        <div style="width: 1px; background: var(--border-light, #E2E8F0);"></div>
                        <div>
                            <div id="session-unpaid-label" class="stat-label">${session.unpaidValue > 0.01 ? 'Unpaid' : session.unpaidValue < -0.01 ? 'House Loss' : 'Payout'}</div>
                            <div id="session-unpaid-value" class="stat-value-lg ${session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'profit-negative' : 'profit-positive'}">
                                ${session.unpaidValue > 0.01 ?
                                    formatCurrency(session.unpaidValue) :
                                    session.unpaidValue < -0.01 ?
                                    formatCurrency(session.unpaidValue) :
                                    (!isActive ? 'PAID OUT' : formatCurrency(0))}
                            </div>
                        </div>
                    </div>
                </div>

                ${shouldShowWisdomSection ? `
                <div class="neo-card ${sessionData.wisdom_quote ? 'neo-card-gold' : ''}" style="margin-top: 2rem;">
                    <div id="wisdom-toggle-btn" role="button" tabindex="0" aria-expanded="${wisdomStartsExpanded ? 'true' : 'false'}" style="width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer; text-align: left;">
                        <span style="font-size: 1.25rem; font-weight: 600; color: ${sessionData.wisdom_quote ? 'var(--casino-gold-dark)' : 'var(--text-primary)'};">💬 Words of Wisdom</span>
                        <span id="wisdom-toggle-icon" style="font-size: 1rem; font-weight: 700;">${wisdomStartsExpanded ? '−' : '+'}</span>
                    </div>
                    <div id="wisdom-content" style="display: ${wisdomStartsExpanded ? 'block' : 'none'}; margin-top: 1rem;">
                        ${sessionData.wisdom_quote ? `
                        <div style="text-align: center; margin-bottom: ${isActive ? '1.5rem' : '0'};">
                            <p style="font-size: 1.25rem; font-style: italic; color: var(--text-primary); margin-bottom: 0.5rem;">
                                "${sessionData.wisdom_quote}"
                            </p>
                            <p style="font-size: 1rem; font-weight: 700; color: var(--text-secondary); margin: 0;">
                                — ${session.players?.find(p => p.id === sessionData.wisdom_player_id)?.name || 'Unknown'}
                            </p>
                        </div>
                        ` : ''}
                        ${isActive ? `
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <h4 style="font-size: 1.125rem; font-weight: 600; margin: 0; color: var(--text-primary);">${sessionData.wisdom_quote ? 'Edit Quote' : 'Add Quote'}</h4>
                            <textarea id="wisdom-quote-input" placeholder="Enter the quote..." style="min-height: 80px; resize: vertical; margin-bottom: 0;">${sessionData.wisdom_quote || ''}</textarea>
                            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                                <select id="wisdom-player-select" style="flex: 1; min-width: 200px;">
                                    <option value="">-- Who said it? --</option>
                                    ${(session.players || []).map(player =>
                                        `<option value="${player.id}" ${player.id === sessionData.wisdom_player_id ? 'selected' : ''}>${player.name}</option>`
                                    ).join('')}
                                </select>
                                <button id="save-wisdom-btn" class="neo-btn neo-btn-gold" style="margin-left: auto;">Save Quote</button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <div class="session-players-header">
                    <h3 class="section-heading">🎭 Players</h3>
                    ${isActive ? `
                        <div id="add-players-card-container">
                            ${this.addPlayersPicker.renderCard(this.pickerContext(), sessionData)}
                        </div>
                    ` : ''}
                </div>
        `;

        if (isActive) {
            // Log available players to debug
            console.log("Players available for picker:", session.allPlayers);
        }
        
        // Render players list
        html += `<div id="players-list-container">`;
        html += renderPlayersListHTML(session, isActive);
        html += `</div>`;
        
        html += renderLogStats(session);

        // Add chip distribution section after players (only for active sessions)
        if (isActive) {
            html += `
                <!-- Chip Distribution Section -->
                <div id="chip-distribution-container">
                ${renderChipDistribution(session)}
                </div>
            `;
        }
        
        // Add session control buttons at the bottom
        const allCashedOut = !session.players || session.players.length === 0 || session.players.every(p => !!p.isCashedOut);
        html += `
                <!-- Session Controls -->
                <div style="margin-top: 2rem; text-align: center;">
                    ${isActive ?
                        `${!allCashedOut ? `<p id="end-session-note" style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Cash out all players before ending the session</p>` : ''}
                        <button id="end-session-btn" class="neo-btn neo-btn-red neo-btn-lg" ${!allCashedOut ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            End Session
                        </button>` :
                        `<button id="reactivate-session-btn" class="neo-btn neo-btn-green neo-btn-lg">
                            ▶️ Reactivate Session
                        </button>`
                    }
                </div>
            </div>
        `;
        
        
        // Log the HTML about to be rendered
        console.log("Full HTML being set:", html);

        this.appContent.innerHTML = html;

        // Stagger animate player cards
        staggerChildren(this.appContent, '.neo-card');

        // Add styling for the session bottom controls
        const styleElement = document.createElement('style');
        styleElement.id = 'session-detail-page-styles';
        styleElement.textContent = `
            .session-bottom-controls {
                margin: 1.25rem 0;
                padding: 1rem;
                border-top: 1px solid #ddd;
                text-align: center;
            }
            
            /* Session control buttons now use neobrutalist styling */
            
            /* Ensure proper spacing for session reactivate button */
            .session-reactivate-container {
                text-align: center;
                margin: 1.25rem 0;
            }
            
            /* Cash Out and Buy In buttons now use neobrutalist styling */

            /* Flash animation for graceful entry updates */
            @keyframes entryFlash {
                0%   { outline: 3px solid rgba(245, 158, 11, 0.7); }
                100% { outline: 3px solid transparent; }
            }
            .entry-updated {
                animation: entryFlash 0.7s ease-out;
            }

            /* Generic success button style */
            .success-btn {
                background-color: #4CAF50;
                color: white;
            }
            
            /* Clickable player details styling */
            .clickable-player-details {
                cursor: pointer !important;
            }

            .session-players-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                margin: 2rem 0 1.5rem 0;
            }

            #add-players-card-container {
                margin-left: auto;
                flex-shrink: 0;
            }

            .session-player-picker-card {
                display: flex;
            }

            .session-player-picker-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 0.75rem;
                max-height: 340px;
                overflow-y: auto;
                padding-right: 0.25rem;
            }

            .session-player-picker-option {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                border-radius: 14px;
                border: 1px solid var(--border-light, #E2E8F0);
                background: var(--bg-card);
                box-shadow: var(--neo-shadow-sm);
                cursor: pointer;
                transition: all 0.18s ease;
            }

            .session-player-picker-option:hover {
                transform: translateY(-1px);
                box-shadow: var(--neo-shadow-md);
            }

            .session-player-picker-option.already-in {
                cursor: default;
                background: rgba(15, 23, 42, 0.04);
                border-color: rgba(15, 23, 42, 0.08);
                box-shadow: none;
            }

            [data-theme="dark"] .session-player-picker-option.already-in {
                background: rgba(148, 163, 184, 0.08);
                border-color: rgba(148, 163, 184, 0.16);
            }

            .session-player-picker-option.selected {
                border-color: rgba(16, 185, 129, 0.35);
                background: rgba(16, 185, 129, 0.08);
            }

            .session-player-picker-option input {
                margin: 0;
                width: 18px;
                height: 18px;
                accent-color: var(--casino-green);
            }

            .session-player-picker-name {
                font-weight: 700;
                color: var(--text-primary);
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .session-player-picker-toolbar {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 0.75rem;
                margin-bottom: 1rem;
            }

            .session-player-picker-footer {
                display: grid;
                gap: 0.9rem;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--border-light, #E2E8F0);
            }

            .session-player-picker-footer-summary {
                color: var(--text-secondary);
                font-weight: 600;
            }

            @media (max-width: 700px) {
                .session-player-picker-toolbar {
                    grid-template-columns: 1fr;
                }
            }
        `;
        // Idempotent: full re-renders re-create this block; swap instead of stacking copies in <head>
        const previousStyles = document.getElementById('session-detail-page-styles');
        if (previousStyles) {
            previousStyles.replaceWith(styleElement);
        } else {
            document.head.appendChild(styleElement);
        }
        
        // Enhanced button debugging
        setTimeout(() => {
            // Simple check to verify buttons are rendered
            console.log("Button check after render:");
            console.log("- Delete button exists:", !!document.getElementById('delete-session-btn'));
            console.log("- Reactivate button exists:", !!document.getElementById('reactivate-session-btn'));
            console.log("- End button exists:", !!document.getElementById('end-session-btn'));
            console.log("- Add player button exists:", !!document.getElementById('add-player-to-session-btn'));
            console.log("- Cash Out buttons count:", document.querySelectorAll('.cash-out-player-btn').length);
        }, 100); // Small timeout to ensure DOM is ready
        
        console.log("Before setting up event listeners, isActive:", isActive);
        // Add event listeners
        this.setupEventListeners(sessionData, sessionId, isActive);
    }
    
    async handleShare() {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: document.title, url });
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
        const btn = document.getElementById('share-btn');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '✅ Copied!';
            setTimeout(() => btn.innerHTML = original, 2000);
        }
    }

    // Setup event listeners for the page
    setupEventListeners(session, sessionId, isActive) {
        console.log("Setting up event listeners, isActive:", isActive);

        const backBtn = document.getElementById('session-detail-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => Router.navigateBack('sessions'));
        }

        const wisdomToggleBtn = document.getElementById('wisdom-toggle-btn');
        const wisdomContent = document.getElementById('wisdom-content');
        const wisdomToggleIcon = document.getElementById('wisdom-toggle-icon');
        if (wisdomToggleBtn && wisdomContent && wisdomToggleIcon) {
            const toggleWisdom = () => {
                const isExpanded = wisdomContent.style.display !== 'none';
                wisdomContent.style.display = isExpanded ? 'none' : 'block';
                wisdomToggleBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
                wisdomToggleIcon.textContent = isExpanded ? '+' : '−';
            };

            wisdomToggleBtn.addEventListener('click', toggleWisdom);
            wisdomToggleBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleWisdom();
                }
            });
        }

        // Share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.handleShare());
        }
        
        const reactivateBtn = document.getElementById('reactivate-session-btn');
        const endBtn = document.getElementById('end-session-btn');
        
        console.log("Manual button check:");
        console.log("- Reactivate button:", reactivateBtn);
        console.log("- End button:", endBtn);
        
        if (!isActive) {
            // Reactivate session button
            if (reactivateBtn) {
                console.log("Found reactivate session button");
                reactivateBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to reactivate this session? Players will be able to join and make moves again.")) {
                        try {
                            reactivateBtn.disabled = true;
                            reactivateBtn.textContent = 'Reactivating...';
                            
                            await this.api.put(`sessions/${sessionId}/reactivate`);
                            EventBus.emit('data:sessions-changed');

                            // Reload the page to show updated session state
                            this.load(sessionId);
                        } catch (error) {
                            console.error('Error reactivating session:', error);
                            alert(`Error: ${error.message}`);
                            
                            // Restore button state
                            reactivateBtn.disabled = false;
                            reactivateBtn.textContent = 'Reactivate Session';
                        }
                    }
                });
            }
        }
        
        if (isActive) {
            // End session button
            const endSessionBtn = document.getElementById('end-session-btn');
            if (endSessionBtn) {
                console.log("Found end session button");
                endSessionBtn.addEventListener('click', async () => {
                    // Check if all players have been cashed out
                    const players = this.currentSession?.players || [];
                    const uncashedPlayers = players.filter(p => !p.isCashedOut);

                    if (uncashedPlayers.length > 0) {
                        const names = uncashedPlayers.map(p => p.name).join(', ');
                        alert(`Cannot end session — the following players have not been cashed out yet:\n\n${names}\n\nPlease cash out all players before ending the session.`);
                        return;
                    }

                    // Check for money discrepancy
                    const unpaidValue = this.currentSession?.unpaidValue || 0;
                    const hasDiscrepancy = Math.abs(unpaidValue) > 0.01;

                    if (hasDiscrepancy) {
                        // Show custom confirmation modal for discrepancy
                        this.showDiscrepancyModal(unpaidValue, sessionId, endSessionBtn);
                    } else {
                        // No discrepancy - proceed with standard confirmation
                        if (confirm("Are you sure you want to end this session? This will finalize profits.")) {
                            await this.endSession(sessionId, endSessionBtn);
                        }
                    }
                });
            }
            
            // Save wisdom quote button
            const saveWisdomBtn = document.getElementById('save-wisdom-btn');
            const wisdomQuoteInput = document.getElementById('wisdom-quote-input');
            const wisdomPlayerSelect = document.getElementById('wisdom-player-select');

            if (saveWisdomBtn && wisdomQuoteInput && wisdomPlayerSelect) {
                saveWisdomBtn.addEventListener('click', async () => {
                    const quote = wisdomQuoteInput.value.trim();
                    const playerId = wisdomPlayerSelect.value;

                    if (quote && !playerId) {
                        alert('Please select who said the quote');
                        return;
                    }

                    try {
                        // Show loading state
                        saveWisdomBtn.disabled = true;
                        saveWisdomBtn.textContent = 'Saving...';

                        await this.api.put(`sessions/${sessionId}/wisdom`, {
                            wisdom_quote: quote,
                            wisdom_player_id: playerId || null
                        });

                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error saving wisdom quote:', error);
                        alert(`Error: ${error.message}`);

                        // Restore button state
                        saveWisdomBtn.disabled = false;
                        saveWisdomBtn.textContent = 'Save Quote';
                    }
                });
            }

            // Add player to session button
            this.addPlayersPicker.setup(this.pickerContext(), session, sessionId);
            
            // Set up notification functionality for active sessions
            this.setupNotificationHandlers(sessionId);
        }

        // Set up player card event listeners (cash-out, buy-in, strikes, 7-2, card click)
        this.setupPlayerEventListeners(session, sessionId);

    }


    // Show an inline edit popup for a player in an active session
    showPlayerEditModal(player, sessionData, sessionId) {
        // Remove a stale copy before mounting a new one (same as the add-players picker).
        const stale = document.getElementById('player-edit-modal-wrapper');
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
        const modalElement = document.createElement('div');
        modalElement.id = 'player-edit-modal-wrapper';
        // True once the entrance has played; re-renders after API actions must
        // restore .active synchronously or the modal flashes closed.
        let opened = false;

        const renderModal = () => {
            const p = this.currentSession.players.find(pp => pp.id === player.id) || player;
            const buyInCount = p.buyInCount || 1;
            const totalBuyIn = p.buyIn || 0;
            const cashOut = p.cashOut || 0;

            modalElement.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <button id="edit-modal-close" class="modal-close-btn" type="button" aria-label="Close player edit">&times;</button>
                        <h3>${this.escapeHtml(p.name)}</h3>

                        <!-- Buy-ins -->
                        <div style="margin-bottom: 1.25rem;">
                            <div class="modal-section-label">Buy-ins</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button id="edit-buyin-minus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%;${buyInCount <= 1 ? ' opacity: 0.4;' : ''}" ${buyInCount <= 1 ? 'disabled' : ''}>−</button>
                                <span style="font-size: 1.25rem; font-weight: 700; min-width: 2rem; text-align: center;">${buyInCount}</span>
                                <button id="edit-buyin-plus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%;">+</button>
                                <span style="font-size: 0.875rem; color: var(--text-secondary); margin-left: 0.25rem;">(${formatCurrency(totalBuyIn)} total)</span>
                            </div>
                        </div>

                        <!-- Cash-out amount -->
                        <div style="margin-bottom: 1.25rem;">
                            <div class="modal-section-label">Cash-out Amount</div>
                            <input type="text" id="edit-cashout-input" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" value="${cashOut > 0 ? cashOut.toFixed(2) : ''}" placeholder="0.00" style="width: 100%; margin-bottom: 0;">
                        </div>

                        <!-- 7-2 Wins -->
                        <div style="margin-bottom: 1.25rem;">
                            <div class="modal-section-label">7-2 Wins</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button id="edit-72-minus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--casino-gold); color: var(--casino-gold);${(p.sevenTwoWins || 0) <= 0 ? ' opacity: 0.4;' : ''}" ${(p.sevenTwoWins || 0) <= 0 ? 'disabled' : ''}>−</button>
                                <span style="font-size: 1.25rem; font-weight: 700; min-width: 2rem; text-align: center; color: var(--casino-gold);">${p.sevenTwoWins || 0}</span>
                                <button id="edit-72-plus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--casino-gold); color: var(--text-white);">+</button>
                            </div>
                        </div>

                        <!-- Strikes -->
                        <div style="margin-bottom: 1.25rem;">
                            <div class="modal-section-label">Strikes</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button id="edit-strikes-minus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--casino-red); color: var(--casino-red);${(p.strikes || 0) <= 0 ? ' opacity: 0.4;' : ''}" ${(p.strikes || 0) <= 0 ? 'disabled' : ''}>−</button>
                                <span style="font-size: 1.25rem; font-weight: 700; min-width: 2rem; text-align: center; color: var(--casino-red);">${p.strikes || 0}</span>
                                <button id="edit-strikes-plus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--casino-red); color: var(--text-white);">+</button>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="border-top: 1px solid var(--border-light, #eee); padding-top: 1rem; text-align: center;">
                            <a href="#player/${p.id}" id="edit-modal-profile-link" style="font-size: 0.875rem; font-weight: 600; color: var(--casino-gold);">View Player Profile →</a>
                        </div>
                    </div>
                </div>
            `;
            if (opened) modalElement.querySelector('.modal-overlay').classList.add('active');
        };
        renderModal();
        document.body.appendChild(modalElement);

        const handleEscape = (event) => {
            if (event.key === 'Escape') closeModal();
        };
        const closeModal = () => {
            document.removeEventListener('keydown', handleEscape);
            if (modalElement.parentNode) document.body.removeChild(modalElement);
        };
        document.addEventListener('keydown', handleEscape);

        // Play the canonical fade + rise entrance: paint one hidden frame first,
        // then reveal and focus the first field.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const overlay = modalElement.querySelector('.modal-overlay');
            if (!overlay) return;
            overlay.classList.add('active');
            opened = true;
            const cashoutInput = modalElement.querySelector('#edit-cashout-input');
            if (cashoutInput) cashoutInput.focus();
        }));
        const apiAction = async (fn) => {
            try {
                const newEntries = await fn();
                this.refreshEntries(newEntries, sessionId);
                renderModal();
                attachListeners();
            } catch (error) {
                console.error('Error in player edit modal:', error);
                alert(`Error: ${error.message}`);
            }
        };

        const attachListeners = () => {
            modalElement.querySelector('#edit-modal-close')?.addEventListener('click', closeModal);
            modalElement.querySelector('#edit-modal-profile-link')?.addEventListener('click', closeModal);
            // Close on overlay click
            modalElement.querySelector(':scope > .modal-overlay')?.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) closeModal();
            });

            // Buy-in controls
            modalElement.querySelector('#edit-buyin-minus')?.addEventListener('click', () => {
                const p = this.currentSession.players.find(pp => pp.id === player.id);
                if (p && (p.buyInCount || 1) > 1) {
                    apiAction(() => this.api.put(`sessions/${sessionId}/entries/${player.id}/remove-buyin`));
                }
            });
            modalElement.querySelector('#edit-buyin-plus')?.addEventListener('click', () => {
                apiAction(() => this.api.post(`sessions/${sessionId}/entries/${player.id}/buy-in`, { num_buy_ins: 1 }));
            });

            // Cash-out input
            const cashoutInput = modalElement.querySelector('#edit-cashout-input');
            if (cashoutInput) {
                let cashoutDebounce = null;
                const saveCashout = async () => {
                    const val = parseFloat(cashoutInput.value);
                    if (isNaN(val) || val < 0) return;
                    await apiAction(() => this.api.put(`sessions/${sessionId}/entries/${player.id}/payout`, { payout_amount: val }));
                };
                cashoutInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveCashout(); }
                });
                cashoutInput.addEventListener('blur', () => {
                    clearTimeout(cashoutDebounce);
                    cashoutDebounce = setTimeout(saveCashout, 100);
                });
                cashoutInput.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
                    e.target.value = value;
                });
            }

            // 7-2 controls
            modalElement.querySelector('#edit-72-minus')?.addEventListener('click', () => {
                apiAction(() => this.api.put(`sessions/${sessionId}/players/${player.id}/seven-two-wins/decrement`));
            });
            modalElement.querySelector('#edit-72-plus')?.addEventListener('click', () => {
                apiAction(() => this.api.put(`sessions/${sessionId}/players/${player.id}/seven-two-wins/increment`));
            });

            // Strikes controls
            modalElement.querySelector('#edit-strikes-minus')?.addEventListener('click', () => {
                apiAction(() => this.api.put(`sessions/${sessionId}/players/${player.id}/strikes/decrement`));
            });
            modalElement.querySelector('#edit-strikes-plus')?.addEventListener('click', () => {
                apiAction(() => this.api.put(`sessions/${sessionId}/players/${player.id}/strikes/increment`));
            });
        };

        attachListeners();

    }

    // Canonical dialog chrome for the per-player confirmation dialogs (Cash Out /
    // Buy In): shared modal-overlay + modal-content--compact, double-rAF entrance,
    // Escape and backdrop click to dismiss.
    _showConfirmDialog({ title, labelFor, inputId, inputAttrs, inputValue, actionLabel, confirmClass }) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const content = document.createElement('div');
        content.className = 'modal-content modal-content--compact';
        content.innerHTML = `
            <h3>${title}</h3>
            <label for="${inputId}">${labelFor}</label>
            <input ${inputAttrs}>
            <div class="modal-actions">
                <button type="button" class="neo-btn neo-btn-sm" data-action="cancel">Cancel</button>
                <button type="button" class="neo-btn ${confirmClass} neo-btn-sm" data-action="confirm">${actionLabel}</button>
            </div>
        `;
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const input = content.querySelector('#' + inputId);
        if (inputValue !== null && inputValue !== undefined) input.value = inputValue;
        const cancelBtn = content.querySelector('[data-action="cancel"]');
        const confirmBtn = content.querySelector('[data-action="confirm"]');

        const close = () => {
            document.removeEventListener('keydown', handleEscape);
            overlay.remove();
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', handleEscape);
        overlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) close();
        });
        cancelBtn.addEventListener('click', close);

        // Play the canonical fade + rise entrance: paint one hidden frame first,
        // then reveal and focus the field (visible from the first frame of the
        // transition, so focus lands once .active is applied).
        requestAnimationFrame(() => requestAnimationFrame(() => {
            overlay.classList.add('active');
            input.focus();
            if (input.select) input.select();
        }));

        return {
            input, confirmBtn, close,
            onConfirm: (fn) => confirmBtn.addEventListener('click', fn)
        };
    }

    setupPlayerEventListeners(sessionData, sessionId) {
        const isActive = sessionData.is_active === true;

        // Clickable player card — edit popup for active sessions, navigate for inactive
        document.querySelectorAll('.clickable-player-details').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                    return;
                }
                const playerId = element.dataset.playerId;
                if (!playerId) return;
                if (isActive) {
                    const player = this.currentSession.players.find(p => p.id === playerId);
                    if (player) this.showPlayerEditModal(player, sessionData, sessionId);
                } else {
                    window.location.hash = `#player/${playerId}`;
                }
            });
            element.style.cursor = 'pointer';
        });

        if (!isActive) return;

        // Cash out button
        document.querySelectorAll('.cash-out-player-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;

                const dialog = this._showConfirmDialog({
                    title: 'Cash Out Player',
                    labelFor: 'Enter cash-out amount ($):',
                    inputId: 'cashout-amount',
                    inputAttrs: 'type="text" id="cashout-amount" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*"',
                    inputValue: '',
                    actionLabel: 'Cash Out',
                    confirmClass: 'neo-btn-red'
                });
                const { input: cashoutInput, confirmBtn } = dialog;

                cashoutInput.addEventListener('input', (event) => {
                    let value = event.target.value;
                    value = value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    event.target.value = value;
                });

                dialog.onConfirm(async () => {
                    const cashOutValue = parseFloat(cashoutInput.value);

                    if (isNaN(cashOutValue) || cashOutValue < 0 || cashoutInput.value === '') {
                        alert('Please enter a valid numeric cash-out amount');
                        return;
                    }

                    try {
                        button.disabled = true;
                        button.textContent = 'Processing...';
                        confirmBtn.disabled = true;
                        confirmBtn.textContent = 'Processing...';

                        const newEntries = await this.api.put(`sessions/${sessionId}/entries/${playerId}/payout`, {
                            payout_amount: cashOutValue
                        });

                        dialog.close();
                        this.refreshEntries(newEntries, sessionId);

                    } catch (error) {
                        console.error('Error processing cash-out:', error);
                        alert(`Error: ${error.message}`);
                        dialog.close();
                        button.disabled = false;
                        button.textContent = 'Cash Out';
                    }
                });

                cashoutInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        confirmBtn.click();
                    }
                });
            });
        });

        // Buy in button
        document.querySelectorAll('.buy-in-player-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;

                const defaultBuyin = sessionData.default_buy_in_value || 20;

                const dialog = this._showConfirmDialog({
                    title: 'Buy In Player',
                    labelFor: 'Enter buy-in amount ($):',
                    inputId: 'buyin-amount',
                    inputAttrs: 'type="number" id="buyin-amount" inputmode="decimal" step="0.01" min="0"',
                    inputValue: sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00',
                    actionLabel: 'Buy In',
                    confirmClass: 'neo-btn-green'
                });
                const { input: buyinInput, confirmBtn } = dialog;

                buyinInput.addEventListener('input', (event) => {
                    let value = event.target.value;
                    value = value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    event.target.value = value;
                });

                dialog.onConfirm(async () => {
                    const buyinValue = parseFloat(buyinInput.value);

                    if (isNaN(buyinValue) || buyinValue <= 0 || buyinInput.value === '') {
                        alert('Please enter a valid buy-in amount');
                        return;
                    }

                    try {
                        button.disabled = true;
                        button.textContent = 'Processing...';
                        confirmBtn.disabled = true;
                        confirmBtn.textContent = 'Processing...';

                        const numBuyIns = Math.round(buyinValue / defaultBuyin);

                        const newEntries = await this.api.post(`sessions/${sessionId}/entries/${playerId}/buy-in`, {
                            num_buy_ins: numBuyIns
                        });

                        dialog.close();
                        this.refreshEntries(newEntries, sessionId);

                    } catch (error) {
                        console.error('Error processing buy-in:', error);
                        alert(`Error: ${error.message}`);
                        dialog.close();
                        button.disabled = false;
                        button.textContent = 'Buy In';
                    }
                });

                buyinInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        confirmBtn.click();
                    }
                });
            });
        });

        // Re-buy button
        document.querySelectorAll('.rebuy-player-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                const defaultBuyin = sessionData.default_buy_in_value || 20;
                if (!confirm(`Add a re-buy of ${formatCurrency(defaultBuyin)}?`)) return;
                try {
                    button.disabled = true;
                    button.textContent = 'Processing...';
                    const newEntries = await this.api.post(`sessions/${sessionId}/entries/${playerId}/buy-in`, {
                        num_buy_ins: 1
                    });
                    this.refreshEntries(newEntries, sessionId);
                } catch (error) {
                    console.error('Error processing re-buy:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                    button.textContent = '🔄 Re-buy';
                }
            });
        });

        // 7-2 win buttons
        document.querySelectorAll('.seven-two-increment-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                try {
                    button.disabled = true;
                    const newEntries = await this.api.put(`sessions/${sessionId}/players/${playerId}/seven-two-wins/increment`);
                    this.refreshEntries(newEntries, sessionId);
                } catch (error) {
                    console.error('Error incrementing session 7-2 wins:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('.seven-two-decrement-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                try {
                    button.disabled = true;
                    const newEntries = await this.api.put(`sessions/${sessionId}/players/${playerId}/seven-two-wins/decrement`);
                    this.refreshEntries(newEntries, sessionId);
                } catch (error) {
                    console.error('Error decrementing session 7-2 wins:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                }
            });
        });

        // Strikes buttons
        document.querySelectorAll('.strikes-increment-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                try {
                    button.disabled = true;
                    const newEntries = await this.api.put(`sessions/${sessionId}/players/${playerId}/strikes/increment`);
                    this.refreshEntries(newEntries, sessionId);
                } catch (error) {
                    console.error('Error incrementing session strikes:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('.strikes-decrement-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                try {
                    button.disabled = true;
                    const newEntries = await this.api.put(`sessions/${sessionId}/players/${playerId}/strikes/decrement`);
                    this.refreshEntries(newEntries, sessionId);
                } catch (error) {
                    console.error('Error decrementing session strikes:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                }
            });
        });
    }
    
    /**
     * Set up notification handlers for active sessions
     */
    async setupNotificationHandlers(sessionId) {
        const notificationBtn = document.getElementById('notification-btn');
        if (!notificationBtn) return;

        const currentPlayerId = this.getCurrentPlayerId();
        if (!currentPlayerId) {
            this.updateNotificationButton(notificationBtn, 'unavailable', 'Not Available');
            return;
        }

        try {
            // Check permission status first
            const permissionStatus = this.notificationManager.getPermissionStatus();
            
            if (permissionStatus === 'unsupported') {
                this.updateNotificationButton(notificationBtn, 'unavailable', 'Not Supported');
                return;
            }

            if (permissionStatus === 'denied') {
                this.updateNotificationButton(notificationBtn, 'denied', 'Permission Denied');
                return;
            }

            if (permissionStatus === 'default') {
                // Show "Get Notified" button to request permission
                this.updateNotificationButton(notificationBtn, 'request-permission', '🔔 Get Notified');
                this.setupNotificationButtonHandler(notificationBtn, sessionId, currentPlayerId, 'request-permission');
                return;
            }

            // Permission granted - check subscription status
            const isSubscribed = await this.notificationManager.isSubscribedToSession(currentPlayerId, sessionId);
            
            if (isSubscribed) {
                this.updateNotificationButton(notificationBtn, 'subscribed', '✓ Subscribed');
                this.setupNotificationButtonHandler(notificationBtn, sessionId, currentPlayerId, 'unsubscribe');
            } else {
                this.updateNotificationButton(notificationBtn, 'not-subscribed', 'Subscribe');
                this.setupNotificationButtonHandler(notificationBtn, sessionId, currentPlayerId, 'subscribe');
            }

        } catch (error) {
            console.error('Error setting up notification handlers:', error);
            this.updateNotificationButton(notificationBtn, 'error', 'Error');
        }
    }

    /**
     * Update the notification button appearance
     */
    updateNotificationButton(button, state, text) {
        button.setAttribute('data-state', state);
        button.querySelector('.btn-text').textContent = text;
        button.disabled = ['loading', 'unavailable', 'denied', 'error'].includes(state);
    }

    /**
     * Set up click handler for notification button based on current state
     */
    setupNotificationButtonHandler(button, sessionId, playerId, action) {
        // Remove any existing listeners by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', async () => {
            try {
                this.updateNotificationButton(newButton, 'loading', 'Updating...');

                switch (action) {
                    case 'request-permission':
                        await this.notificationManager.requestPermission();
                        // After permission granted, refresh the button state
                        this.setupNotificationHandlers(sessionId);
                        break;

                    case 'subscribe':
                        await this.notificationManager.subscribeToSession(playerId, sessionId);
                        this.updateNotificationButton(newButton, 'subscribed', '✓ Subscribed');
                        this.setupNotificationButtonHandler(newButton, sessionId, playerId, 'unsubscribe');
                        break;

                    case 'unsubscribe':
                        await this.notificationManager.unsubscribeFromSession(playerId, sessionId);
                        this.updateNotificationButton(newButton, 'not-subscribed', 'Subscribe');
                        this.setupNotificationButtonHandler(newButton, sessionId, playerId, 'subscribe');
                        break;
                }
            } catch (error) {
                console.error(`Error ${action}:`, error);
                this.updateNotificationButton(newButton, 'error', 'Error');
                
                // Show user-friendly error message
                let errorMsg = 'An error occurred. Please try again.';
                if (error.message.includes('denied')) {
                    errorMsg = 'Permission denied. Please enable notifications in your browser settings.';
                } else if (error.message.includes('not supported')) {
                    errorMsg = 'Notifications are not supported in this browser.';
                }
                
                alert(errorMsg);
                
                // Reset button after error
                setTimeout(() => {
                    this.setupNotificationHandlers(sessionId);
                }, 2000);
            }
        });
    }

    /**
     * Get current player ID - this needs to be implemented based on your authentication system
     * For now, returning a placeholder - you'll need to replace this with actual player identification
     */
    getCurrentPlayerId() {
        // TODO: Implement actual player identification
        // This could be from localStorage, session storage, or API call
        // For now, returning a default player ID for testing
        return localStorage.getItem('current_player_id') || 'pid_001';
    }

    /**
     * Show discrepancy modal when trying to end a session with money mismatch
     */
    showDiscrepancyModal(unpaidValue, sessionId, endSessionBtn) {
        const discrepancyType = unpaidValue > 0 ? 'Unpaid' : 'House Loss';
        const discrepancyAmount = formatCurrency(Math.abs(unpaidValue));
        const warn = unpaidValue <= 0;

        // Shared dialog chrome (components/_modals.css); the danger/warning
        // tint on the figure is the one content-specific treatment.
        const modalElement = document.createElement('div');
        modalElement.innerHTML = `
            <div class="modal-overlay discrepancy-modal-overlay">
                <div class="modal-content">
                    <h2 class="discrepancy-title" style="
                        font-size: 1.5rem;
                        font-weight: 600;
                        margin: 0 0 1.5rem;
                        text-align: center;
                        color: ${warn ? 'var(--color-warning)' : 'var(--color-danger)'};
                    ">
                        ⚠️ Money Discrepancy
                    </h2>

                    <div class="discrepancy-alert${warn ? ' discrepancy-alert--warn' : ''}">
                        <p>The session money does not balance:</p>
                        <p class="discrepancy-alert__value">${discrepancyType}: ${discrepancyAmount}</p>
                    </div>

                    <p style="
                        font-size: 1rem;
                        font-weight: 600;
                        color: var(--text-secondary);
                        margin-bottom: 1.5rem;
                        line-height: 1.5;
                    ">
                        ${unpaidValue > 0
                            ? 'There is unpaid money. Players may not have cashed out all their chips.'
                            : 'The house paid out more than was bought in. This indicates a counting error.'}
                    </p>

                    <p style="
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: var(--text-secondary);
                        margin-bottom: 1.5rem;
                    ">
                        Do you want to end the session anyway, or go back to recount?
                    </p>

                    <div class="modal-actions" style="flex-wrap: wrap;">
                        <button id="cancel-end-session" class="neo-btn neo-btn-primary" style="flex: 1; min-width: 120px;">
                            No, Recount
                        </button>
                        <button id="confirm-end-session" class="neo-btn neo-btn-red" style="flex: 1; min-width: 120px;">
                            Yes, End Anyway
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalElement);
        requestAnimationFrame(() => requestAnimationFrame(() =>
            modalElement.querySelector('.modal-overlay').classList.add('active')
        ));

        const cancelBtn = document.getElementById('cancel-end-session');
        const confirmBtn = document.getElementById('confirm-end-session');

        // Cancel handler - just close modal
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modalElement);
        });

        // Confirm handler - proceed with ending session
        confirmBtn.addEventListener('click', async () => {
            // Disable buttons
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Ending...';

            try {
                await this.endSession(sessionId, endSessionBtn);
                document.body.removeChild(modalElement);
            } catch (error) {
                // Error already handled in endSession
                document.body.removeChild(modalElement);
            }
        });
        // Close on overlay click
        const overlay = modalElement.querySelector('.discrepancy-modal-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(modalElement);
            }
        });

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modalElement);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * End the session - extracted to a separate method for reusability
     */
    async endSession(sessionId, endSessionBtn) {
        try {
            // Show loading state
            endSessionBtn.disabled = true;
            endSessionBtn.textContent = 'Ending...';

            await this.api.put(`sessions/${sessionId}/end`);
            EventBus.emit('data:sessions-changed');

            // Reload the page to show updated session state
            this.load(sessionId);
        } catch (error) {
            console.error('Error ending session:', error);
            alert(`Error: ${error.message}`);

            // Restore button state
            endSessionBtn.disabled = false;
            endSessionBtn.textContent = 'End Session';

            throw error; // Re-throw so modal can handle it
        }
    }
}
