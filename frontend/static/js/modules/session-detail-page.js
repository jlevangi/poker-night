// Session detail page module
import ApiService from './api-service.js';
import { NotificationManager } from './notification-manager.js';

export default class SessionDetailPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.notificationManager = new NotificationManager(apiService);
    }
    
    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown Date';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Load session detail page
    async load(sessionId) {
        try {
            // Fetch session data using API service
            const session = await this.api.get(`sessions/${sessionId}`);
            
            // Fetch available players for the dropdown
            const availablePlayers = await this.api.get('players/details');
            
            // Add available players to the session object
            session.availablePlayers = availablePlayers || [];

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
                    strikes: entry.session_strikes || 0
                }));
            } else {
                session.totalValue = 0;
                session.unpaidValue = 0;
                session.players = [];
            }
            
            // Ensure the buy-in value is available for the form
            if (session.session_info && session.session_info.default_buy_in_value) {
                session.buyin = session.session_info.default_buy_in_value;
            } else if (session.default_buy_in_value) {
                session.buyin = session.default_buy_in_value;
            } else {
                session.buyin = 20.00; // Default value
            }
            
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
            return `<div class="chip-distribution">
                <h3>Chip Distribution</h3>
                <p>No chip distribution data available.</p>
            </div>`;
        }
        
        // Get chip distribution from session data
        const chipDistribution = session.session_info.chip_distribution;
        const buyInValue = session.session_info.default_buy_in_value || 20.00;
        const totalChips = session.session_info.total_chips || Object.values(chipDistribution).reduce((sum, count) => sum + count, 0);
        
        console.log("Chip distribution data:", chipDistribution);
        console.log("Buy-in value:", buyInValue);
        console.log("Total chips:", totalChips);
        
        // Define colors for styling
        const chipColors = {
            'Black': '#000000',
            'Blue': '#0e1b63',
            'Green': '#008000',
            'Red': '#FF0000',
            'White': '#FFFFFF'
        };
        
        // Sort chips by value (highest first)
        const chipOrder = ['Black', 'Blue', 'Green', 'Red', 'White'];
        
        let html = `
            <div class="chip-distribution">
                <h3>Chip Distribution</h3>
                <p class="chip-description">For a buy-in of $${buyInValue.toFixed(2)}, 
                   use the following chip distribution (${totalChips} total chips):</p>
                <div class="chip-container">`;
        
        // Create a chip element for each type
        for (const chipColor of chipOrder) {
            if (chipDistribution[chipColor] && chipDistribution[chipColor] > 0) {
                const backgroundColor = chipColors[chipColor];
                const textColor = ['White'].includes(chipColor) ? '#000000' : '#FFFFFF';
                
                // Define border styles based on chip color to match real poker chips
                let borderStyle;
                if (chipColor === 'White') {
                    borderStyle = '3px dashed #000000'; // Black dashed border for white chips only
                } else {
                    // All colored chips (Red, Blue, Green, Black) have white dashes in real life
                    borderStyle = '3px dashed #ffffff';
                }
                
                html += `
                    <div class="chip" style="background-color: ${backgroundColor}; color: ${textColor}; border: ${borderStyle}">
                        <span class="chip-count">${chipDistribution[chipColor]}</span>
                        <span class="chip-name">${chipColor}</span>
                    </div>`;
            }
        }
        
        html += `
                </div>
            </div>`;
        
        return html;
    }

    // Render session detail content
    render(session, sessionId) {
        console.log("Full session in render:", JSON.stringify(session, null, 2));
        
        // Extract the session data from the response structure
        const sessionData = session.session_info || session;
        console.log("Session data extracted:", JSON.stringify(sessionData, null, 2));
        
        // Check if session is active based on multiple possible indicators
        // If is_active is explicitly false OR status is explicitly ENDED, then it's not active
        // Default to inactive if is_active is missing
        const isActive = sessionData.is_active === true;
        
        console.log("Session active calculation:",
            "is_active =", sessionData.is_active,
            "status =", sessionData.status,
            "final isActive =", isActive);
        
        let html = `
            <!-- Header with navigation and notification controls -->
            <div class="session-header">
                <a href="#sessions" class="back-nav-btn">Back to Sessions</a>
                ${isActive ? 
                    `<button id="notification-btn" class="notification-btn" data-state="loading">
                        <span class="btn-text">Loading...</span>
                    </button>` : 
                    ''
                }
            </div>
            
            <h2>Session Details</h2>
            <p><strong>Date:</strong> ${this.formatDate(sessionData.date)}</p>
            <p><strong>Default Buy-in:</strong> $${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '0.00'}</p>
            <p><strong>Status:</strong> <span class="session-status status-${isActive ? 'active' : 'ended'}">${isActive ? 'ACTIVE' : 'ENDED'}</span></p>
              <div class="session-value-summary">
                <p class="session-total-value">Total Value: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</p>
                ${session.unpaidValue > 0.01 ? 
                    `<p class="session-unpaid-value">Unpaid Amount: $${session.unpaidValue.toFixed(2)}</p>` : 
                    (!isActive ? `<p class="session-unpaid-value paid-out">Fully Paid Out</p>` : '')}
            </div>
            

            <!-- Chip Distribution Section -->
            <div id="chip-distribution-container">
            ${this.renderChipDistribution(session)}
            </div>
            
            <h3>Players</h3>
        `;
        
        if (isActive) {
            // Log available players to debug
            console.log("Available players for dropdown:", session.availablePlayers);
            
            html += `
                <div class="add-player-form">
                    <div class="form-row">
                        <select id="add-player-select">
                            <option value="">-- Select Player --</option>
                            ${(session.availablePlayers || []).map(player => 
                                `<option value="${player.player_id}">${player.name}</option>`
                            ).join('')}
                        </select>
                        <input type="number" id="player-buyin" placeholder="Buy-in Amount ($)" value="${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00'}" step="0.01">
                        <button id="add-player-to-session-btn" class="action-btn">Add Player</button>
                    </div>
                </div>
            `;
        }
        
        // Render players list
        if (session.players && session.players.length > 0) {
            html += `<ul class="session-players-list">`;
            session.players.forEach(player => {
                // Ensure buyIn and cashOut are defined before calculating profit
                const buyIn = player.buyIn || 0;
                const cashOut = player.cashOut || 0;
                const profit = cashOut - buyIn;
                
                html += `
                    <li>
                        <div class="session-player-details clickable-player-details" data-player-id="${player.id}">
                            <p><strong><a href="#player/${player.id}">${player.name}</a></strong></p>
                            <p>Buy-in: $${buyIn.toFixed(2)} | 
                               Cash-out: $${cashOut.toFixed(2)} |
                               Profit: <span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</span></p>
                        </div>
                        
                        <div class="session-player-actions">
                            ${isActive ? (
                                player.isCashedOut ? 
                                    `<button class="buy-in-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}">Buy In</button>` :
                                    `<button class="cash-out-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}">Cash Out</button>`
                            ) : ''}
                        </div>
                        
                        <div class="session-seven-two-controls">
                            <div class="seven-two-label">7-2 Wins (Session):</div>
                            <div class="seven-two-value">${player.sevenTwoWins || 0}</div>
                            
                            ${isActive ? `
                                <div class="seven-two-buttons">
                                    <button class="seven-two-increment-btn" data-player-id="${player.id}">+</button>
                                    <button class="seven-two-decrement-btn" data-player-id="${player.id}">-</button>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="session-strikes-controls">
                            <div class="strikes-label">Strikes (Session):</div>
                            <div class="strikes-value">${player.strikes || 0}</div>
                            
                            ${isActive ? `
                                <div class="strikes-buttons">
                                    <button class="strikes-increment-btn" data-player-id="${player.id}">+</button>
                                    <button class="strikes-decrement-btn" data-player-id="${player.id}">-</button>
                                </div>
                            ` : ''}
                        </div>
                    </li>
                `;
            });
            
            html += `</ul>`;
        } else {
            html += `<p>No players in this session yet.</p>`;
        }
        
        // Add session control buttons at the bottom
        html += `
            <div class="session-bottom-controls">
                ${isActive ? 
                    `<button id="end-session-btn" class="action-btn danger-btn">
                        End Session
                    </button>` : 
                    `<button id="reactivate-session-btn" class="action-btn success-btn">
                        Reactivate Session
                    </button>`
                }
            </div>
        `;
        
        
        // Log the HTML about to be rendered
        console.log("Full HTML being set:", html);
        
        this.appContent.innerHTML = html;
        
        // Add styling for the session bottom controls
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .session-bottom-controls {
                margin: 20px 0;
                padding: 15px;
                border-top: 1px solid #ddd;
                text-align: center;
            }
            
            #end-session-btn {
                background-color: #E53935;
                color: white;
                font-weight: bold;
                padding: 10px 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: inline-block;
                width: auto;
                min-width: 200px;
                margin: 10px 5px;
            }
            
            #reactivate-session-btn {
                background-color: #4CAF50;
                color: white;
                font-weight: bold;
                padding: 10px 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: inline-block;
                width: auto;
                min-width: 200px;
                margin: 10px 5px;
            }
            
            #end-session-btn:hover {
                background-color: #D32F2F;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transform: translateY(-1px);
            }
            
            #reactivate-session-btn:hover {
                background-color: #45a049;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transform: translateY(-1px);
            }
            
            /* Ensure proper spacing for session reactivate button */
            .session-reactivate-container {
                text-align: center;
                margin: 20px 0;
            }
            
            /* Style for Cash Out button */
            .cash-out-player-btn {
                padding: 8px 16px;
                border-radius: 4px;
                border: none;
                background-color: #4CAF50 !important;
                color: white !important;
                font-weight: bold;
                cursor: pointer;
                margin-right: 8px;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .cash-out-player-btn:hover {
                background-color: #45a049 !important;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transform: translateY(-1px);
            }
            
            /* Style for Buy In button */
            .buy-in-player-btn {
                padding: 8px 16px;
                border-radius: 4px;
                border: none;
                background-color: #2196F3 !important;
                color: white !important;
                font-weight: bold;
                cursor: pointer;
                margin-right: 8px;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .buy-in-player-btn:hover {
                background-color: #1976D2 !important;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transform: translateY(-1px);
            }
            
            /* Generic success button style */
            .success-btn {
                background-color: #4CAF50;
                color: white;
            }
            
            /* Clickable player details styling */
            .clickable-player-details {
                cursor: pointer !important;
                transition: background-color 0.2s ease;
            }
            
            .clickable-player-details:hover {
                background-color: rgba(0, 123, 255, 0.1);
                border-radius: 4px;
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
    
    // Setup event listeners for the page
    setupEventListeners(session, sessionId, isActive) {
        console.log("Setting up event listeners, isActive:", isActive);
        
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
                    if (confirm("Are you sure you want to end this session? This will finalize profits.")) {
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
                        }
                    }
                });
            }
            
            // Add player to session button
            const addPlayerBtn = document.getElementById('add-player-to-session-btn');
            const playerSelect = document.getElementById('add-player-select');
            const buyinInput = document.getElementById('player-buyin');
            
            if (addPlayerBtn && playerSelect && buyinInput) {
                addPlayerBtn.addEventListener('click', async () => {
                    const playerId = playerSelect.value;
                    const buyin = parseFloat(buyinInput.value);
                    
                    if (!playerId) {
                        alert('Please select a player');
                        return;
                    }
                    
                    if (isNaN(buyin) || buyin <= 0) {
                        alert('Please enter a valid buy-in amount');
                        return;
                    }
                    
                    // Calculate number of buy-ins based on entered amount and session default buy-in
                    const defaultBuyin = session.default_buy_in_value || 20;
                    const numBuyIns = Math.round(buyin / defaultBuyin);
                    
                    if (numBuyIns <= 0) {
                        alert('Buy-in amount must result in at least one buy-in');
                        return;
                    }
                    
                    try {
                        // Show loading state
                        addPlayerBtn.disabled = true;
                        addPlayerBtn.textContent = 'Adding...';
                        
                        // Use the API service to add player to session
                        await this.api.post(`sessions/${sessionId}/entries`, { 
                            player_id: playerId, 
                            num_buy_ins: numBuyIns 
                        });
                        
                        // Reset form fields
                        playerSelect.value = '';
                        buyinInput.value = defaultBuyin.toFixed(2);
                        
                        // Reload the session detail page to show updated players
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error adding player to session:', error);
                        alert(`Error: ${error.message}`);
                        
                        // Restore button state
                        addPlayerBtn.disabled = false;
                        addPlayerBtn.textContent = 'Add Player';
                    }
                });
            }
            
            // Cash out button - collect payout amount and mark as cashed out
            document.querySelectorAll('.cash-out-player-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    
                    // Create a custom modal-like dialog for cash-out amount
                    const modalHtml = `
                        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                            <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
                                <h3>Cash Out Player</h3>
                                <label for="cashout-amount">Enter cash-out amount ($):</label>
                                <input type="number" id="cashout-amount" inputmode="decimal" step="0.01" min="0" style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
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
                    
                    // Focus the input for better UX
                    setTimeout(() => cashoutInput.focus(), 100);
                    
                    // Input validation - numbers only
                    cashoutInput.addEventListener('input', (event) => {
                        let value = event.target.value;
                        value = value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        if (parts.length > 2) {
                            value = parts[0] + '.' + parts.slice(1).join('');
                        }
                        event.target.value = value;
                    });
                    
                    // Cancel handler
                    cancelBtn.addEventListener('click', () => {
                        document.body.removeChild(modalElement);
                    });
                    
                    // Confirm handler
                    confirmBtn.addEventListener('click', async () => {
                        const cashOutValue = parseFloat(cashoutInput.value);
                        
                        if (isNaN(cashOutValue) || cashOutValue < 0 || cashoutInput.value === '') {
                            alert('Please enter a valid numeric cash-out amount');
                            return;
                        }
                        
                        try {
                            // Show loading state
                            button.disabled = true;
                            button.textContent = 'Processing...';
                            confirmBtn.disabled = true;
                            confirmBtn.textContent = 'Processing...';
                            
                            // Record payout (this will automatically set is_cashed_out = true)
                            await this.api.put(`sessions/${sessionId}/entries/${playerId}/payout`, { 
                                payout_amount: cashOutValue 
                            });
                            
                            // Remove modal
                            document.body.removeChild(modalElement);
                            
                            // Update button appearance and displayed values immediately without page reload
                            this.updatePlayerDisplay(button, playerId, { cashOut: cashOutValue, isCashedOut: true }, sessionId);
                            
                        } catch (error) {
                            console.error('Error processing cash-out:', error);
                            alert(`Error: ${error.message}`);
                            
                            // Restore button state
                            button.disabled = false;
                            button.textContent = 'Cash Out';
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Cash Out';
                        }
                    });
                    
                    // Enter key handler
                    cashoutInput.addEventListener('keypress', (event) => {
                        if (event.key === 'Enter') {
                            confirmBtn.click();
                        }
                    });
                });
            });
            
            // Buy in button - collect buy-in amount and mark as active
            document.querySelectorAll('.buy-in-player-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    
                    // Create a custom modal-like dialog for buy-in
                    const modalHtml = `
                        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                            <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
                                <h3>Buy In Player</h3>
                                <label for="buyin-amount">Enter buy-in amount ($):</label>
                                <input type="number" id="buyin-amount" inputmode="decimal" step="0.01" min="0" value="${session.default_buy_in_value ? session.default_buy_in_value.toFixed(2) : '20.00'}" style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
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
                    
                    // Focus and select the input for better UX
                    setTimeout(() => {
                        buyinInput.focus();
                        buyinInput.select();
                    }, 100);
                    
                    // Input validation - numbers only
                    buyinInput.addEventListener('input', (event) => {
                        let value = event.target.value;
                        value = value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        if (parts.length > 2) {
                            value = parts[0] + '.' + parts.slice(1).join('');
                        }
                        event.target.value = value;
                    });
                    
                    // Cancel handler
                    cancelBtn.addEventListener('click', () => {
                        document.body.removeChild(modalElement);
                    });
                    
                    // Confirm handler
                    confirmBtn.addEventListener('click', async () => {
                        const buyinValue = parseFloat(buyinInput.value);
                        
                        if (isNaN(buyinValue) || buyinValue <= 0 || buyinInput.value === '') {
                            alert('Please enter a valid buy-in amount');
                            return;
                        }
                        
                        try {
                            // Show loading state
                            button.disabled = true;
                            button.textContent = 'Processing...';
                            confirmBtn.disabled = true;
                            confirmBtn.textContent = 'Processing...';
                            
                            // Calculate number of buy-ins and add to session
                            const defaultBuyin = session.default_buy_in_value || 20;
                            const numBuyIns = Math.round(buyinValue / defaultBuyin);
                            
                            await this.api.post(`sessions/${sessionId}/entries/${playerId}/buy-in`, { 
                                num_buy_ins: numBuyIns 
                            });
                            
                            // Remove modal
                            document.body.removeChild(modalElement);
                            
                            // Update button appearance and buy-in amount immediately without page reload
                            this.updatePlayerDisplay(button, playerId, { addBuyIn: buyinValue, isCashedOut: false }, sessionId);
                            
                        } catch (error) {
                            console.error('Error processing buy-in:', error);
                            alert(`Error: ${error.message}`);
                            
                            // Restore button state
                            button.disabled = false;
                            button.textContent = 'Buy In';
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Buy In';
                        }
                    });
                    
                    // Enter key handler
                    buyinInput.addEventListener('keypress', (event) => {
                        if (event.key === 'Enter') {
                            confirmBtn.click();
                        }
                    });
                });
            });
            
            // 7-2 buttons
            document.querySelectorAll('.seven-two-increment-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    
                    try {
                        // Disable button to prevent double-clicks
                        button.disabled = true;
                        
                        await this.api.put(`sessions/${sessionId}/players/${playerId}/seven-two-wins/increment`);
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error incrementing session 7-2 wins:', error);
                        alert(`Error: ${error.message}`);
                        
                        // Re-enable button on error
                        button.disabled = false;
                    }
                });
            });
            
            document.querySelectorAll('.seven-two-decrement-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    
                    try {
                        // Disable button to prevent double-clicks
                        button.disabled = true;
                        
                        await this.api.put(`sessions/${sessionId}/players/${playerId}/seven-two-wins/decrement`);
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error decrementing session 7-2 wins:', error);
                        alert(`Error: ${error.message}`);
                        
                        // Re-enable button on error
                        button.disabled = false;
                    }
                });
            });
            
            // Strikes buttons
            document.querySelectorAll('.strikes-increment-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    
                    try {
                        // Disable button to prevent double-clicks
                        button.disabled = true;
                        
                        await this.api.put(`sessions/${sessionId}/players/${playerId}/strikes/increment`);
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error incrementing session strikes:', error);
                        alert(`Error: ${error.message}`);
                        
                        // Re-enable button on error
                        button.disabled = false;
                    }
                });
            });
            
            document.querySelectorAll('.strikes-decrement-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    
                    try {
                        // Disable button to prevent double-clicks
                        button.disabled = true;
                        
                        await this.api.put(`sessions/${sessionId}/players/${playerId}/strikes/decrement`);
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error decrementing session strikes:', error);
                        alert(`Error: ${error.message}`);
                        
                        // Re-enable button on error
                        button.disabled = false;
                    }
                });
            });
            
            // Set up notification functionality for active sessions
            this.setupNotificationHandlers(sessionId);
        }
        
        // Add click handlers for clickable player details (works for both active and inactive sessions)
        document.querySelectorAll('.clickable-player-details').forEach(element => {
            element.addEventListener('click', (e) => {
                // Don't navigate if clicking on a link or button
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                    return;
                }
                
                const playerId = element.dataset.playerId;
                if (playerId) {
                    // Navigate to player page
                    window.location.hash = `#player/${playerId}`;
                }
            });
            
            // Add cursor pointer style
            element.style.cursor = 'pointer';
        });
        
    }
    
    /**
     * Update player display including button and values dynamically without page reload
     */
    updatePlayerDisplay(button, playerId, updateData, sessionId) {
        // Find the player's details section
        const playerDetailsDiv = button.closest('li').querySelector('.session-player-details');
        
        if (playerDetailsDiv) {
            // Get current values from the display
            const detailsText = playerDetailsDiv.innerHTML;
            const buyInMatch = detailsText.match(/Buy-in: \$(\d+\.?\d*)/);
            const cashOutMatch = detailsText.match(/Cash-out: \$(\d+\.?\d*)/);
            
            let currentBuyIn = buyInMatch ? parseFloat(buyInMatch[1]) : 0;
            let currentCashOut = cashOutMatch ? parseFloat(cashOutMatch[1]) : 0;
            
            // Update values based on the action
            if (updateData.cashOut !== undefined) {
                currentCashOut = updateData.cashOut;
            }
            if (updateData.addBuyIn !== undefined) {
                currentBuyIn += updateData.addBuyIn;
            }
            
            // Calculate new profit
            const newProfit = currentCashOut - currentBuyIn;
            const profitClass = newProfit >= 0 ? 'profit-positive' : 'profit-negative';
            
            // Extract player name from existing content
            const nameMatch = detailsText.match(/<strong><a[^>]*>([^<]+)<\/a><\/strong>/);
            const playerName = nameMatch ? nameMatch[1] : 'Unknown Player';
            
            // Update the player details display
            playerDetailsDiv.innerHTML = `
                <p><strong><a href="#player/${playerId}">${playerName}</a></strong></p>
                <p>Buy-in: $${currentBuyIn.toFixed(2)} | 
                   Cash-out: $${currentCashOut.toFixed(2)} |
                   Profit: <span class="${profitClass}">$${newProfit.toFixed(2)}</span></p>
            `;
        }
        
        // Update button state
        const isCashedOut = updateData.isCashedOut;
        
        if (isCashedOut) {
            // Change to Buy In button
            button.className = 'buy-in-player-btn';
            button.textContent = 'Buy In';
            button.dataset.isCashedOut = 'true';
        } else {
            // Change to Cash Out button
            button.className = 'cash-out-player-btn';
            button.textContent = 'Cash Out';
            button.dataset.isCashedOut = 'false';
        }
        
        // Re-enable the button
        button.disabled = false;
        
        // Update event listeners by replacing the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add the appropriate event listener based on current state
        if (isCashedOut) {
            this.addBuyInListener(newButton, playerId, sessionId);
        } else {
            this.addCashOutListener(newButton, playerId, sessionId);
        }
    }
    
    /**
     * Add full cash-out event listener to a button
     */
    addCashOutListener(button, playerId, sessionId) {
        const session = { default_buy_in_value: 20.00 }; // We'll need to pass this properly
        
        button.addEventListener('click', async (e) => {
            // Create a custom modal-like dialog for cash-out amount
            const modalHtml = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
                        <h3>Cash Out Player</h3>
                        <label for="cashout-amount-dynamic">Enter cash-out amount ($):</label>
                        <input type="number" id="cashout-amount-dynamic" inputmode="decimal" step="0.01" min="0" style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
                        <div style="text-align: right; margin-top: 15px;">
                            <button id="cancel-cashout-dynamic" style="margin-right: 10px; padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                            <button id="confirm-cashout-dynamic" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Cash Out</button>
                        </div>
                    </div>
                </div>
            `;
            
            const modalElement = document.createElement('div');
            modalElement.innerHTML = modalHtml;
            document.body.appendChild(modalElement);
            
            const cashoutInput = document.getElementById('cashout-amount-dynamic');
            const cancelBtn = document.getElementById('cancel-cashout-dynamic');
            const confirmBtn = document.getElementById('confirm-cashout-dynamic');
            
            setTimeout(() => cashoutInput.focus(), 100);
            
            // Input validation
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
                    
                    await this.api.put(`sessions/${sessionId}/entries/${playerId}/payout`, { 
                        payout_amount: cashOutValue 
                    });
                    
                    document.body.removeChild(modalElement);
                    this.updatePlayerDisplay(button, playerId, { cashOut: cashOutValue, isCashedOut: true }, sessionId);
                    
                } catch (error) {
                    console.error('Error processing cash-out:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                    button.textContent = 'Cash Out';
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Cash Out';
                }
            });
            
            cashoutInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    confirmBtn.click();
                }
            });
        });
    }
    
    /**
     * Add full buy-in event listener to a button
     */
    addBuyInListener(button, playerId, sessionId) {
        const session = { default_buy_in_value: 20.00 }; // We'll need to pass this properly
        
        button.addEventListener('click', async (e) => {
            // Create a custom modal-like dialog for buy-in
            const modalHtml = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
                        <h3>Buy In Player</h3>
                        <label for="buyin-amount-dynamic">Enter buy-in amount ($):</label>
                        <input type="number" id="buyin-amount-dynamic" inputmode="decimal" step="0.01" min="0" value="${session.default_buy_in_value.toFixed(2)}" style="width: 100%; padding: 10px; margin: 10px 0; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
                        <div style="text-align: right; margin-top: 15px;">
                            <button id="cancel-buyin-dynamic" style="margin-right: 10px; padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                            <button id="confirm-buyin-dynamic" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Buy In</button>
                        </div>
                    </div>
                </div>
            `;
            
            const modalElement = document.createElement('div');
            modalElement.innerHTML = modalHtml;
            document.body.appendChild(modalElement);
            
            const buyinInput = document.getElementById('buyin-amount-dynamic');
            const cancelBtn = document.getElementById('cancel-buyin-dynamic');
            const confirmBtn = document.getElementById('confirm-buyin-dynamic');
            
            setTimeout(() => {
                buyinInput.focus();
                buyinInput.select();
            }, 100);
            
            // Input validation
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
                    
                    const defaultBuyin = session.default_buy_in_value || 20;
                    const numBuyIns = Math.round(buyinValue / defaultBuyin);
                    
                    await this.api.post(`sessions/${sessionId}/entries/${playerId}/buy-in`, { 
                        num_buy_ins: numBuyIns 
                    });
                    
                    document.body.removeChild(modalElement);
                    this.updatePlayerDisplay(button, playerId, { addBuyIn: buyinValue, isCashedOut: false }, sessionId);
                    
                } catch (error) {
                    console.error('Error processing buy-in:', error);
                    alert(`Error: ${error.message}`);
                    button.disabled = false;
                    button.textContent = 'Buy In';
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Buy In';
                }
            });
            
            buyinInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    confirmBtn.click();
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
                this.updateNotificationButton(newButton, 'loading', 'Loading...');

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
}