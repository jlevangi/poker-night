// Session detail page module
import ApiService from './api-service.js';

export default class SessionDetailPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
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
                    sevenTwoWins: entry.session_seven_two_wins || 0
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
        console.log("renderChipDistribution called with:", session);
        
        // Check if session and chip_distribution exist
        if (!session || !session.session_info || !session.session_info.chip_distribution) {
            console.error("No chip distribution found in session data:", session);
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
                
                // Define border styles based on chip color
                let borderStyle;
                if (chipColor === 'White') {
                    borderStyle = '3px dashed #000000'; // Black dashed border for white chips
                } else if (['Black', 'Blue', 'Green'].includes(chipColor)) {
                    borderStyle = '3px dashed rgba(255, 255, 255, 0.7)'; // White dashed border for dark chips
                } else {
                    borderStyle = '3px dashed rgba(255, 255, 255, 0.5)'; // Lighter white dashed for red chips
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
            <a href="#sessions" class="back-nav-btn">Back to Sessions</a>
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
            
            <!-- Only show Reactivate button if session is not active -->
            ${!isActive ? 
                `<div class="session-reactivate-container" style="text-align: center; margin: 20px 0;">
                    <button id="reactivate-session-btn" class="action-btn reactivate-session-btn">
                        Reactivate Session
                    </button>
                </div>` : 
                '' // Nothing if active
            }

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
                    <select id="add-player-select">
                        <option value="">-- Select Player --</option>
                        ${(session.availablePlayers || []).map(player => 
                            `<option value="${player.player_id}">${player.name}</option>`
                        ).join('')}
                    </select>
                    <input type="number" id="player-buyin" placeholder="Buy-in Amount ($)" value="${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00'}" step="0.01">
                    <button id="add-player-to-session-btn" class="action-btn">Add Player</button>
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
                        <div class="session-player-details">
                            <p><strong><a href="#player/${player.id}">${player.name}</a></strong></p>
                            <p>Buy-in: $${buyIn.toFixed(2)} | 
                               Cash-out: $${cashOut.toFixed(2)} |
                               Profit: <span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</span></p>
                        </div>
                        
                        <div class="session-player-actions">
                            ${isActive ?
                                `<button class="cash-out-player-btn action-btn success-btn" data-player-id="${player.id}">Cash Out</button>` :
                                ''
                            }
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
                background-color: #4CAF50 !important;
                color: white !important;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .cash-out-player-btn:hover {
                background-color: #45a049 !important;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                transform: translateY(-1px);
            }
            
            /* Generic success button style */
            .success-btn {
                background-color: #4CAF50;
                color: white;
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
            
            // Cash out player buttons (formerly Update buttons)
            document.querySelectorAll('.cash-out-player-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    const cashOut = prompt('Enter cash-out amount ($):');
                    
                    if (cashOut === null) return; // User cancelled
                    
                    const cashOutValue = parseFloat(cashOut);
                    
                    if (isNaN(cashOutValue) || cashOutValue < 0) {
                        alert('Please enter a valid cash-out amount');
                        return;
                    }
                    
                    try {
                        // Show loading state
                        button.disabled = true;
                        button.textContent = 'Processing...';
                        
                        await this.api.put(`sessions/${sessionId}/entries/${playerId}/payout`, { 
                            payout_amount: cashOutValue 
                        });
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error updating player:', error);
                        alert(`Error: ${error.message}`);
                        
                        // Restore button state
                        button.disabled = false;
                        button.textContent = 'Cash Out';
                    }
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
        } else {
            // Reactivate session button - only set up if session is not active
            const reactivateSessionBtn = document.getElementById('reactivate-session-btn');
            if (reactivateSessionBtn) {
                reactivateSessionBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to reactivate this session?")) {
                        try {
                            // Show loading state
                            reactivateSessionBtn.disabled = true;
                            reactivateSessionBtn.textContent = 'Reactivating...';
                            
                            await this.api.put(`sessions/${sessionId}/reactivate`);
                            
                            alert("Session reactivated successfully!");
                            this.load(sessionId);
                        } catch (error) {
                            console.error('Error reactivating session:', error);
                            alert(`Error: ${error.message}`);
                            
                            // Restore button state
                            reactivateSessionBtn.disabled = false;
                            reactivateSessionBtn.textContent = 'Reactivate Session';
                        }
                    }
                });
            }
        }
    }
}