// Session detail page module
import ApiService from './api-service.js';
import { NotificationManager } from './notification-manager.js';
import { staggerChildren } from './animations.js';
import Router from './router.js';

export default class SessionDetailPage {
    static skeleton() {
        return `
            <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div class="skeleton skeleton-btn" style="width: 160px; height: 40px;"></div>
                    <div class="skeleton skeleton-btn" style="width: 100px; height: 40px;"></div>
                </div>
                <div class="neo-card">
                    <div class="skeleton skeleton-text" style="width: 60%; height: 1.75rem; margin-bottom: 1.5rem;"></div>
                    <div class="neo-stats-grid" style="margin-bottom: 1.5rem;">
                        <div class="neo-stat-card"><div class="skeleton skeleton-text" style="width: 80%; height: 1.5rem; margin: 0 auto;"></div></div>
                        <div class="neo-stat-card"><div class="skeleton skeleton-text" style="width: 80%; height: 1.5rem; margin: 0 auto;"></div></div>
                        <div class="neo-stat-card"><div class="skeleton skeleton-text" style="width: 80%; height: 1.5rem; margin: 0 auto;"></div></div>
                        <div class="neo-stat-card"><div class="skeleton skeleton-text" style="width: 80%; height: 1.5rem; margin: 0 auto;"></div></div>
                    </div>
                </div>
                <div class="skeleton skeleton-text" style="width: 30%; height: 1.5rem; margin: 2rem 0 1.5rem 0;"></div>
                ${Array(5).fill(`
                    <div class="neo-card" style="margin-bottom: 1rem;">
                        <div class="skeleton skeleton-text" style="width: 40%; height: 1.25rem; margin-bottom: 1rem;"></div>
                        <div style="display: flex; gap: 2rem;">
                            <div class="skeleton skeleton-text" style="width: 80px; height: 1rem;"></div>
                            <div class="skeleton skeleton-text" style="width: 80px; height: 1rem;"></div>
                            <div class="skeleton skeleton-text" style="width: 80px; height: 1rem;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.notificationManager = new NotificationManager(apiService);
        this.addPlayerSearchQuery = '';
        this.selectedPlayerIds = new Set();
        this.isAddPlayersModalOpen = false;
        this.boundHandleAddPlayersModalEscape = null;
    }
    
    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown Date';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
            this.addPlayerSearchQuery = '';
            this.selectedPlayerIds.clear();
            this.isAddPlayersModalOpen = false;
            
            // Ensure the buy-in value is available for the form
            if (session.session_info && session.session_info.default_buy_in_value) {
                session.buyin = session.session_info.default_buy_in_value;
            } else if (session.default_buy_in_value) {
                session.buyin = session.default_buy_in_value;
            } else {
                session.buyin = 20.00; // Default value
            }
            
            const dateForTitle = (session.session_info || session).date;
            document.title = `Session - ${this.formatDate(dateForTitle)} - Gamble King`;

            // Render session details
            this.render(session, sessionId);
        } catch (error) {
            console.error(`Error loading session details for ${sessionId}:`, error);
            this.appContent.innerHTML = `<p>Could not load details for session ${sessionId}. ${error.message}</p>`;
        }
    }
    
    // Helper method to render chip distribution
    renderChipDistribution(session) {
        
        // Check if session and chip_distribution exist
        if (!session || !session.session_info || !session.session_info.chip_distribution) {
            return `<div class="neo-card" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: var(--text-primary);">🎰 Chip Distribution</h3>
                <p style="font-weight: 600; color: var(--text-secondary);">No chip distribution data available.</p>
            </div>`;
        }
        
        // Get chip distribution from session data
        const chipDistribution = session.session_info.chip_distribution;
        const buyInValue = session.session_info.default_buy_in_value || 20.00;
        const totalChips = session.session_info.total_chips || Object.values(chipDistribution).reduce((sum, count) => sum + count, 0);
        
        console.log("Chip distribution data:", chipDistribution);
        console.log("Buy-in value:", buyInValue);
        console.log("Total chips:", totalChips);
        
        // Define colors for styling with neobrutalist approach
        const chipColors = {
            'Black': '#1F2937',
            'Blue': '#1E3A8A',
            'Green': '#065F46',
            'Red': '#991B1B',
            'White': '#F9FAFB'
        };
        
        // Sort chips by value (highest first)
        const chipOrder = ['Black', 'Blue', 'Green', 'Red', 'White'];
        
        let html = `
            <div class="neo-card neo-card-purple" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: var(--casino-purple-dark);">🎰 Chip Distribution</h3>
                <p style="font-weight: 600; color: var(--casino-purple-dark); margin-bottom: 1.5rem;">
                    For a buy-in of <span style="color: var(--casino-green); font-weight: 600;">$${buyInValue.toFixed(2)}</span>, 
                    use the following chip distribution (<span style="color: var(--casino-gold); font-weight: 600;">${totalChips} total chips</span>):
                </p>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">`;
        
        // Create a chip element for each type
        for (const chipColor of chipOrder) {
            if (chipDistribution[chipColor] && chipDistribution[chipColor] > 0) {
                const backgroundColor = chipColors[chipColor];
                const textColor = ['White'].includes(chipColor) ? '#000000' : '#FFFFFF';
                
                html += `
                    <div style="
                        width: 80px; 
                        height: 80px; 
                        border-radius: 50%; 
                        background-color: ${backgroundColor}; 
                        color: ${textColor}; 
                        border: var(--neo-border-thick);
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center;
                        font-weight: 600;
                        text-align: center;
                        box-shadow: var(--neo-shadow-md);
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="font-size: 1rem; line-height: 1;">${chipDistribution[chipColor]}</div>
                        <div style="font-size: 0.65rem; margin-top: 2px;">${chipColor}</div>
                        
                        <!-- Chip texture lines -->
                        <div style="
                            position: absolute;
                            top: 10px; left: 10px; right: 10px; bottom: 10px;
                            border: 2px dashed ${textColor === '#FFFFFF' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'};
                            border-radius: 50%;
                        "></div>
                    </div>`;
            }
        }
        
        html += `
                </div>
            </div>`;
        
        return html;
    }

    // Render a single player card
    renderPlayerCard(player, sessionData, isActive) {
        const buyIn = player.buyIn || 0;
        const cashOut = player.cashOut || 0;
        const profit = cashOut - buyIn;
        const isCashedOut = !!player.isCashedOut;
        const profitColor = isCashedOut ? (profit >= 0 ? 'neo-card-green' : 'neo-card-primary') : '';

        return `
            <div class="neo-card ${profitColor} clickable-player-details" data-player-id="${player.id}" style="cursor: pointer; padding: 1rem;${isActive && !isCashedOut ? ' border-left: 3px solid var(--casino-gold); opacity: 0.85;' : ''}">
                <!-- Name + Profit header row -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <h4 style="font-size: 1.125rem; font-weight: 600; margin: 0;">
                            <a href="#player/${player.id}" style="color: inherit; text-decoration: none;">${player.name}</a>
                            ${player.id === sessionData.wisdom_player_id ? ' 🗣️' : ''}
                        </h4>
                        ${isActive ? `
                            <span style="display: inline-block; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.03em; ${isCashedOut ? 'background: rgba(16, 185, 129, 0.15); color: var(--casino-green-dark);' : 'background: rgba(245, 158, 11, 0.15); color: var(--casino-gold-dark);'}">
                                ${isCashedOut ? '✓ Cashed Out' : 'In Play'}
                            </span>
                        ` : ''}
                    </div>
                    <span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size: 1.125rem; font-weight: 700;">$${profit.toFixed(2)}</span>
                </div>

                <!-- Stats grid: Buy-in, Cash-out, 7-2 Wins, Strikes -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.125rem;">Buy-in</div>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--casino-red);">$${buyIn.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.125rem;">Cash-out</div>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--casino-gold);">$${cashOut.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.125rem;">7-2 Wins</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                            ${isActive ? `
                                <button class="neo-btn neo-btn-sm seven-two-decrement-btn" data-player-id="${player.id}" style="
                                    width: 22px; height: 22px; padding: 0; font-size: 13px; font-weight: 700;
                                    display: inline-flex; align-items: center; justify-content: center;
                                    border: 1px solid var(--casino-gold); border-radius: 50%;
                                    background: transparent; color: var(--casino-gold);
                                    cursor: pointer; line-height: 1;
                                ">−</button>
                            ` : ''}
                            <span style="font-size: 0.95rem; font-weight: 600; color: var(--casino-gold); min-width: 1.25rem;">${player.sevenTwoWins || 0}</span>
                            ${isActive ? `
                                <button class="neo-btn neo-btn-sm seven-two-increment-btn" data-player-id="${player.id}" style="
                                    width: 22px; height: 22px; padding: 0; font-size: 13px; font-weight: 700;
                                    display: inline-flex; align-items: center; justify-content: center;
                                    border: 1px solid var(--casino-gold); border-radius: 50%;
                                    background: var(--casino-gold); color: var(--text-white);
                                    cursor: pointer; line-height: 1;
                                ">+</button>
                            ` : ''}
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.125rem;">Strikes</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                            ${isActive ? `
                                <button class="neo-btn neo-btn-sm strikes-decrement-btn" data-player-id="${player.id}" style="
                                    width: 22px; height: 22px; padding: 0; font-size: 13px; font-weight: 700;
                                    display: inline-flex; align-items: center; justify-content: center;
                                    border: 1px solid var(--casino-red); border-radius: 50%;
                                    background: transparent; color: var(--casino-red);
                                    cursor: pointer; line-height: 1;
                                ">−</button>
                            ` : ''}
                            <span style="font-size: 0.95rem; font-weight: 600; color: var(--casino-red); min-width: 1.25rem;">${player.strikes || 0}</span>
                            ${isActive ? `
                                <button class="neo-btn neo-btn-sm strikes-increment-btn" data-player-id="${player.id}" style="
                                    width: 22px; height: 22px; padding: 0; font-size: 13px; font-weight: 700;
                                    display: inline-flex; align-items: center; justify-content: center;
                                    border: 1px solid var(--casino-red); border-radius: 50%;
                                    background: var(--casino-red); color: var(--text-white);
                                    cursor: pointer; line-height: 1;
                                ">+</button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Action Button -->
                ${isActive ? `
                    <div style="margin-top: 0.75rem;">
                        ${player.isCashedOut ?
                            `<button class="neo-btn neo-btn-green buy-in-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}" style="width: 100%; padding: 0.75rem 1rem;">💰 Buy In</button>` :
                            `<div style="display: flex; gap: 0.5rem;">
                                <button class="neo-btn neo-btn-green rebuy-player-btn" data-player-id="${player.id}" style="flex: 1; padding: 0.75rem 1rem;">🔄 Re-buy</button>
                                <button class="neo-btn neo-btn-gold cash-out-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}" style="flex: 1; padding: 0.75rem 1rem;">💸 Cash Out</button>
                            </div>`
                        }
                    </div>
                ` : ''}
            </div>
        `;
    }

    getFilteredPlayerPickerPlayers() {
        const players = [...(this.currentSession?.allPlayers || [])].sort((a, b) => a.name.localeCompare(b.name));
        const query = this.addPlayerSearchQuery.trim().toLowerCase();
        const existingPlayerIds = new Set((this.currentSession?.players || []).map(player => player.id));

        const mappedPlayers = players.map(player => ({
            ...player,
            isInSession: existingPlayerIds.has(player.player_id)
        }));

        if (!query) {
            return mappedPlayers;
        }

        return mappedPlayers.filter(player => player.name.toLowerCase().includes(query));
    }

    renderAddPlayersCard(sessionData) {
        const totalPlayers = this.currentSession?.allPlayers?.length || 0;

        return `
            <div class="session-player-picker-card">
                <button id="open-player-picker-btn" class="neo-btn neo-btn-green" type="button" style="padding: 0.8rem 1.1rem;">Select Players</button>
                ${this.isAddPlayersModalOpen ? this.renderAddPlayersModal(sessionData, totalPlayers) : ''}
            </div>
        `;
    }

    renderAddPlayersModal(sessionData, totalPlayers) {
        const filteredPlayers = this.getFilteredPlayerPickerPlayers();
        const selectedCount = this.selectedPlayerIds.size;
        const defaultBuyin = sessionData?.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00';

        return `
            <div id="add-players-modal-overlay" class="session-player-picker-overlay">
                <div class="session-player-picker-modal">
                    <div class="session-player-picker-modal-header">
                        <div>
                            <h4 style="font-size: 1.2rem; font-weight: 700; margin: 0; color: var(--text-primary);">Select Players</h4>
                            <p style="margin: 0.35rem 0 0; color: var(--text-secondary); font-weight: 600;">${totalPlayers} total players</p>
                        </div>
                        <button id="close-player-picker-btn" class="neo-btn" type="button" style="padding: 0.65rem 0.9rem;">Close</button>
                    </div>
                    <div class="session-player-picker-toolbar">
                        <input type="text" id="add-player-search" class="neo-input" placeholder="Search players..." value="${this.escapeHtml(this.addPlayerSearchQuery)}" style="margin: 0;">
                    </div>
                    <div class="session-player-picker-list">
                        ${filteredPlayers.length > 0 ? filteredPlayers.map(player => `
                            <label class="session-player-picker-option ${player.isInSession ? 'already-in' : ''} ${this.selectedPlayerIds.has(player.player_id) ? 'selected' : ''}">
                                <input
                                    type="checkbox"
                                    class="session-player-checkbox"
                                    value="${player.player_id}"
                                    ${player.isInSession || this.selectedPlayerIds.has(player.player_id) ? 'checked' : ''}
                                    ${player.isInSession ? 'disabled' : ''}
                                >
                                <span class="session-player-picker-name">${this.escapeHtml(player.name)}</span>
                                ${player.isInSession ? '<span class="session-player-picker-badge">In Session</span>' : ''}
                            </label>
                        `).join('') : `
                            <div class="session-player-picker-empty">No players match your search.</div>
                        `}
                    </div>
                    <div class="session-player-picker-footer">
                        <div class="session-player-picker-footer-summary">
                            <strong>${selectedCount}</strong> player${selectedCount === 1 ? '' : 's'} selected · Default buy-in $${defaultBuyin}
                        </div>
                        <button id="add-player-to-session-btn" class="neo-btn neo-btn-green" type="button" ${selectedCount === 0 ? 'disabled' : ''}>
                            ${selectedCount === 0 ? 'Select Players to Add' : `Add ${selectedCount} Player${selectedCount === 1 ? '' : 's'}`}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    refreshAddPlayersCard(sessionData, sessionId, options = {}) {
        const container = document.getElementById('add-players-card-container');
        if (!container) return;

        container.innerHTML = this.renderAddPlayersCard(sessionData);
        this.setupAddPlayerPicker(sessionData, sessionId);

        if (typeof options.listScrollTop === 'number') {
            const pickerList = document.querySelector('.session-player-picker-list');
            if (pickerList) {
                pickerList.scrollTop = options.listScrollTop;
            }
        }
    }

    // Render the inner HTML for the players list container
    renderPlayersListHTML(session, isActive) {
        const sessionData = session.session_info || session;
        let html = '';

        if (session.players && session.players.length > 0) {
            // Sort players: complete sessions by profit desc, active by alpha with cashed-out at bottom
            const sortedPlayers = [...session.players];
            if (isActive) {
                sortedPlayers.sort((a, b) => {
                    if (a.isCashedOut !== b.isCashedOut) return a.isCashedOut ? 1 : -1;
                    return a.name.localeCompare(b.name);
                });
            } else {
                sortedPlayers.sort((a, b) => ((b.cashOut || 0) - (b.buyIn || 0)) - ((a.cashOut || 0) - (a.buyIn || 0)));
            }

            html += `<div style="display: grid;">`;
            sortedPlayers.forEach(player => {
                html += this.renderPlayerCard(player, sessionData, isActive);
            });
            html += `</div>`;
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">👤</div>
                    <p style="font-size: 1.25rem; font-weight: 700; color: var(--text-secondary); margin: 0;">No players in this session yet.</p>
                </div>
            `;
        }

        return html;
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
        if (totalValueEl) totalValueEl.textContent = `$${session.totalValue.toFixed(2)}`;

        const unpaidLabelEl = document.getElementById('session-unpaid-label');
        const unpaidValueEl = document.getElementById('session-unpaid-value');
        if (unpaidLabelEl) {
            unpaidLabelEl.textContent = session.unpaidValue > 0.01 ? 'Unpaid' : session.unpaidValue < -0.01 ? 'House Loss' : 'Payout';
        }
        if (unpaidValueEl) {
            unpaidValueEl.className = session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'profit-negative' : 'profit-positive';
            if (session.unpaidValue > 0.01) {
                unpaidValueEl.textContent = `$${session.unpaidValue.toFixed(2)}`;
            } else if (session.unpaidValue < -0.01) {
                unpaidValueEl.textContent = `-$${Math.abs(session.unpaidValue).toFixed(2)}`;
            } else {
                unpaidValueEl.textContent = !isActive ? 'PAID OUT' : '$0.00';
            }
        }

        // Re-render players list
        const container = document.getElementById('players-list-container');
        if (container) {
            container.innerHTML = this.renderPlayersListHTML(session, isActive);
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
            this.refreshAddPlayersCard(sessionData, sessionId);
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <button id="session-detail-back-btn" type="button" class="neo-btn neo-btn-purple">← Back</button>
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
                    <h2 style="font-size: 2rem; font-weight: 600; margin-bottom: 1.5rem; color: var(--text-primary);">
                        🎯 ${this.formatDate(sessionData.date)}
                    </h2>
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.25rem;">
                        <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; ${isActive ? 'background: rgba(245, 158, 11, 0.15); color: var(--casino-gold-dark);' : 'background: rgba(22, 163, 74, 0.15); color: var(--casino-green-dark);'}">
                            ${isActive ? '● ACTIVE' : '● ENDED'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 0.5rem;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.25rem;">Buy-in</div>
                            <div style="font-size: 1.125rem; font-weight: 700;">$${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '0.00'}</div>
                        </div>
                        <div style="width: 1px; background: var(--border-light, #E2E8F0);"></div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.25rem;">Total Value</div>
                            <div id="session-total-value" style="font-size: 1.125rem; font-weight: 700;">$${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</div>
                        </div>
                        <div style="width: 1px; background: var(--border-light, #E2E8F0);"></div>
                        <div>
                            <div id="session-unpaid-label" style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.25rem;">${session.unpaidValue > 0.01 ? 'Unpaid' : session.unpaidValue < -0.01 ? 'House Loss' : 'Payout'}</div>
                            <div id="session-unpaid-value" class="${session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'profit-negative' : 'profit-positive'}" style="font-size: 1.125rem; font-weight: 700;">
                                ${session.unpaidValue > 0.01 ?
                                    `$${session.unpaidValue.toFixed(2)}` :
                                    session.unpaidValue < -0.01 ?
                                    `-$${Math.abs(session.unpaidValue).toFixed(2)}` :
                                    (!isActive ? 'PAID OUT' : '$0.00')}
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
                            <h4 style="font-size: 1.1rem; font-weight: 600; margin: 0; color: var(--text-primary);">${sessionData.wisdom_quote ? 'Edit Quote' : 'Add Quote'}</h4>
                            <textarea id="wisdom-quote-input" placeholder="Enter the quote..." style="padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card); min-height: 80px; resize: vertical;">${sessionData.wisdom_quote || ''}</textarea>
                            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                                <select id="wisdom-player-select" style="flex: 1; min-width: 200px; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
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
                    <h3 style="font-size: 1.75rem; font-weight: 600; margin: 0; color: var(--text-primary);">🎭 Players</h3>
                    ${isActive ? `
                        <div id="add-players-card-container">
                            ${this.renderAddPlayersCard(sessionData)}
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
        html += this.renderPlayersListHTML(session, isActive);
        html += `</div>`;
        
        // Add chip distribution section after players (only for active sessions)
        if (isActive) {
            html += `
                <!-- Chip Distribution Section -->
                <div id="chip-distribution-container">
                ${this.renderChipDistribution(session)}
                </div>
            `;
        }
        
        // Add session control buttons at the bottom
        const allCashedOut = !session.players || session.players.length === 0 || session.players.every(p => !!p.isCashedOut);
        html += `
                <!-- Session Controls -->
                <div style="margin-top: 2rem; text-align: center;">
                    ${isActive ?
                        `${!allCashedOut ? `<p id="end-session-note" style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Cash out all players before ending the session</p>` : ''}
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
        styleElement.textContent = `
            .session-bottom-controls {
                margin: 20px 0;
                padding: 15px;
                border-top: 1px solid #ddd;
                text-align: center;
            }
            
            /* Session control buttons now use neobrutalist styling */
            
            /* Ensure proper spacing for session reactivate button */
            .session-reactivate-container {
                text-align: center;
                margin: 20px 0;
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
                padding: 0.85rem 0.95rem;
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
            }

            .session-player-picker-empty {
                grid-column: 1 / -1;
                padding: 1rem;
                border-radius: 14px;
                border: 1px dashed var(--border-light, #E2E8F0);
                color: var(--text-secondary);
                font-weight: 600;
                text-align: center;
            }

            .session-player-picker-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.48);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.5rem;
                z-index: 10001;
            }

            .session-player-picker-modal {
                width: min(860px, 100%);
                max-height: min(80vh, 760px);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                padding: 1.25rem;
                border-radius: 20px;
                background: var(--bg-content);
                border: 1px solid var(--border-light, #E2E8F0);
                box-shadow: var(--neo-shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.08));
            }

            .session-player-picker-modal-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .session-player-picker-toolbar {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 0.75rem;
                margin-bottom: 1rem;
            }

            .session-player-picker-badge {
                padding: 0.2rem 0.55rem;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 700;
                color: var(--text-secondary);
                background: rgba(148, 163, 184, 0.14);
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
        document.head.appendChild(styleElement);
        
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
            this.setupAddPlayerPicker(session, sessionId);
            
            // Set up notification functionality for active sessions
            this.setupNotificationHandlers(sessionId);
        }

        // Set up player card event listeners (cash-out, buy-in, strikes, 7-2, card click)
        this.setupPlayerEventListeners(session, sessionId);

    }

    setupAddPlayerPicker(sessionData, sessionId) {
        const searchInput = document.getElementById('add-player-search');
        const openPickerBtn = document.getElementById('open-player-picker-btn');
        const closePickerBtn = document.getElementById('close-player-picker-btn');
        const modalOverlay = document.getElementById('add-players-modal-overlay');
        const addPlayersBtn = document.getElementById('add-player-to-session-btn');

        if (openPickerBtn) {
            openPickerBtn.addEventListener('click', () => {
                this.isAddPlayersModalOpen = true;
                this.refreshAddPlayersCard(sessionData, sessionId);
            });
        }

        if (closePickerBtn) {
            closePickerBtn.addEventListener('click', () => {
                this.isAddPlayersModalOpen = false;
                this.refreshAddPlayersCard(sessionData, sessionId);
            });
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', (event) => {
                if (event.target === modalOverlay) {
                    this.isAddPlayersModalOpen = false;
                    this.refreshAddPlayersCard(sessionData, sessionId);
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.addPlayerSearchQuery = event.target.value;
                this.refreshAddPlayersCard(sessionData, sessionId);
            });
        }

        document.querySelectorAll('.session-player-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const pickerList = event.target.closest('.session-player-picker-list');
                const listScrollTop = pickerList ? pickerList.scrollTop : 0;
                const playerId = event.target.value;
                if (event.target.checked) {
                    this.selectedPlayerIds.add(playerId);
                } else {
                    this.selectedPlayerIds.delete(playerId);
                }

                this.refreshAddPlayersCard(sessionData, sessionId, { listScrollTop });
            });
        });

        if (addPlayersBtn) {
            addPlayersBtn.addEventListener('click', async () => {
                const existingPlayerIds = new Set((this.currentSession?.players || []).map(player => player.id));
                const selectedPlayerIds = Array.from(this.selectedPlayerIds).filter(playerId => !existingPlayerIds.has(playerId));

                if (selectedPlayerIds.length === 0) {
                    alert('Please select at least one player');
                    return;
                }
                const numBuyIns = 1;

                if (numBuyIns <= 0) {
                    alert('Buy-in amount must result in at least one buy-in');
                    return;
                }

                try {
                    addPlayersBtn.disabled = true;
                    addPlayersBtn.textContent = `Adding ${selectedPlayerIds.length}...`;

                    const newEntries = await this.api.addPlayersToSessionBulk(sessionId, {
                        player_ids: selectedPlayerIds,
                        num_buy_ins: numBuyIns
                    });

                    this.selectedPlayerIds.clear();
                    this.addPlayerSearchQuery = '';
                    this.isAddPlayersModalOpen = false;
                    this.refreshAddPlayersCard(sessionData, sessionId);
                    this.refreshEntries(newEntries, sessionId);
                } catch (error) {
                    console.error('Error adding players to session:', error);
                    alert(`Error: ${error.message}`);
                    addPlayersBtn.disabled = false;
                    addPlayersBtn.textContent = `Add ${selectedPlayerIds.length} Player${selectedPlayerIds.length === 1 ? '' : 's'}`;
                }
            });
        }

        if (this.boundHandleAddPlayersModalEscape) {
            document.removeEventListener('keydown', this.boundHandleAddPlayersModalEscape);
            this.boundHandleAddPlayersModalEscape = null;
        }

        if (this.isAddPlayersModalOpen) {
            this.boundHandleAddPlayersModalEscape = (event) => {
                if (event.key === 'Escape') {
                    this.isAddPlayersModalOpen = false;
                    this.refreshAddPlayersCard(sessionData, sessionId);
                }
            };
            document.addEventListener('keydown', this.boundHandleAddPlayersModalEscape);
        }
    }

    // Show an inline edit popup for a player in an active session
    showPlayerEditModal(player, sessionData, sessionId) {
        const defaultBuyin = sessionData.default_buy_in_value || 20;
        const modalElement = document.createElement('div');
        modalElement.id = 'player-edit-modal-wrapper';

        const renderModal = () => {
            const p = this.currentSession.players.find(pp => pp.id === player.id) || player;
            const buyInCount = p.buyInCount || 1;
            const totalBuyIn = p.buyIn || 0;
            const cashOut = p.cashOut || 0;

            modalElement.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 1rem; overflow-y: auto;">
                    <div style="background: var(--bg-card, white); padding: 1.5rem; border-radius: 12px; max-width: 400px; width: 100%; margin-top: 2rem; margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700;">${this.escapeHtml(p.name)}</h3>
                            <button id="edit-modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 0.25rem; color: var(--text-secondary);">×</button>
                        </div>

                        <!-- Buy-ins -->
                        <div style="margin-bottom: 1.25rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.5rem;">Buy-ins</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button id="edit-buyin-minus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%;${buyInCount <= 1 ? ' opacity: 0.4;' : ''}" ${buyInCount <= 1 ? 'disabled' : ''}>−</button>
                                <span style="font-size: 1.25rem; font-weight: 700; min-width: 2rem; text-align: center;">${buyInCount}</span>
                                <button id="edit-buyin-plus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%;">+</button>
                                <span style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 0.25rem;">($${totalBuyIn.toFixed(2)} total)</span>
                            </div>
                        </div>

                        <!-- Cash-out amount -->
                        <div style="margin-bottom: 1.25rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.5rem;">Cash-out Amount</div>
                            <input type="text" id="edit-cashout-input" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" value="${cashOut > 0 ? cashOut.toFixed(2) : ''}" placeholder="0.00" style="width: 100%; padding: 0.6rem 0.75rem; font-size: 1rem; border: 2px solid var(--border-light, #ddd); border-radius: 6px; box-sizing: border-box;">
                        </div>

                        <!-- 7-2 Wins -->
                        <div style="margin-bottom: 1.25rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.5rem;">7-2 Wins</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button id="edit-72-minus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--casino-gold); color: var(--casino-gold);${(p.sevenTwoWins || 0) <= 0 ? ' opacity: 0.4;' : ''}" ${(p.sevenTwoWins || 0) <= 0 ? 'disabled' : ''}>−</button>
                                <span style="font-size: 1.25rem; font-weight: 700; min-width: 2rem; text-align: center; color: var(--casino-gold);">${p.sevenTwoWins || 0}</span>
                                <button id="edit-72-plus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--casino-gold); color: var(--text-white);">+</button>
                            </div>
                        </div>

                        <!-- Strikes -->
                        <div style="margin-bottom: 1.25rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; opacity: 0.7; margin-bottom: 0.5rem;">Strikes</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <button id="edit-strikes-minus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--casino-red); color: var(--casino-red);${(p.strikes || 0) <= 0 ? ' opacity: 0.4;' : ''}" ${(p.strikes || 0) <= 0 ? 'disabled' : ''}>−</button>
                                <span style="font-size: 1.25rem; font-weight: 700; min-width: 2rem; text-align: center; color: var(--casino-red);">${p.strikes || 0}</span>
                                <button id="edit-strikes-plus" class="neo-btn" style="width: 36px; height: 36px; padding: 0; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--casino-red); color: var(--text-white);">+</button>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="border-top: 1px solid var(--border-light, #eee); padding-top: 1rem; text-align: center;">
                            <a href="#player/${p.id}" id="edit-modal-profile-link" style="font-size: 0.9rem; font-weight: 600; color: var(--casino-gold);">View Player Profile →</a>
                        </div>
                    </div>
                </div>
            `;
        };

        renderModal();
        document.body.appendChild(modalElement);

        const closeModal = () => {
            if (modalElement.parentNode) document.body.removeChild(modalElement);
        };

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
            modalElement.querySelector(':scope > div')?.addEventListener('click', (e) => {
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

        // Focus the cash-out input if it's empty (likely what they want to edit)
        const cashoutInput = modalElement.querySelector('#edit-cashout-input');
        if (cashoutInput && !cashoutInput.value) {
            setTimeout(() => cashoutInput.focus(), 100);
        }
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

                const modalHtml = `
                    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 1rem;">
                        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%; margin-top: 3rem;">
                            <h3>Cash Out Player</h3>
                            <label for="cashout-amount">Enter cash-out amount ($):</label>
                            <input type="text" id="cashout-amount" inputmode="decimal" pattern="[0-9]*\.?[0-9]*" style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
                            <div style="text-align: right; margin-top: 15px;">
                                <button id="cancel-cashout" style="margin-right: 10px; padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                                <button id="confirm-cashout" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Cash Out</button>
                            </div>
                        </div>
                    </div>
                `;

                const modalElement = document.createElement('div');
                modalElement.innerHTML = modalHtml;
                document.body.appendChild(modalElement);

                const cashoutInput = document.getElementById('cashout-amount');
                const cancelBtn = document.getElementById('cancel-cashout');
                const confirmBtn = document.getElementById('confirm-cashout');

                setTimeout(() => cashoutInput.focus(), 100);

                cashoutInput.addEventListener('input', (event) => {
                    let value = event.target.value;
                    value = value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    event.target.value = value;
                });

                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(modalElement);
                });

                confirmBtn.addEventListener('click', async () => {
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

                        document.body.removeChild(modalElement);
                        this.refreshEntries(newEntries, sessionId);

                    } catch (error) {
                        console.error('Error processing cash-out:', error);
                        alert(`Error: ${error.message}`);
                        document.body.removeChild(modalElement);
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

                const modalHtml = `
                    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 1rem;">
                        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%; margin-top: 3rem;">
                            <h3>Buy In Player</h3>
                            <label for="buyin-amount">Enter buy-in amount ($):</label>
                            <input type="number" id="buyin-amount" inputmode="decimal" step="0.01" min="0" value="${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00'}" style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
                            <div style="text-align: right; margin-top: 15px;">
                                <button id="cancel-buyin" style="margin-right: 10px; padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                                <button id="confirm-buyin" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Buy In</button>
                            </div>
                        </div>
                    </div>
                `;

                const modalElement = document.createElement('div');
                modalElement.innerHTML = modalHtml;
                document.body.appendChild(modalElement);

                const buyinInput = document.getElementById('buyin-amount');
                const cancelBtn = document.getElementById('cancel-buyin');
                const confirmBtn = document.getElementById('confirm-buyin');

                setTimeout(() => {
                    buyinInput.focus();
                    buyinInput.select();
                }, 100);

                buyinInput.addEventListener('input', (event) => {
                    let value = event.target.value;
                    value = value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('');
                    }
                    event.target.value = value;
                });

                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(modalElement);
                });

                confirmBtn.addEventListener('click', async () => {
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

                        const defaultBuyin = sessionData.default_buy_in_value || 20;
                        const numBuyIns = Math.round(buyinValue / defaultBuyin);

                        const newEntries = await this.api.post(`sessions/${sessionId}/entries/${playerId}/buy-in`, {
                            num_buy_ins: numBuyIns
                        });

                        document.body.removeChild(modalElement);
                        this.refreshEntries(newEntries, sessionId);

                    } catch (error) {
                        console.error('Error processing buy-in:', error);
                        alert(`Error: ${error.message}`);
                        document.body.removeChild(modalElement);
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
                if (!confirm(`Add a re-buy of $${defaultBuyin.toFixed(2)}?`)) return;
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
        const discrepancyAmount = Math.abs(unpaidValue).toFixed(2);
        const discrepancyColor = unpaidValue > 0 ? '#991B1B' : '#EA580C';

        const modalHtml = `
            <div class="discrepancy-modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
            ">
                <div style="
                    background: var(--bg-card);
                    padding: 2rem;
                    border: var(--neo-border-thick);
                    box-shadow: var(--neo-shadow-lg);
                    max-width: 500px;
                    width: 100%;
                ">
                    <h2 style="
                        font-size: 1.5rem;
                        font-weight: 600;
                        margin-bottom: 1.5rem;
                        color: ${discrepancyColor};
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    ">
                        ⚠️ Money Discrepancy
                    </h2>

                    <div style="
                        background: ${unpaidValue > 0 ? 'rgba(153, 27, 27, 0.1)' : 'rgba(234, 88, 12, 0.1)'};
                        border: 3px solid ${discrepancyColor};
                        padding: 1.5rem;
                        margin-bottom: 1.5rem;
                    ">
                        <p style="
                            font-size: 1.125rem;
                            font-weight: 700;
                            color: var(--text-primary);
                            margin-bottom: 0.75rem;
                        ">
                            The session money does not balance:
                        </p>
                        <p style="
                            font-size: 1.75rem;
                            font-weight: 600;
                            color: ${discrepancyColor};
                            margin: 0;
                        ">
                            ${discrepancyType}: $${discrepancyAmount}
                        </p>
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

                    <div style="display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
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

        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        document.body.appendChild(modalElement);

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
