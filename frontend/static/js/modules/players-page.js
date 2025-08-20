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
            <div class="fade-in">
                <h2>Players</h2>
                
                <div class="add-player-form">
                    <h3>Add New Player</h3>
                    <input type="text" id="new-player-name" placeholder="Player Name">
                    <button id="add-player-btn" class="action-btn">Add Player</button>
                </div>
                
                <h3>Player List</h3>
        `;
        
        if (players && players.length > 0) {
            html += `
                <div class="players-list-container">
                    <ul class="players-list enhanced">
            `;
            
            players.forEach(player => {
                html += `
                    <li>
                        <div class="player-row">
                            <div class="player-name">
                                <a href="#player/${player.player_id}" class="player-name-link">${player.name}</a>
                            </div>
                            <div class="player-stats-container">
                                <div class="player-quick-stats">
                                    <span class="stat">
                                        Profit: <span class="${player.net_profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                                            $${player.net_profit ? player.net_profit.toFixed(2) : '0.00'}
                                        </span>
                                    </span>
                                    <span class="stat">
                                        Sessions: ${player.games_played || 0}
                                    </span>
                                </div>
                                <div class="seven-two-counter">
                                    <span class="seven-two-label">7-2 Wins:</span>
                                    <span class="seven-two-value">${player.seven_two_wins || 0}</span>
                                </div>
                            </div>
                        </div>
                    </li>
                `;
            });
            
            html += `
                    </ul>
                </div>
            `;
        } else {
            html += `<p>No players found. Add your first player above!</p>`;
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
    }
}
