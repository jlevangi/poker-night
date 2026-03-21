// Session detail page module
import ApiService from './api-service.js';
import { NotificationManager } from './notification-manager.js';

export default class SessionDetailPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.notificationManager = new NotificationManager(apiService);
    }

    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown Date';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    async load(sessionId) {
        try {
            const session = await this.api.get(`sessions/${sessionId}`);
            const availablePlayers = await this.api.get('players/details');
            session.availablePlayers = availablePlayers || [];

            if (session.entries) {
                session.totalValue = session.entries.reduce((sum, entry) => sum + entry.total_buy_in_amount, 0);
                const totalPayout = session.entries.reduce((sum, entry) => sum + entry.payout, 0);
                const rawUnpaidValue = session.totalValue - totalPayout;
                session.unpaidValue = Math.round(rawUnpaidValue * 100) / 100;

                session.players = session.entries.map(entry => ({
                    id: entry.player_id,
                    name: entry.player_name,
                    buyIn: entry.total_buy_in_amount,
                    buyInCount: entry.buy_in_count,
                    cashOut: entry.payout,
                    isCashedOut: entry.is_cashed_out || false,
                    sevenTwoWins: entry.session_seven_two_wins || 0,
                    strikes: entry.session_strikes || 0
                }));
            } else {
                session.totalValue = 0;
                session.unpaidValue = 0;
                session.players = [];
            }

            if (session.session_info && session.session_info.default_buy_in_value) {
                session.buyin = session.session_info.default_buy_in_value;
            } else if (session.default_buy_in_value) {
                session.buyin = session.default_buy_in_value;
            } else {
                session.buyin = 20.00;
            }

            const dateForTitle = (session.session_info || session).date;
            document.title = `Session - ${this.formatDate(dateForTitle)} - Gamble King`;

            this.render(session, sessionId);
        } catch (error) {
            console.error(`Error loading session details for ${sessionId}:`, error);
            this.appContent.innerHTML = `<p>Could not load details for session ${sessionId}. ${error.message}</p>`;
        }
    }

    renderChipDistribution(session) {
        if (!session || !session.session_info || !session.session_info.chip_distribution) {
            return `<div class="neo-card" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">🎰 Chip Distribution</h3>
                <p style="font-weight: 600; color: var(--text-secondary);">No chip distribution data available.</p>
            </div>`;
        }

        const chipDistribution = session.session_info.chip_distribution;
        const buyInValue = session.session_info.default_buy_in_value || 20.00;
        const totalChips = session.session_info.total_chips || Object.values(chipDistribution).reduce((sum, count) => sum + count, 0);

        const chipColors = {
            'Black': '#1F2937', 'Blue': '#1E3A8A', 'Green': '#065F46', 'Red': '#991B1B', 'White': '#F9FAFB'
        };
        const chipOrder = ['Black', 'Blue', 'Green', 'Red', 'White'];

        let html = `
            <p style="font-weight: 600; color: var(--casino-purple-dark); margin-bottom: 1rem;">
                For <span style="color: var(--casino-green); font-weight: 800;">$${buyInValue.toFixed(2)}</span> buy-in
                (<span style="color: var(--casino-gold); font-weight: 800;">${totalChips} chips</span>):
            </p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">`;

        for (const chipColor of chipOrder) {
            if (chipDistribution[chipColor] && chipDistribution[chipColor] > 0) {
                const backgroundColor = chipColors[chipColor];
                const textColor = chipColor === 'White' ? '#000000' : '#FFFFFF';
                html += `
                    <div style="width: 70px; height: 70px; border-radius: 50%; background-color: ${backgroundColor}; color: ${textColor}; border: var(--neo-border-thick); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; box-shadow: var(--neo-shadow-md); position: relative; overflow: hidden;">
                        <div style="font-size: 1rem; line-height: 1;">${chipDistribution[chipColor]}</div>
                        <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">${chipColor}</div>
                        <div style="position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 2px dashed ${textColor === '#FFFFFF' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}; border-radius: 50%;"></div>
                    </div>`;
            }
        }

        html += `</div>`;
        return html;
    }

    renderCompactPlayerCard(player, isActive, sessionData) {
        const buyIn = player.buyIn || 0;
        const cashOut = player.cashOut || 0;
        const profit = cashOut - buyIn;
        const profitClass = profit >= 0 ? '' : 'player-loss';
        const cashedOutClass = player.isCashedOut ? 'player-cashed-out' : '';

        let badges = '';
        if (player.sevenTwoWins > 0) {
            badges += `<span class="player-badge player-badge-gold">7-2: ${player.sevenTwoWins}</span>`;
        }
        if (player.strikes > 0) {
            badges += `<span class="player-badge player-badge-red">X: ${player.strikes}</span>`;
        }
        if (player.id === sessionData.wisdom_player_id) {
            badges += `<span class="player-badge player-badge-gold">🗣️</span>`;
        }

        const rightIndicator = player.isCashedOut
            ? `<span class="player-badge player-badge-green">✓ OUT</span>`
            : `<span class="card-chevron">▸</span>`;

        return `
            <div class="neo-card neo-card-clickable player-compact-card clickable-player-details ${profitClass} ${cashedOutClass}" data-player-id="${player.id}">
                <div class="player-row-top">
                    <div class="player-info">
                        <span class="player-name">${player.name}</span>
                        ${badges ? `<span class="player-badges">${badges}</span>` : ''}
                    </div>
                    ${rightIndicator}
                </div>
                <div class="player-row-stats">
                    <div class="player-stat">
                        <span class="player-stat-label">Buy-in</span>
                        <span class="player-stat-value" style="color: var(--casino-red);">$${buyIn.toFixed(2)}</span>
                    </div>
                    <div class="player-stat-divider"></div>
                    <div class="player-stat">
                        <span class="player-stat-label">Cash-out</span>
                        <span class="player-stat-value" style="color: var(--casino-gold);">$${cashOut.toFixed(2)}</span>
                    </div>
                    <div class="player-stat-divider"></div>
                    <div class="player-stat">
                        <span class="player-stat-label">Profit</span>
                        <span class="player-stat-value ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderPlayerActionModalBody(player, sessionData, sessionId) {
        const buyIn = player.buyIn || 0;
        const cashOut = player.cashOut || 0;
        const profit = cashOut - buyIn;
        const defaultBuyIn = sessionData.default_buy_in_value || 20;
        const isActive = sessionData.is_active === true;

        let html = `
            <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">${player.name}</h3>

            <div class="player-modal-stats">
                <div class="player-stat">
                    <span class="player-stat-label">Buy-in</span>
                    <span class="player-stat-value" style="color: var(--casino-red);">$${buyIn.toFixed(2)}</span>
                </div>
                <div class="player-stat">
                    <span class="player-stat-label">Cash-out</span>
                    <span class="player-stat-value" style="color: var(--casino-gold);">$${cashOut.toFixed(2)}</span>
                </div>
                <div class="player-stat">
                    <span class="player-stat-label">Profit</span>
                    <span class="player-stat-value ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</span>
                </div>
            </div>
        `;

        if (isActive) {
            // Buy-in counter
            html += `
                <div class="modal-section-label">Buy-ins (${player.buyInCount}× $${defaultBuyIn.toFixed(2)})</div>
                <div class="modal-counter">
                    <button class="modal-counter-btn btn-decrement" id="modal-buyin-dec" ${player.buyInCount <= 1 ? 'disabled' : ''}>−</button>
                    <span class="modal-counter-value" id="modal-buyin-count">${player.buyInCount}</span>
                    <button class="modal-counter-btn btn-increment" id="modal-buyin-inc">+</button>
                </div>

                <div class="modal-section-label">7-2 Wins</div>
                <div class="modal-counter">
                    <button class="modal-counter-btn btn-decrement" id="modal-72-dec" ${(player.sevenTwoWins || 0) <= 0 ? 'disabled' : ''}>−</button>
                    <span class="modal-counter-value" id="modal-72-count">${player.sevenTwoWins || 0}</span>
                    <button class="modal-counter-btn btn-increment" id="modal-72-inc">+</button>
                </div>

                <div class="modal-section-label">Strikes</div>
                <div class="modal-counter">
                    <button class="modal-counter-btn btn-decrement" id="modal-strikes-dec" ${(player.strikes || 0) <= 0 ? 'disabled' : ''}>−</button>
                    <span class="modal-counter-value" id="modal-strikes-count">${player.strikes || 0}</span>
                    <button class="modal-counter-btn btn-increment" id="modal-strikes-inc">+</button>
                </div>

                <div style="margin-top: 1.25rem;">
                    ${player.isCashedOut ?
                        `<button id="modal-primary-action" class="neo-btn neo-btn-green" style="width: 100%;">💰 Buy In</button>` :
                        `<button id="modal-primary-action" class="neo-btn neo-btn-gold" style="width: 100%;">💸 Cash Out</button>`
                    }
                </div>
            `;
        }

        html += `<a href="#player/${player.id}" class="player-modal-link">View Player Profile →</a>`;
        return html;
    }

    showPlayerActionModal(player, sessionData, sessionId) {
        const modalBody = document.getElementById('player-action-modal-body');
        const modal = document.getElementById('player-action-modal');
        if (!modalBody || !modal) return;

        modalBody.innerHTML = this.renderPlayerActionModalBody(player, sessionData, sessionId);

        // Show modal
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '2000';
        modal.style.pointerEvents = 'auto';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';

        const isActive = sessionData.is_active === true;
        if (!isActive) return;

        const defaultBuyIn = sessionData.default_buy_in_value || 20;

        // Buy-in counter handlers
        const buyinDec = document.getElementById('modal-buyin-dec');
        const buyinInc = document.getElementById('modal-buyin-inc');

        if (buyinDec) {
            buyinDec.addEventListener('click', async () => {
                if (player.buyInCount <= 1) return;
                buyinDec.disabled = true;
                buyinInc.disabled = true;
                try {
                    const newCount = player.buyInCount - 1;
                    await this.api.put(`sessions/${sessionId}/entries/${player.id}/set-buyins`, { buy_in_count: newCount });
                    this.hidePlayerActionModal();
                    this.load(sessionId);
                } catch (error) {
                    alert(`Error: ${error.message}`);
                    buyinDec.disabled = false;
                    buyinInc.disabled = false;
                }
            });
        }

        if (buyinInc) {
            buyinInc.addEventListener('click', async () => {
                buyinDec.disabled = true;
                buyinInc.disabled = true;
                try {
                    await this.api.post(`sessions/${sessionId}/entries/${player.id}/buy-in`, { num_buy_ins: 1 });
                    this.hidePlayerActionModal();
                    this.load(sessionId);
                } catch (error) {
                    alert(`Error: ${error.message}`);
                    buyinDec.disabled = false;
                    buyinInc.disabled = false;
                }
            });
        }

        // 7-2 handlers
        const s72Dec = document.getElementById('modal-72-dec');
        const s72Inc = document.getElementById('modal-72-inc');

        if (s72Dec) {
            s72Dec.addEventListener('click', async () => {
                s72Dec.disabled = true;
                try {
                    await this.api.put(`sessions/${sessionId}/players/${player.id}/seven-two-wins/decrement`);
                    this.hidePlayerActionModal();
                    this.load(sessionId);
                } catch (error) {
                    alert(`Error: ${error.message}`);
                    s72Dec.disabled = false;
                }
            });
        }

        if (s72Inc) {
            s72Inc.addEventListener('click', async () => {
                s72Inc.disabled = true;
                try {
                    await this.api.put(`sessions/${sessionId}/players/${player.id}/seven-two-wins/increment`);
                    this.hidePlayerActionModal();
                    this.load(sessionId);
                } catch (error) {
                    alert(`Error: ${error.message}`);
                    s72Inc.disabled = false;
                }
            });
        }

        // Strikes handlers
        const strikesDec = document.getElementById('modal-strikes-dec');
        const strikesInc = document.getElementById('modal-strikes-inc');

        if (strikesDec) {
            strikesDec.addEventListener('click', async () => {
                strikesDec.disabled = true;
                try {
                    await this.api.put(`sessions/${sessionId}/players/${player.id}/strikes/decrement`);
                    this.hidePlayerActionModal();
                    this.load(sessionId);
                } catch (error) {
                    alert(`Error: ${error.message}`);
                    strikesDec.disabled = false;
                }
            });
        }

        if (strikesInc) {
            strikesInc.addEventListener('click', async () => {
                strikesInc.disabled = true;
                try {
                    await this.api.put(`sessions/${sessionId}/players/${player.id}/strikes/increment`);
                    this.hidePlayerActionModal();
                    this.load(sessionId);
                } catch (error) {
                    alert(`Error: ${error.message}`);
                    strikesInc.disabled = false;
                }
            });
        }

        // Primary action (Cash Out / Buy In)
        const primaryBtn = document.getElementById('modal-primary-action');
        if (primaryBtn) {
            primaryBtn.addEventListener('click', () => {
                if (player.isCashedOut) {
                    this.showBuyInForm(player, sessionData, sessionId);
                } else {
                    this.showCashOutForm(player, sessionData, sessionId);
                }
            });
        }
    }

    showCashOutForm(player, sessionData, sessionId) {
        const modalBody = document.getElementById('player-action-modal-body');
        if (!modalBody) return;

        modalBody.innerHTML = `
            <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">Cash Out ${player.name}</h3>
            <label style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.5rem;">Cash-out amount ($)</label>
            <input type="text" id="modal-cashout-amount" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" class="modal-cashout-input" placeholder="0.00">
            <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                <button id="modal-cashout-cancel" class="neo-btn" style="flex: 1;">Cancel</button>
                <button id="modal-cashout-confirm" class="neo-btn neo-btn-gold" style="flex: 1;">Cash Out</button>
            </div>
        `;

        const input = document.getElementById('modal-cashout-amount');
        const cancelBtn = document.getElementById('modal-cashout-cancel');
        const confirmBtn = document.getElementById('modal-cashout-confirm');

        setTimeout(() => input.focus(), 100);

        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9.]/g, '');
            const parts = value.split('.');
            if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
            e.target.value = value;
        });

        cancelBtn.addEventListener('click', () => {
            this.showPlayerActionModal(player, sessionData, sessionId);
        });

        const doCashOut = async () => {
            const cashOutValue = parseFloat(input.value);
            if (isNaN(cashOutValue) || cashOutValue < 0 || input.value === '') {
                alert('Please enter a valid cash-out amount');
                return;
            }
            try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Processing...';
                await this.api.put(`sessions/${sessionId}/entries/${player.id}/payout`, { payout_amount: cashOutValue });
                this.hidePlayerActionModal();
                this.load(sessionId);
            } catch (error) {
                alert(`Error: ${error.message}`);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Cash Out';
            }
        };

        confirmBtn.addEventListener('click', doCashOut);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doCashOut(); });
    }

    showBuyInForm(player, sessionData, sessionId) {
        const modalBody = document.getElementById('player-action-modal-body');
        if (!modalBody) return;
        const defaultBuyIn = sessionData.default_buy_in_value || 20;

        modalBody.innerHTML = `
            <h3 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">Buy In ${player.name}</h3>
            <label style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.5rem;">Buy-in amount ($)</label>
            <input type="text" id="modal-buyin-amount" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" class="modal-cashout-input" value="${defaultBuyIn.toFixed(2)}">
            <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                <button id="modal-buyin-cancel" class="neo-btn" style="flex: 1;">Cancel</button>
                <button id="modal-buyin-confirm" class="neo-btn neo-btn-green" style="flex: 1;">Buy In</button>
            </div>
        `;

        const input = document.getElementById('modal-buyin-amount');
        const cancelBtn = document.getElementById('modal-buyin-cancel');
        const confirmBtn = document.getElementById('modal-buyin-confirm');

        setTimeout(() => { input.focus(); input.select(); }, 100);

        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9.]/g, '');
            const parts = value.split('.');
            if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
            e.target.value = value;
        });

        cancelBtn.addEventListener('click', () => {
            this.showPlayerActionModal(player, sessionData, sessionId);
        });

        const doBuyIn = async () => {
            const buyinValue = parseFloat(input.value);
            if (isNaN(buyinValue) || buyinValue <= 0 || input.value === '') {
                alert('Please enter a valid buy-in amount');
                return;
            }
            try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Processing...';
                const numBuyIns = Math.round(buyinValue / defaultBuyIn);
                if (numBuyIns <= 0) { alert('Amount must result in at least one buy-in'); confirmBtn.disabled = false; confirmBtn.textContent = 'Buy In'; return; }
                await this.api.post(`sessions/${sessionId}/entries/${player.id}/buy-in`, { num_buy_ins: numBuyIns });
                this.hidePlayerActionModal();
                this.load(sessionId);
            } catch (error) {
                alert(`Error: ${error.message}`);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Buy In';
            }
        };

        confirmBtn.addEventListener('click', doBuyIn);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doBuyIn(); });
    }

    hidePlayerActionModal() {
        const modal = document.getElementById('player-action-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            modal.style.pointerEvents = 'none';
        }
    }

    render(session, sessionId) {
        this.currentSession = session;
        const sessionData = session.session_info || session;
        const isActive = sessionData.is_active === true;

        let html = `
            <div style="padding: 1rem; max-width: 1200px; margin: 0 auto;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <a href="#sessions" class="neo-btn neo-btn-purple neo-btn-sm">← Back</a>
                    <button id="share-btn" class="neo-btn neo-btn-gold neo-btn-sm">📋 Share</button>
                </div>

                ${isActive ?
                    `<div style="margin-bottom: 0.75rem;">
                        <button id="notification-btn" class="neo-btn neo-btn-gold neo-btn-sm" data-state="loading" style="width: 100%;">
                            <span class="btn-text">🔔 Loading...</span>
                        </button>
                    </div>` : ''
                }

                <!-- Session Info Card -->
                <div class="session-header-card ${isActive ? 'session-active' : 'session-ended'}">
                    <div class="session-header-top">
                        <h2 class="session-date">🎯 ${this.formatDate(sessionData.date)}</h2>
                        <span class="session-status-badge ${isActive ? 'status-active' : 'status-ended'}">${isActive ? 'ACTIVE' : 'ENDED'}</span>
                    </div>
                    <div class="session-stats-row">
                        <div class="session-stat">
                            <span class="session-stat-value">$${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '0.00'}</span>
                            <span class="session-stat-label">Buy-in</span>
                        </div>
                        <div class="session-stat-divider"></div>
                        <div class="session-stat">
                            <span class="session-stat-value">$${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</span>
                            <span class="session-stat-label">Total</span>
                        </div>
                        <div class="session-stat-divider"></div>
                        <div class="session-stat">
                            <span class="session-stat-value ${session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'profit-negative' : 'profit-positive'}">
                                ${session.unpaidValue > 0.01 ?
                                    `$${session.unpaidValue.toFixed(2)}` :
                                    session.unpaidValue < -0.01 ?
                                    `-$${Math.abs(session.unpaidValue).toFixed(2)}` :
                                    (!isActive ? 'PAID' : '$0.00')}
                            </span>
                            <span class="session-stat-label">${session.unpaidValue > 0.01 ? 'Unpaid' : session.unpaidValue < -0.01 ? 'House Loss' : 'Status'}</span>
                        </div>
                    </div>
                </div>

                <!-- Words of Wisdom Display -->
                ${sessionData.wisdom_quote ? `
                <div class="neo-card neo-card-gold" style="margin-top: 0.75rem; text-align: center; padding: 0.75rem 1rem;">
                    <p style="font-size: 1rem; font-style: italic; color: var(--text-primary); margin-bottom: 0.15rem;">
                        "${sessionData.wisdom_quote}"
                    </p>
                    <p style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin: 0;">
                        — ${session.players?.find(p => p.id === sessionData.wisdom_player_id)?.name || 'Unknown'}
                    </p>
                </div>
                ` : ''}

                <!-- Words of Wisdom Edit (collapsible, active only) -->
                ${isActive ? `
                <div class="neo-card" style="margin-top: 0.5rem; padding: 0.6rem 1rem;">
                    <div class="section-toggle" id="wisdom-toggle">
                        <span style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">💬 ${sessionData.wisdom_quote ? 'Edit' : 'Add'} Words of Wisdom</span>
                        <span class="toggle-chevron">▸</span>
                    </div>
                    <div class="section-collapsible-content" id="wisdom-content">
                        <textarea id="wisdom-quote-input" placeholder="Enter the quote..." style="padding: 0.75rem; border: var(--neo-border); font-size: 0.9rem; font-weight: 600; background: var(--bg-card); min-height: 60px; resize: vertical; width: 100%; box-sizing: border-box;">${sessionData.wisdom_quote || ''}</textarea>
                        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem;">
                            <select id="wisdom-player-select" style="flex: 1; min-width: 150px; padding: 0.75rem; border: var(--neo-border); font-size: 0.9rem; font-weight: 600; background: var(--bg-card);">
                                <option value="">-- Who said it? --</option>
                                ${(session.players || []).map(player =>
                                    `<option value="${player.id}" ${player.id === sessionData.wisdom_player_id ? 'selected' : ''}>${player.name}</option>`
                                ).join('')}
                            </select>
                            <button id="save-wisdom-btn" class="neo-btn neo-btn-gold neo-btn-sm">Save</button>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Players Section -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 1rem 0 0.5rem 0;">
                    <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); margin: 0;">🎭 Players</h3>
                    ${isActive ? `<button id="add-player-btn" class="neo-btn neo-btn-green neo-btn-sm">➕ Add</button>` : ''}
                </div>
        `;

        // Render compact player cards
        if (session.players && session.players.length > 0) {
            session.players.forEach(player => {
                html += this.renderCompactPlayerCard(player, isActive, sessionData);
            });
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">👤</div>
                    <p style="font-size: 1rem; font-weight: 700; color: var(--text-secondary); margin: 0;">No players yet.</p>
                </div>
            `;
        }

        // Chip Distribution (collapsible)
        html += `
            <div class="neo-card neo-card-purple" style="margin-top: 0.75rem; padding: 0.6rem 1rem;">
                <div class="section-toggle" id="chip-toggle">
                    <span style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--casino-purple-dark);">🎰 Chip Distribution</span>
                    <span class="toggle-chevron">▸</span>
                </div>
                <div class="section-collapsible-content" id="chip-content">
                    ${this.renderChipDistribution(session)}
                </div>
            </div>
        `;

        // Session Controls
        html += `
                <div style="margin-top: 1rem; text-align: center;">
                    ${isActive ?
                        `<button id="end-session-btn" class="neo-btn neo-btn-red neo-btn-lg">End Session</button>` :
                        `<button id="reactivate-session-btn" class="neo-btn neo-btn-green neo-btn-lg">▶️ Reactivate Session</button>`
                    }
                </div>

                <!-- Player Action Modal -->
                <div id="player-action-modal" class="modal-overlay" style="display: none;">
                    <div class="modal-content" style="max-width: 420px; width: 90%; padding: 1.5rem; border: var(--neo-border-thick); box-shadow: var(--neo-shadow-lg); background: var(--bg-card);">
                        <span class="modal-close-btn" id="player-modal-close" style="position: absolute; top: 0.75rem; right: 1rem; font-size: 1.5rem; cursor: pointer; font-weight: 800;">&times;</span>
                        <div id="player-action-modal-body"></div>
                    </div>
                </div>

                <!-- Add Player Modal -->
                <div id="add-player-modal" class="modal-overlay" style="display: none;">
                    <div class="modal-content" style="max-width: 420px; width: 90%; padding: 1.5rem; border: var(--neo-border-thick); box-shadow: var(--neo-shadow-lg); background: var(--bg-card);">
                        <span class="modal-close-btn" id="add-player-modal-close" style="position: absolute; top: 0.75rem; right: 1rem; font-size: 1.5rem; cursor: pointer; font-weight: 800;">&times;</span>
                        <h3 style="font-size: 1.25rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--casino-green-dark);">➕ Add Player</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <select id="add-player-select" style="padding: 0.875rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                                <option value="">-- Select Player --</option>
                                ${(session.availablePlayers || []).map(player =>
                                    `<option value="${player.player_id}">${player.name}</option>`
                                ).join('')}
                            </select>
                            <input type="number" id="player-buyin" placeholder="Buy-in Amount ($)" value="${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00'}" step="0.01" style="padding: 0.875rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                            <button id="add-player-to-session-btn" class="neo-btn neo-btn-green" style="width: 100%;">Add Player</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.appContent.innerHTML = html;
        this.setupEventListeners(sessionData, sessionId, isActive);
    }

    setupEventListeners(session, sessionId, isActive) {
        // Share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) shareBtn.addEventListener('click', () => this.handleShare());

        // Collapsible section toggles
        this.setupToggle('wisdom-toggle', 'wisdom-content');
        this.setupToggle('chip-toggle', 'chip-content');

        // Player modal close
        const playerModalClose = document.getElementById('player-modal-close');
        if (playerModalClose) playerModalClose.addEventListener('click', () => this.hidePlayerActionModal());

        const playerModal = document.getElementById('player-action-modal');
        if (playerModal) {
            playerModal.addEventListener('click', (e) => {
                if (e.target === playerModal) this.hidePlayerActionModal();
            });
        }

        // Add player modal
        const addPlayerModal = document.getElementById('add-player-modal');
        const addPlayerModalClose = document.getElementById('add-player-modal-close');

        const showAddPlayerModal = () => {
            if (!addPlayerModal) return;
            addPlayerModal.style.display = 'flex';
            addPlayerModal.style.opacity = '1';
            addPlayerModal.style.visibility = 'visible';
            addPlayerModal.style.zIndex = '2000';
            addPlayerModal.style.pointerEvents = 'auto';
            addPlayerModal.style.position = 'fixed';
            addPlayerModal.style.top = '0';
            addPlayerModal.style.left = '0';
            addPlayerModal.style.width = '100%';
            addPlayerModal.style.height = '100%';
            addPlayerModal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            addPlayerModal.style.justifyContent = 'center';
            addPlayerModal.style.alignItems = 'center';
        };

        const hideAddPlayerModal = () => {
            if (!addPlayerModal) return;
            addPlayerModal.style.opacity = '0';
            addPlayerModal.style.visibility = 'hidden';
            addPlayerModal.style.pointerEvents = 'none';
        };

        const addPlayerBtn = document.getElementById('add-player-btn');
        if (addPlayerBtn) addPlayerBtn.addEventListener('click', showAddPlayerModal);
        if (addPlayerModalClose) addPlayerModalClose.addEventListener('click', hideAddPlayerModal);
        if (addPlayerModal) {
            addPlayerModal.addEventListener('click', (e) => {
                if (e.target === addPlayerModal) hideAddPlayerModal();
            });
        }

        // Player card click handlers
        document.querySelectorAll('.clickable-player-details').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a')) return;
                const playerId = element.dataset.playerId;
                if (!playerId) return;

                if (isActive) {
                    const player = this.currentSession.players.find(p => p.id === playerId);
                    if (player) {
                        this.showPlayerActionModal(player, session, sessionId);
                    }
                } else {
                    window.location.hash = `#player/${playerId}`;
                }
            });
        });

        if (!isActive) {
            const reactivateBtn = document.getElementById('reactivate-session-btn');
            if (reactivateBtn) {
                reactivateBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to reactivate this session?")) {
                        try {
                            reactivateBtn.disabled = true;
                            reactivateBtn.textContent = 'Reactivating...';
                            await this.api.put(`sessions/${sessionId}/reactivate`);
                            this.load(sessionId);
                        } catch (error) {
                            alert(`Error: ${error.message}`);
                            reactivateBtn.disabled = false;
                            reactivateBtn.textContent = '▶️ Reactivate Session';
                        }
                    }
                });
            }
        }

        if (isActive) {
            // End session
            const endSessionBtn = document.getElementById('end-session-btn');
            if (endSessionBtn) {
                endSessionBtn.addEventListener('click', async () => {
                    const unpaidValue = this.currentSession?.unpaidValue || 0;
                    const hasDiscrepancy = Math.abs(unpaidValue) > 0.01;
                    if (hasDiscrepancy) {
                        this.showDiscrepancyModal(unpaidValue, sessionId, endSessionBtn);
                    } else {
                        if (confirm("Are you sure you want to end this session?")) {
                            await this.endSession(sessionId, endSessionBtn);
                        }
                    }
                });
            }

            // Save wisdom
            const saveWisdomBtn = document.getElementById('save-wisdom-btn');
            const wisdomQuoteInput = document.getElementById('wisdom-quote-input');
            const wisdomPlayerSelect = document.getElementById('wisdom-player-select');
            if (saveWisdomBtn && wisdomQuoteInput && wisdomPlayerSelect) {
                saveWisdomBtn.addEventListener('click', async () => {
                    const quote = wisdomQuoteInput.value.trim();
                    const playerId = wisdomPlayerSelect.value;
                    if (quote && !playerId) { alert('Please select who said the quote'); return; }
                    try {
                        saveWisdomBtn.disabled = true;
                        saveWisdomBtn.textContent = 'Saving...';
                        await this.api.put(`sessions/${sessionId}/wisdom`, { wisdom_quote: quote, wisdom_player_id: playerId || null });
                        this.load(sessionId);
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                        saveWisdomBtn.disabled = false;
                        saveWisdomBtn.textContent = 'Save';
                    }
                });
            }

            // Add player to session
            const addPlayerSubmitBtn = document.getElementById('add-player-to-session-btn');
            const playerSelect = document.getElementById('add-player-select');
            const buyinInput = document.getElementById('player-buyin');

            if (addPlayerSubmitBtn && playerSelect && buyinInput) {
                addPlayerSubmitBtn.addEventListener('click', async () => {
                    const playerId = playerSelect.value;
                    const buyin = parseFloat(buyinInput.value);
                    if (!playerId) { alert('Please select a player'); return; }
                    if (isNaN(buyin) || buyin <= 0) { alert('Please enter a valid buy-in amount'); return; }

                    const defaultBuyin = session.default_buy_in_value || 20;
                    const numBuyIns = Math.round(buyin / defaultBuyin);
                    if (numBuyIns <= 0) { alert('Buy-in amount must result in at least one buy-in'); return; }

                    try {
                        addPlayerSubmitBtn.disabled = true;
                        addPlayerSubmitBtn.textContent = 'Adding...';
                        await this.api.post(`sessions/${sessionId}/entries`, { player_id: playerId, num_buy_ins: numBuyIns });
                        hideAddPlayerModal();
                        this.load(sessionId);
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                        addPlayerSubmitBtn.disabled = false;
                        addPlayerSubmitBtn.textContent = 'Add Player';
                    }
                });
            }

            // Notification handlers
            this.setupNotificationHandlers(sessionId);
        }
    }

    setupToggle(toggleId, contentId) {
        const toggle = document.getElementById(toggleId);
        const content = document.getElementById(contentId);
        if (!toggle || !content) return;
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('expanded');
            content.classList.toggle('expanded');
        });
    }

    async handleShare() {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: document.title, url }); return; } catch (e) { /* fall through */ }
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

    async setupNotificationHandlers(sessionId) {
        const notificationBtn = document.getElementById('notification-btn');
        if (!notificationBtn) return;

        const currentPlayerId = this.getCurrentPlayerId();
        if (!currentPlayerId) {
            this.updateNotificationButton(notificationBtn, 'unavailable', 'Not Available');
            return;
        }

        try {
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
                this.updateNotificationButton(notificationBtn, 'request-permission', '🔔 Get Notified');
                this.setupNotificationButtonHandler(notificationBtn, sessionId, currentPlayerId, 'request-permission');
                return;
            }

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

    updateNotificationButton(button, state, text) {
        button.setAttribute('data-state', state);
        button.querySelector('.btn-text').textContent = text;
        button.disabled = ['loading', 'unavailable', 'denied', 'error'].includes(state);
    }

    setupNotificationButtonHandler(button, sessionId, playerId, action) {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener('click', async () => {
            try {
                this.updateNotificationButton(newButton, 'loading', 'Loading...');
                switch (action) {
                    case 'request-permission':
                        await this.notificationManager.requestPermission();
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
                let errorMsg = 'An error occurred. Please try again.';
                if (error.message.includes('denied')) errorMsg = 'Permission denied. Please enable notifications in your browser settings.';
                else if (error.message.includes('not supported')) errorMsg = 'Notifications are not supported in this browser.';
                alert(errorMsg);
                setTimeout(() => this.setupNotificationHandlers(sessionId), 2000);
            }
        });
    }

    getCurrentPlayerId() {
        return localStorage.getItem('current_player_id') || 'pid_001';
    }

    showDiscrepancyModal(unpaidValue, sessionId, endSessionBtn) {
        const discrepancyType = unpaidValue > 0 ? 'Unpaid' : 'House Loss';
        const discrepancyAmount = Math.abs(unpaidValue).toFixed(2);
        const discrepancyColor = unpaidValue > 0 ? '#991B1B' : '#EA580C';

        const modalHtml = `
            <div class="discrepancy-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 1rem;">
                <div style="background: var(--bg-card); padding: 2rem; border: var(--neo-border-thick); box-shadow: var(--neo-shadow-lg); max-width: 500px; width: 100%;">
                    <h2 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: ${discrepancyColor}; display: flex; align-items: center; gap: 0.5rem;">
                        ⚠️ Money Discrepancy
                    </h2>
                    <div style="background: ${unpaidValue > 0 ? 'rgba(153, 27, 27, 0.1)' : 'rgba(234, 88, 12, 0.1)'}; border: 3px solid ${discrepancyColor}; padding: 1.5rem; margin-bottom: 1.5rem;">
                        <p style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">The session money does not balance:</p>
                        <p style="font-size: 1.75rem; font-weight: 900; color: ${discrepancyColor}; margin: 0;">${discrepancyType}: $${discrepancyAmount}</p>
                    </div>
                    <p style="font-size: 1rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
                        ${unpaidValue > 0
                            ? 'There is unpaid money. Players may not have cashed out all their chips.'
                            : 'The house paid out more than was bought in. This indicates a counting error.'}
                    </p>
                    <p style="font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 1.5rem;">Do you want to end the session anyway, or go back to recount?</p>
                    <div style="display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
                        <button id="cancel-end-session" class="neo-btn neo-btn-primary" style="flex: 1; min-width: 120px;">No, Recount</button>
                        <button id="confirm-end-session" class="neo-btn neo-btn-red" style="flex: 1; min-width: 120px;">Yes, End Anyway</button>
                    </div>
                </div>
            </div>
        `;

        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        document.body.appendChild(modalElement);

        const cancelBtn = document.getElementById('cancel-end-session');
        const confirmBtn = document.getElementById('confirm-end-session');

        cancelBtn.addEventListener('click', () => document.body.removeChild(modalElement));

        confirmBtn.addEventListener('click', async () => {
            cancelBtn.disabled = true;
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Ending...';
            try {
                await this.endSession(sessionId, endSessionBtn);
                document.body.removeChild(modalElement);
            } catch (error) {
                document.body.removeChild(modalElement);
            }
        });

        const overlay = modalElement.querySelector('.discrepancy-modal-overlay');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(modalElement);
        });
    }

    async endSession(sessionId, endSessionBtn) {
        try {
            endSessionBtn.disabled = true;
            endSessionBtn.textContent = 'Ending...';
            await this.api.put(`sessions/${sessionId}/end`);
            this.load(sessionId);
        } catch (error) {
            console.error('Error ending session:', error);
            alert(`Error: ${error.message}`);
            endSessionBtn.disabled = false;
            endSessionBtn.textContent = 'End Session';
            throw error;
        }
    }
}
