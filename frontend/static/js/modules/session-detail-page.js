// Session detail page module
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
                
                html += `
                    <div class="chip" style="background-color: ${backgroundColor}; color: ${textColor}; border: ${chipColor === 'White' ? '2px solid #ccc' : '3px dashed rgba(255, 255, 255, 0.3)'}">
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
        
        const isActive = !(sessionData.is_active === false || sessionData.status === 'ENDED');
        
        console.log("Session active calculation:",
            "is_active =", sessionData.is_active,
            "status =", sessionData.status,
            "final isActive =", isActive);
        
        let html = `
            <h2>Session Details</h2>
            <p><strong>Date:</strong> ${this.formatDate(sessionData.date)}</p>
            <p><strong>Default Buy-in:</strong> $${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '0.00'}</p>
            <p><strong>Status:</strong> <span class="session-status status-${isActive ? 'active' : 'ended'}">${isActive ? 'ACTIVE' : 'ENDED'}</span></p>
              <div class="session-value-summary">
                <p class="session-total-value">Total Value: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</p>
                ${session.unpaidValue && session.unpaidValue > 0 ? 
                    `<p class="session-unpaid-value">Unpaid Amount: $${session.unpaidValue.toFixed(2)}</p>` : 
                    (!isActive ? `<p class="session-unpaid-value paid-out">Fully Paid Out</p>` : '')}
            </div>
            
            <div class="session-action-buttons">
                <!-- Always show End/Reactivate button based on session state -->
                ${isActive ? 
                    `<button id="end-session-btn" class="action-btn danger-btn">End Session</button>` : 
                    `<button id="reactivate-session-btn" class="action-btn reactivate-session-btn">
                        Reactivate Session
                     </button>`
                }
                <!-- Always show Delete button regardless of session state -->
                <button id="delete-session-btn" class="action-btn danger-btn" style="margin-left: 10px; background-color: #f44336; color: white;">
                    Delete Session
                </button>
            </div>

            <!-- Chip Distribution Section -->
            <div id="chip-distribution-container">
            ${this.renderChipDistribution(session)}
            </div>
            
            <h3>Players</h3>
        `;
        
        if (isActive) {
            html += `
                <div class="add-player-form">
                    <select id="add-player-select">
                        <option value="">-- Select Player --</option>                        ${(session.availablePlayers || []).map(player => 
                            `<option value="${player.id}">${player.name}</option>`
                        ).join('')}
                    </select>
                    <input type="number" id="player-buyin" placeholder="Buy-in Amount ($)" value="${session.buyin ? session.buyin.toFixed(2) : '0.00'}" step="0.01">
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
                                `<button class="update-player-btn action-btn" data-player-id="${player.id}">Update</button>` :
                                ''
                            }
                        </div>
                        
                        <div class="session-seven-two-controls">
                            <div class="seven-two-label">7-2 Wins:</div>
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
        
        html += `<p><a href="#sessions">&laquo; Back to Sessions</a></p>`;
        
        // Log the HTML about to be rendered
        console.log("Full HTML being set:", html);
        
        this.appContent.innerHTML = html;
        
        // Enhanced button debugging
        setTimeout(() => {
            // Simple check to verify buttons are rendered
            console.log("Button check after render:");
            console.log("- Delete button exists:", !!document.getElementById('delete-session-btn'));
            console.log("- Reactivate button exists:", !!document.getElementById('reactivate-session-btn'));
            console.log("- End button exists:", !!document.getElementById('end-session-btn'));
        }, 100); // Small timeout to ensure DOM is ready
        
        console.log("Before setting up event listeners, isActive:", isActive);
        // Add event listeners
        this.setupEventListeners(sessionData, sessionId, isActive);
    }
    
    // Setup event listeners for the page
    setupEventListeners(session, sessionId, isActive) {
        console.log("Setting up event listeners, isActive:", isActive);
        
        // DEBUG: Find buttons manually
        const deleteBtn = document.getElementById('delete-session-btn');
        const reactivateBtn = document.getElementById('reactivate-session-btn');
        const endBtn = document.getElementById('end-session-btn');
        
        console.log("Manual button check:");
        console.log("- Delete button:", deleteBtn);
        console.log("- Reactivate button:", reactivateBtn);
        console.log("- End button:", endBtn);
        
        // Set up the Delete button event listener regardless of session state
        if (deleteBtn) {
            console.log("Setting up event listener for delete button");
            deleteBtn.addEventListener('click', async () => {
                console.log("Delete button clicked");
                // Strong confirmation to prevent accidental deletion
                if (confirm("Are you sure you want to delete this session? This action cannot be undone, although data will be archived.")) {
                    // Double confirmation with session date for clarity
                    const sessionDate = session.date || 'unknown date';
                    if (confirm(`FINAL WARNING: This will permanently remove the session from ${sessionDate} from view. The data will be archived but no longer visible in the app. Continue?`)) {
                        try {
                            // Show loading state
                            deleteBtn.disabled = true;
                            deleteBtn.textContent = 'Deleting...';
                            
                            console.log(`Calling delete API for session ${sessionId}`);
                            await this.api.delete(`sessions/${sessionId}/delete`);
                            
                            // Success message with session date
                            alert(`Session from ${sessionDate} deleted successfully and data archived!`);
                            // Navigate back to the sessions list
                            window.location.hash = '#sessions';
                        } catch (error) {
                            console.error('Error deleting session:', error);
                            alert(`Error: ${error.message}`);
                            // Restore button state
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = 'Delete Session';
                        }
                    }
                }
            });
        } else {
            console.error("Delete session button not found!");
        }
        
        if (isActive) {
            // End session button
            const endSessionBtn = document.getElementById('end-session-btn');
            if (endSessionBtn) {
                console.log("Found end session button");
                endSessionBtn.addEventListener('click', async () => {
                    if (confirm("Are you sure you want to end this session? This will finalize profits.")) {
                        try {
                            await this.api.put(`sessions/${sessionId}/end`);
                            
                            alert("Session ended successfully!");
                            this.load(sessionId);
                        } catch (error) {
                            console.error('Error ending session:', error);
                            alert(`Error: ${error.message}`);
                        }
                    }
                });
            }
            
            // Add player to session button
            const addPlayerBtn = document.getElementById('add-player-to-session-btn');
            const playerSelect = document.getElementById('add-player-select');
            const buyinInput = document.getElementById('player-buyin');
            
            if (addPlayerBtn && playerSelect && buyinInput) {                addPlayerBtn.addEventListener('click', async () => {
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
                    const defaultBuyin = session.session_info?.buyin || 20;
                    const numBuyIns = Math.round(buyin / defaultBuyin);
                    
                    if (numBuyIns <= 0) {
                        alert('Buy-in amount must result in at least one buy-in');
                        return;
                    }
                      try {                        await this.api.post(`sessions/${sessionId}/entries`, { player_id: playerId, num_buy_ins: numBuyIns });
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error adding player to session:', error);
                        alert(`Error: ${error.message}`);
                    }
                });
            }
            
            // Update player buttons
            document.querySelectorAll('.update-player-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                    const cashOut = prompt('Enter cash-out amount ($):');
                    
                    if (cashOut === null) return; // User cancelled
                    
                    const cashOutValue = parseFloat(cashOut);
                    
                    if (isNaN(cashOutValue) || cashOutValue < 0) {
                        alert('Please enter a valid cash-out amount');
                        return;
                    }
                      try {                        await this.api.put(`sessions/${sessionId}/entries/${playerId}/payout`, { payout_amount: cashOutValue });
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error updating player:', error);
                        alert(`Error: ${error.message}`);
                    }
                });
            });
            
            // 7-2 buttons
            document.querySelectorAll('.seven-two-increment-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                      try {
                        await this.api.put(`players/${playerId}/seven-two-wins/increment`);
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error incrementing 7-2 wins:', error);
                        alert(`Error: ${error.message}`);
                    }
                });
            });
            
            document.querySelectorAll('.seven-two-decrement-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const playerId = e.target.dataset.playerId;
                      try {
                        await this.api.put(`players/${playerId}/seven-two-wins/decrement`);
                        
                        // Reload the session detail page
                        this.load(sessionId);
                    } catch (error) {
                        console.error('Error decrementing 7-2 wins:', error);
                        alert(`Error: ${error.message}`);
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
                            await this.api.put(`sessions/${sessionId}/reactivate`);
                            
                            alert("Session reactivated successfully!");
                            this.load(sessionId);
                        } catch (error) {
                            console.error('Error reactivating session:', error);
                            alert(`Error: ${error.message}`);
                        }
                    }
                });
            }
        }
    }
}
