// Players page module
export default class PlayersPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.players = [];
        this.filteredPlayers = [];
        this.searchQuery = '';
        this.sortBy = 'rank'; // 'rank', 'name', or 'sessions'
    }
    
    // Load the players page
    async load() {
        try {
            // Fetch players data using API service
            const data = await this.api.get('players');
            this.players = data || [];
            this.applyFiltersAndSort();

            // Render the players page
            this.render();
        } catch (error) {
            console.error('Error loading players:', error);
            this.appContent.innerHTML = `<p>Error loading players: ${error.message}</p>`;
        }
    }

    // Apply search filter and sorting
    applyFiltersAndSort() {
        // Filter by search query
        if (this.searchQuery.length >= 2) {
            this.filteredPlayers = this.players.filter(player =>
                player.name.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        } else {
            this.filteredPlayers = [...this.players];
        }

        // Sort players
        if (this.sortBy === 'name') {
            this.filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
        } else if (this.sortBy === 'sessions') {
            this.filteredPlayers.sort((a, b) => (b.games_played || 0) - (a.games_played || 0));
        } else {
            // Sort by rank (net_profit descending)
            this.filteredPlayers.sort((a, b) => (b.net_profit || 0) - (a.net_profit || 0));
        }
    }

    // Get search suggestions
    getSearchSuggestions(query) {
        if (query.length < 2) return [];
        const lowerQuery = query.toLowerCase();
        return this.players
            .filter(player => player.name.toLowerCase().includes(lowerQuery))
            .map(player => player.name)
            .slice(0, 5);
    }
    
    // Render players content
    render() {
        let html = `
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-purple);">🎭 Players</h2>

                <div class="neo-card neo-card-purple" style="margin-bottom: 2rem; padding-top: 1rem;">
                    <h3 style="font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; margin-top: 0; color: var(--casino-purple-dark);">➕ Add New Player</h3>
                    <div style="display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap;">
                        <input type="text" id="new-player-name" placeholder="Enter player name..." style="flex: 1; min-width: 200px; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                        <button id="add-player-btn" class="neo-btn neo-btn-purple neo-btn-lg">Add Player</button>
                    </div>
                </div>

                <div class="neo-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px; position: relative;">
                            <input type="text" id="player-search" placeholder="Search players..." value="${this.searchQuery}" style="width: 100%; padding: 0.875rem 1rem; border: var(--neo-border); font-size: 1rem; font-weight: 600; background: var(--bg-card);">
                            <div id="search-suggestions" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: var(--neo-border); border-top: none; display: none; z-index: 100; max-height: 200px; overflow-y: auto;"></div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <span style="font-weight: 700; text-transform: uppercase; font-size: 0.875rem; letter-spacing: 0.05em;">Sort:</span>
                            <button id="sort-rank" class="neo-btn ${this.sortBy === 'rank' ? 'neo-btn-primary' : ''}" style="padding: 0.5rem 1rem;">Rank</button>
                            <button id="sort-name" class="neo-btn ${this.sortBy === 'name' ? 'neo-btn-primary' : ''}" style="padding: 0.5rem 1rem;">Name</button>
                            <button id="sort-sessions" class="neo-btn ${this.sortBy === 'sessions' ? 'neo-btn-primary' : ''}" style="padding: 0.5rem 1rem;">Sessions</button>
                        </div>
                    </div>
                </div>

                <h3 id="roster-title" style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary);">🏆 Player Roster</h3>

                <div id="player-list-container"></div>
            </div>
        `;

        this.appContent.innerHTML = html;

        // Render the player list
        this.renderPlayerList();

        // Add event listeners
        this.setupEventListeners();
    }

    // Render only the player list (preserves search input focus)
    renderPlayerList() {
        const players = this.filteredPlayers;
        const listContainer = document.getElementById('player-list-container');
        const rosterTitle = document.getElementById('roster-title');

        if (!listContainer) return;

        // Update title with count
        if (rosterTitle) {
            rosterTitle.innerHTML = `🏆 Player Roster <span style="font-size: 1rem; opacity: 0.7;">(${this.searchQuery.length >= 2 ? `${players.length} found` : `${this.players.length} players`})</span>`;
        }

        // Update sort buttons
        const sortRankBtn = document.getElementById('sort-rank');
        const sortNameBtn = document.getElementById('sort-name');
        const sortSessionsBtn = document.getElementById('sort-sessions');
        if (sortRankBtn) {
            sortRankBtn.className = `neo-btn ${this.sortBy === 'rank' ? 'neo-btn-primary' : ''}`;
        }
        if (sortNameBtn) {
            sortNameBtn.className = `neo-btn ${this.sortBy === 'name' ? 'neo-btn-primary' : ''}`;
        }
        if (sortSessionsBtn) {
            sortSessionsBtn.className = `neo-btn ${this.sortBy === 'sessions' ? 'neo-btn-primary' : ''}`;
        }

        let html = '';
        if (players && players.length > 0) {
            html += `<div style="display: grid; gap: 1rem;">`;

            players.forEach((player, index) => {
                const isGambleKing = this.sortBy === 'rank' && index === 0 && player.net_profit > 0;
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

            html += `</div>`;
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🎲</div>
                    <p style="font-size: 1.25rem; font-weight: 700; opacity: 0.8; margin: 0;">${this.searchQuery.length >= 2 ? 'No players match your search.' : 'No players found. Add your first player above!'}</p>
                </div>
            `;
        }

        listContainer.innerHTML = html;

        // Re-attach click handlers for player cards
        document.querySelectorAll('.clickable-player-stats').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    return;
                }
                const playerId = element.dataset.playerId;
                if (playerId) {
                    window.location.hash = `#player/${playerId}`;
                }
            });
        });
    }

    // Setup event listeners for the page
    setupEventListeners() {
        const addPlayerBtn = document.getElementById('add-player-btn');
        const newPlayerNameInput = document.getElementById('new-player-name');
        const searchInput = document.getElementById('player-search');
        const suggestionsContainer = document.getElementById('search-suggestions');
        const sortRankBtn = document.getElementById('sort-rank');
        const sortNameBtn = document.getElementById('sort-name');
        const sortSessionsBtn = document.getElementById('sort-sessions');

        // Add player functionality
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

        // Search functionality with suggestions
        if (searchInput && suggestionsContainer) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                this.searchQuery = query;

                // Show suggestions
                if (query.length >= 2) {
                    const suggestions = this.getSearchSuggestions(query);
                    if (suggestions.length > 0) {
                        suggestionsContainer.innerHTML = suggestions.map(name => `
                            <div class="search-suggestion" style="padding: 0.75rem 1rem; cursor: pointer; font-weight: 600; border-bottom: 1px solid var(--border-color);"
                                 onmouseover="this.style.background='var(--bg-secondary)'"
                                 onmouseout="this.style.background='transparent'">
                                ${name}
                            </div>
                        `).join('');
                        suggestionsContainer.style.display = 'block';

                        // Add click handlers to suggestions
                        suggestionsContainer.querySelectorAll('.search-suggestion').forEach(suggestion => {
                            suggestion.addEventListener('click', () => {
                                searchInput.value = suggestion.textContent.trim();
                                this.searchQuery = suggestion.textContent.trim();
                                suggestionsContainer.style.display = 'none';
                                this.applyFiltersAndSort();
                                this.renderPlayerList();
                            });
                        });
                    } else {
                        suggestionsContainer.style.display = 'none';
                    }
                } else {
                    suggestionsContainer.style.display = 'none';
                }

                // Apply filter and re-render
                this.applyFiltersAndSort();
                this.renderPlayerList();
            });

            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                    suggestionsContainer.style.display = 'none';
                }
            });

            // Handle Enter key to search
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    suggestionsContainer.style.display = 'none';
                }
            });
        }

        // Sorting functionality
        if (sortRankBtn) {
            sortRankBtn.addEventListener('click', () => {
                this.sortBy = 'rank';
                this.applyFiltersAndSort();
                this.renderPlayerList();
            });
        }

        if (sortNameBtn) {
            sortNameBtn.addEventListener('click', () => {
                this.sortBy = 'name';
                this.applyFiltersAndSort();
                this.renderPlayerList();
            });
        }

        if (sortSessionsBtn) {
            sortSessionsBtn.addEventListener('click', () => {
                this.sortBy = 'sessions';
                this.applyFiltersAndSort();
                this.renderPlayerList();
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
