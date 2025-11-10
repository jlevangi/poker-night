// Sessions page module
export default class SessionsPage {    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
    }
    
    // Load the sessions page
    async load() {
        try {
            // Fetch sessions data using API service
            const data = await this.api.get('sessions');
            
            // Map API response to match template expectations
            const mappedSessions = data.map(session => ({
                ...session,
                id: session.session_id,
                buyin: session.default_buy_in_value,
                totalValue: session.total_value || 0,
                unpaidValue: 0 // Sessions list doesn't include calculated totals
            }));
            
            // Render the sessions page
            this.render(mappedSessions);
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.appContent.innerHTML = `<p>Error loading sessions: ${error.message}</p>`;
        }
    }
    
    // Render sessions content
    render(sessions) {
        let html = `
            <div class="fade-in">
                <h2>Poker Sessions</h2>
                
                <div class="sessions-actions">
                    <button id="create-session-btn" class="action-btn">Create New Session</button>
                </div>
                
                <h3>All Sessions</h3>
        `;
        
        if (sessions && sessions.length > 0) {
            html += `<ul class="sessions-list">`;
              sessions.forEach(session => {
                  html += `
                    <li class="session-item">
                        <a href="#session/${session.session_id}" class="session-link">
                            <span class="session-date">${session.date}</span>
                            <span class="session-buyin">Buy-in: $${session.buyin ? session.buyin.toFixed(2) : '0.00'}</span>
                            <span class="session-info">Session Value: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</span>
                        </a>                        <span class="session-status status-${session.status && typeof session.status === 'string' ? session.status.toLowerCase() : 'unknown'}">
                            ${session.status || 'Unknown'}
                            ${session.status === 'ENDED' ? 
                                `<span class="session-action-dot" title="This session can be deleted"></span>` : ''}
                        </span>
                    </li>
                `;
            });
            
            html += `</ul>`;
        } else {
            html += `<p>No sessions found. Create your first session above!</p>`;
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
        const createSessionBtn = document.getElementById('create-session-btn');
        
        if (createSessionBtn) {
            createSessionBtn.addEventListener('click', () => {
                // Trigger new session modal
                document.dispatchEvent(new CustomEvent('showNewSessionModal'));
            });
        }
    }
}
