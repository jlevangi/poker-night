// Player edit modal UI controller for the session detail page.
// Owns the #player-edit-modal-wrapper subtree, its open state, and all of its
// behavior: buy-in count steppers, the debounced cash-out field, 7-2 win and
// strike steppers, the double-rAF entrance, Escape/backdrop dismissal, and the
// re-render after API actions. The page constructs it in the constructor,
// opens it from the player-card click in active sessions, and calls refresh()
// from refreshEntries() so the open modal tracks the fresh session. It
// receives a context object ({ session: live session getter, api,
// refreshEntries }) and never touches page internals.
import { formatCurrency } from './formatters.js';
import { escapeHtml } from './ui.js';

export default class PlayerEditModalController {
    constructor() {
        this.opened = false;
        this._activePlayerId = null;
        this._sessionId = null;
        this._renderModal = null;
        this._attachListeners = null;
    }

    open(context, player, sessionId) {
        // Remove a stale copy before mounting a new one (same as the add-players picker).
        const stale = document.getElementById('player-edit-modal-wrapper');
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
        const modalElement = document.createElement('div');
        modalElement.id = 'player-edit-modal-wrapper';
        // True once the entrance has played; re-renders after API actions must
        // restore .active synchronously or the modal flashes closed.
        this.opened = false;
        this._activePlayerId = player.id;
        this._sessionId = sessionId;

        const renderModal = () => {
            const p = context.session().players.find(pp => pp.id === player.id) || player;
            const buyInCount = p.buyInCount || 1;
            const totalBuyIn = p.buyIn || 0;
            const cashOut = p.cashOut || 0;

            modalElement.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <button id="edit-modal-close" class="modal-close-btn" type="button" aria-label="Close player edit">&times;</button>
                        <h3>${escapeHtml(p.name)}</h3>

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
            if (this.opened) modalElement.querySelector('.modal-overlay').classList.add('active');
        };
        renderModal();
        document.body.appendChild(modalElement);

        const handleEscape = (event) => {
            if (event.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', handleEscape);
        this._removeEscape = () => document.removeEventListener('keydown', handleEscape);

        // Play the canonical fade + rise entrance: paint one hidden frame first,
        // then reveal and focus the first field.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const overlay = modalElement.querySelector('.modal-overlay');
            if (!overlay) return;
            overlay.classList.add('active');
            this.opened = true;
            const cashoutInput = modalElement.querySelector('#edit-cashout-input');
            if (cashoutInput) cashoutInput.focus();
        }));

        const apiAction = async (fn) => {
            try {
                const newEntries = await fn();
                context.refreshEntries(newEntries, sessionId);
                renderModal();
                attachListeners();
            } catch (error) {
                console.error('Error in player edit modal:', error);
                alert(`Error: ${error.message}`);
            }
        };

        const attachListeners = () => {
            modalElement.querySelector('#edit-modal-close')?.addEventListener('click', () => this.close());
            modalElement.querySelector('#edit-modal-profile-link')?.addEventListener('click', () => this.close());
            // Close on overlay click
            modalElement.querySelector(':scope > .modal-overlay')?.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) this.close();
            });

            // Buy-in controls
            modalElement.querySelector('#edit-buyin-minus')?.addEventListener('click', () => {
                const p = context.session().players.find(pp => pp.id === player.id);
                if (p && (p.buyInCount || 1) > 1) {
                    apiAction(() => context.api.put(`sessions/${sessionId}/entries/${player.id}/remove-buyin`));
                }
            });
            modalElement.querySelector('#edit-buyin-plus')?.addEventListener('click', () => {
                apiAction(() => context.api.post(`sessions/${sessionId}/entries/${player.id}/buy-in`, { num_buy_ins: 1 }));
            });

            // Cash-out input
            const cashoutInput = modalElement.querySelector('#edit-cashout-input');
            if (cashoutInput) {
                let cashoutDebounce = null;
                const saveCashout = async () => {
                    const val = parseFloat(cashoutInput.value);
                    if (isNaN(val) || val < 0) return;
                    await apiAction(() => context.api.put(`sessions/${sessionId}/entries/${player.id}/payout`, { payout_amount: val }));
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
                apiAction(() => context.api.put(`sessions/${sessionId}/players/${player.id}/seven-two-wins/decrement`));
            });
            modalElement.querySelector('#edit-72-plus')?.addEventListener('click', () => {
                apiAction(() => context.api.put(`sessions/${sessionId}/players/${player.id}/seven-two-wins/increment`));
            });

            // Strikes controls
            modalElement.querySelector('#edit-strikes-minus')?.addEventListener('click', () => {
                apiAction(() => context.api.put(`sessions/${sessionId}/players/${player.id}/strikes/decrement`));
            });
            modalElement.querySelector('#edit-strikes-plus')?.addEventListener('click', () => {
                apiAction(() => context.api.put(`sessions/${sessionId}/players/${player.id}/strikes/increment`));
            });
        };

        attachListeners();
    }

    close() {
        const el = document.getElementById('player-edit-modal-wrapper');
        if (el && el.parentNode) el.parentNode.removeChild(el);
        if (this._removeEscape) this._removeEscape();
        this.opened = false;
        this._activePlayerId = null;
        this._sessionId = null;
    }

}
