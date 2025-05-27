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
            
            // Render the sessions page
            this.render(data);
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.appContent.innerHTML = `<p>Error loading sessions: ${error.message}</p>`;
        }
    }
    
    // Render sessions content
    render(sessions) {
        let html = `
            <h2>Poker Sessions</h2>
            
            <div class="sessions-actions">
                <button id="create-session-btn" class="action-btn">Create New Session</button>
            </div>
            
            <h3>All Sessions</h3>
        `;
        
        if (sessions && sessions.length > 0) {
            html += `<ul class="sessions-list">`;
              sessions.forEach(session => {
                const hasUnpaidAmount = session.unpaidValue && session.unpaidValue > 0;
                const fullyPaidOut = session.status === 'ENDED' && (!session.unpaidValue || session.unpaidValue === 0);
                  html += `
                    <li class="session-item">
                        <a href="#session/${session.id}" class="session-link">
                            <span class="session-date">${session.date}</span>
                            <span class="session-buyin">Buy-in: $${session.buyin ? session.buyin.toFixed(2) : '0.00'}</span>
                            <span class="session-total-value">Total: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}</span>
                            ${hasUnpaidAmount ? 
                                `<span class="session-unpaid-value">Unpaid: $${session.unpaidValue ? session.unpaidValue.toFixed(2) : '0.00'}</span>` : 
                                (fullyPaidOut ? `<span class="session-unpaid-value paid-out">Fully Paid Out</span>` : '')}
                        </a>                        <span class="session-status status-${session.status && typeof session.status === 'string' ? session.status.toLowerCase() : 'unknown'}">
                            ${session.status || 'Unknown'}
                        </span>
                    </li>
                `;
            });
            
            html += `</ul>`;
        } else {
            html += `<p>No sessions found. Create your first session above!</p>`;
        }
        
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
