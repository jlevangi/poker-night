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
            return `<div class="neo-card" style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">🎰 Chip Distribution</h3>
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
                <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--casino-purple-dark);">🎰 Chip Distribution</h3>
                <p style="font-weight: 600; color: var(--casino-purple-dark); margin-bottom: 1.5rem;">
                    For a buy-in of <span style="color: var(--casino-green); font-weight: 800;">$${buyInValue.toFixed(2)}</span>, 
                    use the following chip distribution (<span style="color: var(--casino-gold); font-weight: 800;">${totalChips} total chips</span>):
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
                        font-weight: 800;
                        text-align: center;
                        box-shadow: var(--neo-shadow-md);
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="font-size: 1rem; line-height: 1;">${chipDistribution[chipColor]}</div>
                        <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">${chipColor}</div>
                        
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
        
        console.log("Session active calculation:",
            "is_active =", sessionData.is_active,
            "status =", sessionData.status,
            "final isActive =", isActive);
        
        let html = `
            <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <!-- Header with navigation and notification controls -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                    <a href="#sessions" class="neo-btn neo-btn-purple">← Back to Sessions</a>
                    ${isActive ? 
                        `<button id="notification-btn" class="neo-btn neo-btn-gold" data-state="loading">
                            <span class="btn-text">🔔 Loading...</span>
                        </button>` : 
                        ''
                    }
                </div>
                
                <!-- Session Info Card -->
                <div class="neo-card ${isActive ? 'neo-card-gold' : 'neo-card-primary'}">
                    <h2 style="font-size: 2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary);">
                        🎯 ${this.formatDate(sessionData.date)}
                    </h2>
                    
                    <div class="neo-stats-grid" style="margin-bottom: 1.5rem;">
                        <!-- Status Card - First Position -->
                        <div class="neo-stat-card" style="border-color: ${isActive ? 'var(--casino-gold)' : 'var(--casino-green)'};">
                            <div class="neo-stat-value ${isActive ? 'profit-negative' : 'profit-positive'}">
                                ${isActive ? 'ACTIVE' : 'ENDED'}
                            </div>
                            <div class="neo-stat-label"></div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-green);">
                            <div class="neo-stat-value">$${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '0.00'}</div>
                            <div class="neo-stat-label">Default Buy-in</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-purple);">
                            <div class="neo-stat-value">$${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</div>
                            <div class="neo-stat-label">Total Value</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: ${session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'var(--casino-red)' : 'var(--casino-green)'};">
                            <div class="neo-stat-value ${session.unpaidValue > 0.01 || session.unpaidValue < -0.01 ? 'profit-negative' : 'profit-positive'}">
                                ${session.unpaidValue > 0.01 ?
                                    `$${session.unpaidValue.toFixed(2)}` :
                                    session.unpaidValue < -0.01 ?
                                    `-$${Math.abs(session.unpaidValue).toFixed(2)}` :
                                    (!isActive ? 'PAID OUT' : '$0.00')}
                            </div>
                            <div class="neo-stat-label">${session.unpaidValue > 0.01 ? 'Unpaid Amount' : session.unpaidValue < -0.01 ? 'House Loss' : 'Payout Status'}</div>
                        </div>
                    </div>
                </div>

                <!-- Words of Wisdom Section -->
                ${sessionData.wisdom_quote ? `
                <div class="neo-card neo-card-gold" style="margin-top: 2rem; text-align: center;">
                    <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--casino-gold-dark);">💬 Words of Wisdom</h3>
                    <p style="font-size: 1.25rem; font-style: italic; color: var(--text-primary); margin-bottom: 0.5rem;">
                        "${sessionData.wisdom_quote}"
                    </p>
                    <p style="font-size: 1rem; font-weight: 700; color: var(--text-secondary);">
                        — ${session.players?.find(p => p.id === sessionData.wisdom_player_id)?.name || 'Unknown'}
                    </p>
                </div>
                ` : ''}

                ${isActive ? `
                <!-- Words of Wisdom Input -->
                <div class="neo-card" style="margin-top: 2rem;">
                    <h4 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; color: var(--text-primary);">💬 ${sessionData.wisdom_quote ? 'Edit' : 'Add'} Words of Wisdom</h4>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <textarea id="wisdom-quote-input" placeholder="Enter the quote..." style="padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card); min-height: 80px; resize: vertical;">${sessionData.wisdom_quote || ''}</textarea>
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <select id="wisdom-player-select" style="flex: 1; min-width: 200px; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                                <option value="">-- Who said it? --</option>
                                ${(session.players || []).map(player =>
                                    `<option value="${player.id}" ${player.id === sessionData.wisdom_player_id ? 'selected' : ''}>${player.name}</option>`
                                ).join('')}
                            </select>
                            <button id="save-wisdom-btn" class="neo-btn neo-btn-gold">Save Quote</button>
                        </div>
                    </div>
                </div>
                ` : ''}

                <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 2rem 0 1.5rem 0; color: var(--text-primary);">🎭 Players</h3>
        `;
        
        if (isActive) {
            // Log available players to debug
            console.log("Available players for dropdown:", session.availablePlayers);
            
            html += `
                <div class="neo-card neo-card-green" style="margin-bottom: 2rem;">
                    <h4 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--casino-green-dark);">➕ Add Player to Session</h4>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                        <select id="add-player-select" style="flex: 1; min-width: 200px; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                            <option value="">-- Select Player --</option>
                            ${(session.availablePlayers || []).map(player => 
                                `<option value="${player.player_id}">${player.name}</option>`
                            ).join('')}
                        </select>
                        <input type="number" id="player-buyin" placeholder="Buy-in Amount ($)" value="${sessionData.default_buy_in_value ? sessionData.default_buy_in_value.toFixed(2) : '20.00'}" step="0.01" style="flex: 1; min-width: 150px; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                        <button id="add-player-to-session-btn" class="neo-btn neo-btn-green">Add Player</button>
                    </div>
                </div>
            `;
        }
        
        // Render players list
        if (session.players && session.players.length > 0) {
            html += `<div style="display: grid;">`;
            session.players.forEach(player => {
                // Ensure buyIn and cashOut are defined before calculating profit
                const buyIn = player.buyIn || 0;
                const cashOut = player.cashOut || 0;
                const profit = cashOut - buyIn;
                const profitColor = profit >= 0 ? 'neo-card-green' : 'neo-card-primary';
                
                html += `
                    <div class="neo-card ${profitColor} clickable-player-details" data-player-id="${player.id}" style="cursor: pointer; transition: all var(--transition-neo);" onmouseover="this.style.transform='translate(-2px, -2px)'; this.style.boxShadow='var(--neo-shadow-lg)'" onmouseout="this.style.transform='translate(0, 0)'; this.style.boxShadow='var(--neo-shadow-md)'">
                        <!-- Player Header -->
                        <div style="margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                                <h4 style="font-size: 1.5rem; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">
                                    <a href="#player/${player.id}" style="color: inherit; text-decoration: none;">${player.name}</a>
                                    ${player.id === sessionData.wisdom_player_id ? ' 🗣️' : ''}
                                </h4>
                            </div>
                            
                            <!-- Buy-in, Cash-out, Profit Stats -->
                            <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem;">
                                <div>
                                    <span style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; display: block;">Buy-in</span>
                                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--casino-red);">$${buyIn.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; display: block;">Cash-out</span>
                                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--casino-gold);">$${cashOut.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; display: block;">Profit</span>
                                    <span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size: 1.25rem; font-weight: 800;">$${profit.toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <!-- Action Button - Full Width and Responsive -->
                            ${isActive ? `
                                <div style="margin-bottom: 1rem;">
                                    ${player.isCashedOut ? 
                                        `<button class="neo-btn neo-btn-green buy-in-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}" style="width: 100%; padding: 0.875rem 1rem;">💰 Buy In</button>` :
                                        `<button class="neo-btn neo-btn-gold cash-out-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}" style="width: 100%; padding: 0.875rem 1rem;">💸 Cash Out</button>`
                                    }
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Stats and Controls - Equal Width Grid -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: center;">
                            <!-- 7-2 Wins -->
                            <div class="neo-stat-card" style="border-color: var(--casino-gold); margin: 0;">
                                <div style="font-size: 1.25rem; font-weight: 800; color: var(--casino-gold-dark); margin-bottom: 0.25rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                    ${isActive ? `
                                        <button class="neo-btn neo-btn-sm seven-two-decrement-btn" data-player-id="${player.id}" style="
                                            width: 28px; 
                                            height: 28px; 
                                            padding: 0; 
                                            font-size: 16px; 
                                            font-weight: 800;
                                            display: flex; 
                                            align-items: center; 
                                            justify-content: center;
                                            border: var(--neo-border);
                                            border-radius: 0;
                                            background: var(--casino-red);
                                            color: var(--text-white);
                                            box-shadow: var(--neo-shadow-sm);
                                        ">−</button>
                                    ` : ''}
                                    <span style="min-width: 2rem; text-align: center;">${player.sevenTwoWins || 0}</span>
                                    ${isActive ? `
                                        <button class="neo-btn neo-btn-sm seven-two-increment-btn" data-player-id="${player.id}" style="
                                            width: 28px; 
                                            height: 28px; 
                                            padding: 0; 
                                            font-size: 16px; 
                                            font-weight: 800;
                                            display: flex; 
                                            align-items: center; 
                                            justify-content: center;
                                            border: var(--neo-border);
                                            border-radius: 0;
                                            background: var(--casino-gold);
                                            color: var(--text-white);
                                            box-shadow: var(--neo-shadow-sm);
                                        ">+</button>
                                    ` : ''}
                                </div>
                                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--casino-gold-dark);">
                                    7-2 Wins
                                </div>
                            </div>
                            
                            <!-- Strikes -->
                            <div class="neo-stat-card" style="border-color: var(--casino-red); margin: 0;">
                                <div style="font-size: 1.25rem; font-weight: 800; color: var(--casino-red); margin-bottom: 0.25rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                    ${isActive ? `
                                        <button class="neo-btn neo-btn-sm strikes-decrement-btn" data-player-id="${player.id}" style="
                                            width: 28px; 
                                            height: 28px; 
                                            padding: 0; 
                                            font-size: 16px; 
                                            font-weight: 800;
                                            display: flex; 
                                            align-items: center; 
                                            justify-content: center;
                                            border: var(--neo-border);
                                            border-radius: 0;
                                            background: var(--casino-gold);
                                            color: var(--text-white);
                                            box-shadow: var(--neo-shadow-sm);
                                        ">−</button>
                                    ` : ''}
                                    <span style="min-width: 2rem; text-align: center;">${player.strikes || 0}</span>
                                    ${isActive ? `
                                        <button class="neo-btn neo-btn-sm strikes-increment-btn" data-player-id="${player.id}" style="
                                            width: 28px; 
                                            height: 28px; 
                                            padding: 0; 
                                            font-size: 16px; 
                                            font-weight: 800;
                                            display: flex; 
                                            align-items: center; 
                                            justify-content: center;
                                            border: var(--neo-border);
                                            border-radius: 0;
                                            background: var(--casino-red);
                                            color: var(--text-white);
                                            box-shadow: var(--neo-shadow-sm);
                                        ">+</button>
                                    ` : ''}
                                </div>
                                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--casino-red);">
                                    Strikes
                                </div>
                            </div>
                        </div>
                    </div>
                `;
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
        
        // Add chip distribution section after players
        html += `
                <!-- Chip Distribution Section -->
                <div id="chip-distribution-container">
                ${this.renderChipDistribution(session)}
                </div>
        `;
        
        // Add session control buttons at the bottom
        html += `
                <!-- Session Controls -->
                <div style="margin-top: 2rem; text-align: center;">
                    ${isActive ? 
                        `<button id="end-session-btn" class="neo-btn neo-btn-red neo-btn-lg">
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

                            // Reload the session detail page to show updated values
                            this.load(sessionId);

                        } catch (error) {
                            console.error('Error processing cash-out:', error);
                            alert(`Error: ${error.message}`);

                            // Remove modal and restore button state
                            document.body.removeChild(modalElement);
                            button.disabled = false;
                            button.textContent = 'Cash Out';
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

                            // Reload the session detail page to show updated values
                            this.load(sessionId);

                        } catch (error) {
                            console.error('Error processing buy-in:', error);
                            alert(`Error: ${error.message}`);

                            // Remove modal and restore button state
                            document.body.removeChild(modalElement);
                            button.disabled = false;
                            button.textContent = 'Buy In';
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
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
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
                            font-weight: 900;
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