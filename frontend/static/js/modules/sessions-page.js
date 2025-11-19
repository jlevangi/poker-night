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
            <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-green);">🃏 Sessions</h2>
                
                <div class="neo-card neo-card-green" style="margin-bottom: 2rem; text-align: center;">
                    <button id="create-session-btn" class="neo-btn neo-btn-green neo-btn-lg">Create New Session</button>
                </div>
                
                <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary);">📋 All Sessions</h3>
        `;
        
        if (sessions && sessions.length > 0) {
            html += `<div style="display: grid; gap: 1rem;">`;
            
            sessions.forEach(session => {
                const isActive = session.status === 'ACTIVE';
                const cardColor = isActive ? 'neo-card-gold' : '';
                const statusColor = isActive ? 'var(--casino-gold)' : 'var(--text-secondary)';
                const statusIcon = isActive ? '🟡' : '⚪';
                
                html += `
                    <a href="#session/${session.session_id}" class="neo-card ${cardColor}" style="text-decoration: none; color: inherit; padding: 1rem; margin: 0; transition: all var(--transition-neo);" onmouseover="this.style.transform='translate(-2px, -2px)'; this.style.boxShadow='var(--neo-shadow-lg)'" onmouseout="this.style.transform='translate(0, 0)'; this.style.boxShadow='var(--neo-shadow-md)'">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 800; color: inherit; margin-bottom: 0.25rem; font-size: 1.125rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                    📅 ${this.formatDate(session.date)}
                                </div>
                                <div style="font-size: 0.875rem; color: inherit; font-weight: 600; opacity: 0.8;">
                                    Buy-in: $${session.buyin ? session.buyin.toFixed(2) : '0.00'} | Total: $${session.totalValue ? session.totalValue.toFixed(2) : '0.00'}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${statusColor}; font-size: 1.25rem;">${statusIcon}</span>
                                <span style="font-size: 0.875rem; font-weight: 700; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.05em;">
                                    ${session.status || 'Unknown'}
                                </span>
                            </div>
                        </div>
                    </a>
                `;
            });
            
            html += `</div>`;
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🎯</div>
                    <p style="font-size: 1.25rem; font-weight: 700; color: var(--text-secondary); margin: 0;">No sessions found. Create your first session above!</p>
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
    
    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; // Return original if can't parse
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
