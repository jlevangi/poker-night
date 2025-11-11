// Players page module
export default class PlayersPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }
    
    // Load the players page
    async load() {
        try {
            // Fetch players data using API service
            const data = await this.api.get('players');
            
            // Render the players page
            this.render(data);
        } catch (error) {
            console.error('Error loading players:', error);
            this.appContent.innerHTML = `<p>Error loading players: ${error.message}</p>`;
        }
    }
    
    // Render players content
    render(players) {
        let html = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-purple);">🎭 Players</h2>
                
                <div class="neo-card neo-card-purple" style="margin-bottom: 2rem;">
                    <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--casino-purple-dark);">➕ Add New Player</h3>
                    <div style="display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap;">
                        <input type="text" id="new-player-name" placeholder="Enter player name..." style="flex: 1; min-width: 200px; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                        <button id="add-player-btn" class="neo-btn neo-btn-purple neo-btn-lg">Add Player</button>
                    </div>
                </div>
                
                <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary);">🏆 Player Roster</h3>
        `;
        
        if (players && players.length > 0) {
            html += `
                <div style="display: grid; gap: 1.5rem;">
            `;
            
            players.forEach((player, index) => {
                const isGambleKing = index === 0 && player.net_profit > 0;
                const cardColor = isGambleKing ? 'neo-card-gold' : 
                                 player.net_profit >= 50 ? 'neo-card-green' :
                                 player.net_profit < 0 ? 'neo-card-primary' : '';
                
                html += `
                    <div class="neo-card ${cardColor} clickable-player-stats" data-player-id="${player.player_id}" style="cursor: pointer; transition: all var(--transition-neo);" onmouseover="this.style.transform='translate(-3px, -3px)'; this.style.boxShadow='var(--neo-shadow-lg)'" onmouseout="this.style.transform='translate(0, 0)'; this.style.boxShadow='var(--neo-shadow-md)'">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                            <div>
                                <h4 style="font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                                    <a href="#player/${player.player_id}" style="color: inherit; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em;">${player.name}</a>
                                    ${isGambleKing ? '<span style="font-size: 1.5rem; animation: bounce 2s infinite;">👑</span>' : ''}
                                </h4>
                                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                                    <div>
                                        <span style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; display: block;">Net Profit</span>
                                        <div class="${player.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-size: 1.25rem; font-weight: 800;">
                                            $${player.net_profit ? player.net_profit.toFixed(2) : '0.00'}
                                        </div>
                                    </div>
                                    <div>
                                        <span style="font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; display: block;">Sessions</span>
                                        <div style="font-size: 1.25rem; font-weight: 800; color: inherit;">
                                            ${player.games_played || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="neo-stat-card" style="min-width: 120px; text-align: center; margin: 0; border-color: var(--casino-gold);">
                                <div style="font-size: 1.5rem; font-weight: 900; color: var(--casino-gold-dark); margin-bottom: 0.25rem;">
                                    ${player.seven_two_wins || 0}
                                </div>
                                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--casino-gold-dark);">
                                    7-2 Wins
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                </div>
            `;
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🎲</div>
                    <p style="font-size: 1.25rem; font-weight: 700; opacity: 0.8; margin: 0;">No players found. Add your first player above!</p>
                </div>
            `;
        }
        
        html += `
            </div>
        `;
        
        this.appContent.innerHTML = html;
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    // Setup event listeners for the page
    setupEventListeners() {
        const addPlayerBtn = document.getElementById('add-player-btn');
        const newPlayerNameInput = document.getElementById('new-player-name');
        
        if (addPlayerBtn && newPlayerNameInput) {
            addPlayerBtn.addEventListener('click', async () => {
                const playerName = newPlayerNameInput.value.trim();
                
                if (!playerName) {
                    alert('Please enter a player name');
                    return;
                }
                
                try {
                    const response = await fetch('/api/players', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: playerName })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to add player');
                    }
                    
                    // Reload the players list
                    this.load();
                    
                    // Clear the input field
                    newPlayerNameInput.value = '';
                } catch (error) {
                    console.error('Error adding player:', error);
                    alert(`Error: ${error.message}`);
                }
            });
        }

        // Add click handlers for player stats containers
        document.querySelectorAll('.clickable-player-stats').forEach(element => {
            element.addEventListener('click', (e) => {
                // Don't navigate if clicking on a link
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    return;
                }
                
                const playerId = element.dataset.playerId;
                if (playerId) {
                    // Navigate to player detail page
                    window.location.hash = `#player/${playerId}`;
                }
            });
            
            // Add cursor pointer style
            element.style.cursor = 'pointer';
        });
    }
}
