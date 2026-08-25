// Add-players picker UI controller for the session detail page.
// Owns its state (search query, selected player ids, modal-open flag, the
// bound Escape handler) and renders + wires the #add-players-card-container
// subtree. The page constructs it in the constructor, resets it on load(),
// and passes a context object ({ currentSession, api, refreshEntries }) to
// its methods — no access to page internals.
import { formatCurrency } from './formatters.js';
import { escapeHtml, renderEmptyState } from './ui.js';
import EventBus from './event-bus.js';

export default class AddPlayersPickerController {
    constructor() {
        this.searchQuery = '';
        this.selectedPlayerIds = new Set();
        this.isModalOpen = false;
        this.boundHandleAddPlayersModalEscape = null;
    }

    reset() {
        this.searchQuery = '';
        this.selectedPlayerIds.clear();
        this.isModalOpen = false;
    }

    getFilteredPlayerPickerPlayers(context) {
        const players = [...(context.currentSession?.allPlayers || [])].sort((a, b) => a.name.localeCompare(b.name));
        const query = this.searchQuery.trim().toLowerCase();
        const existingPlayerIds = new Set((context.currentSession?.players || []).map(player => player.id));

        const mappedPlayers = players.map(player => ({
            ...player,
            isInSession: existingPlayerIds.has(player.player_id)
        }));

        if (!query) {
            return mappedPlayers;
        }

        return mappedPlayers.filter(player => player.name.toLowerCase().includes(query));
    }

    renderCard(context, sessionData) {
        const totalPlayers = context.currentSession?.allPlayers?.length || 0;

        return `
            <div class="session-player-picker-card">
                <button id="open-player-picker-btn" class="neo-btn neo-btn-green" type="button" style="padding: 0.75rem 1rem;">Add Players</button>
                ${this.isModalOpen ? this.renderModal(context, sessionData, totalPlayers) : ''}
            </div>
        `;
    }

    renderModal(context, sessionData, totalPlayers) {
        const filteredPlayers = this.getFilteredPlayerPickerPlayers(context);
        const selectedCount = this.selectedPlayerIds.size;
        const defaultBuyin = formatCurrency(sessionData?.default_buy_in_value || 20);

        return `
            <div id="add-players-modal-overlay" class="modal-overlay">
                <div class="modal-content">
                    <button id="close-player-picker-btn" class="modal-close-btn" type="button" aria-label="Close add players">&times;</button>
                    <h3>Add Players</h3>
                    <p class="modal-subtitle">${totalPlayers} total players</p>
                    <div class="session-player-picker-toolbar">
                        <input type="text" id="add-player-search" class="neo-input" placeholder="Search players..." value="${escapeHtml(this.searchQuery)}" style="margin-bottom: 0;">
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
                                <span class="session-player-picker-name">${escapeHtml(player.name)}</span>
                                ${player.isInSession ? '<span class="chip-neutral">In Session</span>' : ''}
                            </label>
                        `).join('') : `
                            ${renderEmptyState({ icon: '🔍', message: 'No players match your search.', card: false })}
                        `}
                    </div>
                    <div class="session-player-picker-footer">
                        <div class="session-player-picker-footer-summary">
                            <strong>${selectedCount}</strong> player${selectedCount === 1 ? '' : 's'} selected · Default buy-in ${defaultBuyin}
                        </div>
                        <button id="add-player-to-session-btn" class="neo-btn neo-btn-green" type="button" ${selectedCount === 0 ? 'disabled' : ''}>
                            ${selectedCount === 0 ? 'Select Players to Add' : `Add ${selectedCount} Player${selectedCount === 1 ? '' : 's'}`}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    refresh(context, sessionData, sessionId, options = {}) {
        const container = document.getElementById('add-players-card-container');
        if (!container) return;

        // Any prior overlay — body-level (promoted on open) or in-container —
        // is stale the moment the card rebuilds; remove every copy so re-opening
        // never leaves duplicates behind.
        document.querySelectorAll('#add-players-modal-overlay').forEach(el => el.remove());
        container.innerHTML = this.renderCard(context, sessionData);
        this.setup(context, sessionData, sessionId, options);

        if (typeof options.listScrollTop === 'number') {
            const pickerList = document.querySelector('.session-player-picker-list');
            if (pickerList) {
                pickerList.scrollTop = options.listScrollTop;
            }
        }
    }

    setup(context, sessionData, sessionId, options = {}) {
        const searchInput = document.getElementById('add-player-search');
        const openPickerBtn = document.getElementById('open-player-picker-btn');
        const closePickerBtn = document.getElementById('close-player-picker-btn');
        const modalOverlay = document.getElementById('add-players-modal-overlay');
        const addPlayersBtn = document.getElementById('add-player-to-session-btn');

        if (openPickerBtn) {
            openPickerBtn.addEventListener('click', () => {
                this.isModalOpen = true;
                this.refresh(context, sessionData, sessionId, { animateOpen: true });
            });
        }

        if (closePickerBtn) {
            closePickerBtn.addEventListener('click', () => {
                this.isModalOpen = false;
                this.refresh(context, sessionData, sessionId);
            });
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', (event) => {
                if (event.target === modalOverlay) {
                    this.isModalOpen = false;
                    this.refresh(context, sessionData, sessionId);
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.searchQuery = event.target.value;
                this.refresh(context, sessionData, sessionId);
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

                this.refresh(context, sessionData, sessionId, { listScrollTop });
            });
        });

        if (addPlayersBtn) {
            addPlayersBtn.addEventListener('click', async () => {
                const existingPlayerIds = new Set((context.currentSession?.players || []).map(player => player.id));
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

                    const newEntries = await context.api.addPlayersToSessionBulk(sessionId, {
                        player_ids: selectedPlayerIds,
                        num_buy_ins: numBuyIns
                    });
                    EventBus.emit('data:entries-changed');

                    this.selectedPlayerIds.clear();
                    this.searchQuery = '';
                    this.isModalOpen = false;
                    this.refresh(context, sessionData, sessionId);
                    context.refreshEntries(newEntries, sessionId);
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

        if (this.isModalOpen) {
            this.boundHandleAddPlayersModalEscape = (event) => {
                if (event.key === 'Escape') {
                    this.isModalOpen = false;
                    this.refresh(context, sessionData, sessionId);
                }
            };
            document.addEventListener('keydown', this.boundHandleAddPlayersModalEscape);
        }

        // Mount the overlay at body level: the page container keeps a transform
        // from its enter animation (fill-mode: forwards), which would trap
        // position:fixed inside it. Then reveal it and move focus into the dialog.
        if (this.isModalOpen) {
            const openOverlay = document.getElementById('add-players-modal-overlay');
            if (openOverlay) {
                if (openOverlay.parentNode !== document.body) {
                    document.body.appendChild(openOverlay);
                }
                if (options.animateOpen) {
                    // Play the canonical fade + rise entrance: paint one hidden frame first.
                    openOverlay.classList.remove('active');
                    requestAnimationFrame(() => requestAnimationFrame(() => openOverlay.classList.add('active')));
                } else {
                    openOverlay.classList.add('active');
                }
            }
            const activeSearch = document.getElementById('add-player-search');
            if (activeSearch) {
                activeSearch.focus();
                activeSearch.setSelectionRange(activeSearch.value.length, activeSearch.value.length);
            }
        }
    }
}
