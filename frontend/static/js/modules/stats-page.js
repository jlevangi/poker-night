// Stats page module
export default class StatsPage {
    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.chartData = null;
        this.summaryData = null;
    }
    
    // Load the stats page
    async load() {
        try {
            // Show loading state
            this.appContent.innerHTML = `
                <div class="fade-in" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                    <div class="neo-card" style="text-align: center; padding: 3rem;">
                        <h2>Loading Statistics...</h2>
                        <div class="neo-stat-value">📊</div>
                    </div>
                </div>
            `;
            
            // Fetch stats data
            const [gamblingData, summaryData, leaderboardData] = await Promise.all([
                this.api.get('stats/gambling-over-time'),
                this.api.get('stats/summary'),
                this.api.get('stats/leaderboards')
            ]);
            
            this.chartData = gamblingData;
            this.summaryData = summaryData;
            this.leaderboardData = leaderboardData;
            
            // Render the stats page
            this.render();
        } catch (error) {
            console.error('Error loading stats:', error);
            this.appContent.innerHTML = `
                <div class="fade-in" style="padding: 1.5rem;">
                    <div class="neo-card neo-card-red">
                        <h2>Error Loading Statistics</h2>
                        <p>${error.message}</p>
                        <button class="neo-btn neo-btn-red" onclick="window.location.reload()">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    // Render stats content
    render() {
        const html = `
            <div class="fade-in stats-page" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-gold);">📊 Stats</h2>
                
                <!-- Summary Stats Grid -->
                ${this.renderSummaryStats()}
                
                <!-- Main Chart Section -->
                ${this.renderChartSection()}
                
                <!-- Leaderboards Section -->
                ${this.renderLeaderboards()}
                
            </div>
        `;
        
        this.appContent.innerHTML = html;
        
        // Initialize chart after DOM is rendered
        setTimeout(() => {
            this.initializeChart();
        }, 100);
    }
    
    // Render summary statistics
    renderSummaryStats() {
        if (!this.summaryData) return '';
        
        const stats = this.summaryData;
        
        return `
            <div class="neo-stats-grid" style="margin-bottom: 2rem;">
                <div class="neo-stat-card neo-card-gold">
                    <div class="neo-stat-value">$${(stats.total_buy_ins || 0).toLocaleString()}</div>
                    <div class="neo-stat-label">Total Buy-ins</div>
                </div>
                <div class="neo-stat-card neo-card-green">
                    <div class="neo-stat-value">${stats.total_sessions || 0}</div>
                    <div class="neo-stat-label">Poker Sessions</div>
                </div>
                <div class="neo-stat-card neo-card-purple">
                    <div class="neo-stat-value">$${(stats.average_session_value || 0).toLocaleString()}</div>
                    <div class="neo-stat-label">Avg Session Value</div>
                </div>
                <div class="neo-stat-card neo-card-red">
                    <div class="neo-stat-value">-$${Math.abs(stats.house_loss || 0).toLocaleString()}</div>
                    <div class="neo-stat-label">House Loss</div>
                </div>
            </div>
        `;
    }
    
    // Render main chart section
    renderChartSection() {
        if (!this.chartData || !this.chartData.data || this.chartData.data.length === 0) {
            return `
                <div class="neo-card" style="margin-bottom: 2rem; text-align: center; padding: 3rem;">
                    <h2>No Data Available</h2>
                    <p>Start playing some poker sessions to see your gambling trends!</p>
                    <a href="#sessions" class="neo-btn neo-btn-green neo-btn-lg">
                        Create First Session
                    </a>
                </div>
            `;
        }
        
        const dateRange = this.chartData.date_range;
        
        return `
            <div class="neo-card" style="margin-bottom: 2rem;">
                <div class="neo-chart-header">
                    <h2>💰 Money Gambled Over Time</h2>
                    <div class="neo-chart-subtitle">
                        ${dateRange?.start && dateRange?.end 
                            ? `${dateRange.start} - ${dateRange.end}` 
                            : 'All Time'
                        } • Total: $${(this.chartData.total_gambled || 0).toLocaleString()}
                    </div>
                </div>
                <div id="gambling-chart" class="neo-chart-container">
                    <!-- Chart will be rendered here -->
                </div>
            </div>
        `;
    }
    
    // Render leaderboards section
    renderLeaderboards() {
        if (!this.leaderboardData) return '';
        
        const data = this.leaderboardData;
        
        // Helper function to format multiple players
        const formatPlayers = (players) => {
            if (!players || players.length === 0) return 'N/A';
            if (players.length === 1) return players[0];
            if (players.length <= 3) return players.join(', ');
            return `${players.slice(0, 3).join(', ')} +${players.length - 3} more`;
        };
        
        return `
            <h2 style="font-size: 2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: var(--text-primary); text-shadow: 3px 3px 0px var(--casino-red); text-align: center;">🏆 Leaderboards</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                
                <div class="neo-leaderboard-stat green">
                    <div class="neo-leaderboard-stat-label">💰 Biggest Session Win</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.biggest_session_win?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">$${(data.biggest_session_win?.amount || 0).toLocaleString()}</div>
                </div>

                <div class="neo-leaderboard-stat red">
                    <div class="neo-leaderboard-stat-label">💸 Biggest Session Loss</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.biggest_session_loss?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">-$${Math.abs(data.biggest_session_loss?.amount || 0).toLocaleString()}</div>
                </div>

                <div class="neo-leaderboard-stat purple">
                    <div class="neo-leaderboard-stat-label">🔥 Highest Win Streak</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.highest_win_streak?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.highest_win_streak?.streak || 0} wins</div>
                </div>

                <div class="neo-leaderboard-stat gold">
                    <div class="neo-leaderboard-stat-label">📊 Highest Win Rate</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.highest_win_percentage?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${(data.highest_win_percentage?.percentage || 0).toFixed(1)}%
                        <div class="neo-leaderboard-stat-explanation">${data.highest_win_percentage?.games || 0} games minimum</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat blue">
                    <div class="neo-leaderboard-stat-label">🃏 Most Games Played</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.most_games_played?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.most_games_played?.games || 0} games</div>
                </div>

                <div class="neo-leaderboard-stat black">
                    <div class="neo-leaderboard-stat-label">🔄 Biggest Grinder</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.biggest_grinder?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.biggest_grinder?.rebuys || 0} rebuys
                        <div class="neo-leaderboard-stat-explanation">Most additional buy-ins across all sessions</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat gold">
                    <div class="neo-leaderboard-stat-label">💯 Century Club</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.century_club?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.century_club?.sessions || 0} sessions
                        <div class="neo-leaderboard-stat-explanation">Sessions with $100+ profit</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat blue">
                    <div class="neo-leaderboard-stat-label">🏅 Veteran Status</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.most_games_played?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.most_games_played?.games || 0} sessions
                        <div class="neo-leaderboard-stat-explanation">Most poker sessions played overall</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat green">
                    <div class="neo-leaderboard-stat-label">🎯 Most Consistent</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.most_consistent?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">±$${Math.round(data.most_consistent?.std_dev || 0).toLocaleString()}
                        <div class="neo-leaderboard-stat-explanation">Lowest variability (avg: $${Math.round(data.most_consistent?.avg_profit || 0).toLocaleString()})</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat purple">
                    <div class="neo-leaderboard-stat-label">🎖️ Attendance Award</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.best_attendance?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${(data.best_attendance?.percentage || 0).toFixed(1)}%
                        <div class="neo-leaderboard-stat-explanation">${data.best_attendance?.sessions_attended || 0}/${data.best_attendance?.total_sessions || 0} sessions attended</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat red">
                    <div class="neo-leaderboard-stat-label">😤 Longest Losing Streak</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.longest_losing_streak?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.longest_losing_streak?.streak || 0} losses
                        <div class="neo-leaderboard-stat-explanation">Consecutive sessions without profit</div>
                    </div>
                </div>

            </div>
        `;
    }

    
    // Initialize SVG area chart with neobrutalist styling
    initializeChart() {
        const chartContainer = document.getElementById('gambling-chart');
        
        if (!chartContainer || !this.chartData || !this.chartData.data) {
            return;
        }
        
        const data = this.chartData.data;
        
        if (data.length === 0) {
            chartContainer.innerHTML = '<p style="text-align: center; padding: 2rem;">No data to display</p>';
            return;
        }
        
        // Chart dimensions
        const containerWidth = chartContainer.offsetWidth || 800;
        const width = Math.max(400, containerWidth - 120);
        const height = 250;
        const padding = { top: 15, right: 15, bottom: 30, left: 0 };
        
        // Find min and max values for dynamic Y-axis
        const dataMinValue = Math.min(...data.map(d => d.cumulative_amount));
        const dataMaxValue = Math.max(...data.map(d => d.cumulative_amount));
        const increment = 500;
        
        // Start from the first session's value, then count up by $500 increments
        const minValue = dataMinValue;
        const maxValue = Math.ceil((dataMaxValue + increment) / increment) * increment;
        
        // Generate Y-axis labels starting from minValue, going up by $500 increments (high to low for display)
        const yLabels = [];
        // Start from minValue and create labels up to maxValue
        let currentValue = minValue;
        const labelsArray = [currentValue];
        while (currentValue < maxValue) {
            currentValue += increment;
            labelsArray.push(Math.min(currentValue, maxValue));
        }
        // Reverse for display (high to low)
        labelsArray.reverse().forEach(value => yLabels.push(value));
        
        // Create SVG area chart with dynamic Y-axis
        let yAxisHTML = '';
        yLabels.forEach((value) => {
            yAxisHTML += `<div class="neo-y-label">$${value.toLocaleString()}</div>`;
        });
        
        let chartHTML = `
            <div class="neo-chart-wrapper">
                <div class="neo-chart-y-axis">
                    ${yAxisHTML}
                </div>
                <div class="neo-chart-area">
                    <svg class="neo-area-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                        <!-- Dynamic Grid lines -->
                        <g class="neo-chart-grid">
                            ${this.createGridLines(yLabels, width, height, padding, minValue)}
                        </g>
                        
                        <!-- Area path -->
                        ${this.createAreaPath(data, width, height, padding, maxValue, minValue)}
                        
                        <!-- Data points -->
                        ${this.createDataPoints(data, width, height, padding, maxValue, minValue)}
                    </svg>
                </div>
            </div>
        `;
        
        chartContainer.innerHTML = chartHTML;
        
        // Add interactions
        this.addChartInteractions();
    }
    
    // Create grid lines for Y-axis values
    createGridLines(yLabels, width, height, padding, minValue) {
        // Grid lines should match exactly where the Y-axis labels are positioned
        // Labels use justify-content: space-between, so they're at 0, 1/(n-1), 2/(n-1), ... 1 of the full height
        let gridHTML = '';
        
        yLabels.forEach((value, index) => {
            // Match the exact positioning used by justify-content: space-between
            const y = (index / (yLabels.length - 1)) * height;
            
            const strokeWidth = value === minValue ? "3" : "2";
            const opacity = value === minValue ? "1" : "0.3";
            const stroke = value === minValue ? "var(--casino-black)" : "var(--text-muted)";
            
            gridHTML += `<line x1="0" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
        });
        
        return gridHTML;
    }
    
    // Create SVG area path
    createAreaPath(data, width, height, padding, maxValue, minValue) {
        if (data.length === 0) return '';
        
        const chartWidth = width - padding.right;
        const valueRange = maxValue - minValue;
        
        // Y position for minValue (the baseline) - should match the bottom grid line
        const bottomY = height;
        
        let pathD = '';
        
        // Start from the baseline at the first data point's X position
        const firstX = 0;
        
        // Start the path from the bottom baseline
        pathD += `M ${firstX} ${bottomY}`;
        
        // Draw the line through all data points
        data.forEach((point, index) => {
            const x = (index / Math.max(data.length - 1, 1)) * chartWidth;
            // Use the same Y positioning as grid lines (no padding offset)
            const y = height - ((point.cumulative_amount - minValue) / valueRange) * height;
            pathD += ` L ${x} ${y}`;
        });
        
        // Close the area by going down to the bottom and back to start
        if (data.length > 0) {
            const lastX = ((data.length - 1) / Math.max(data.length - 1, 1)) * chartWidth;
            pathD += ` L ${lastX} ${bottomY}`;
            pathD += ` L ${firstX} ${bottomY}`;
            pathD += ' Z';
        }
        
        return `
            <path d="${pathD}" 
                  fill="var(--casino-green)" 
                  stroke="var(--casino-green-dark)" 
                  stroke-width="3" 
                  class="neo-area-path"/>
        `;
    }
    
    // Create data points
    createDataPoints(data, width, height, padding, maxValue, minValue) {
        if (data.length === 0) return '';
        
        const chartWidth = width - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const valueRange = maxValue - minValue;
        
        return data.map((point, index) => {
            const x = (index / Math.max(data.length - 1, 1)) * chartWidth;
            // Use the same Y positioning as grid lines (no padding offset)
            const y = height - ((point.cumulative_amount - minValue) / valueRange) * height;
            
            return `
                <circle cx="${x}" 
                        cy="${y}" 
                        r="6" 
                        fill="var(--casino-gold)" 
                        stroke="var(--casino-black)" 
                        stroke-width="2" 
                        class="neo-data-point"
                        data-session-id="${point.session_id}"
                        data-date="${point.date}"
                        data-session-amount="$${point.session_amount.toLocaleString()}"
                        data-value="$${point.cumulative_amount.toLocaleString()}"
                        data-players="${point.player_count}"/>
            `;
        }).join('');
    }
    
    // Add chart interaction handlers
    addChartInteractions() {
        const dataPoints = document.querySelectorAll('.neo-data-point');
        
        dataPoints.forEach(point => {
            // Hover effects
            point.addEventListener('mouseenter', (e) => {
                const cumulativeValue = e.target.getAttribute('data-value');
                const sessionAmount = e.target.getAttribute('data-session-amount');
                const date = e.target.getAttribute('data-date');
                const sessionId = e.target.getAttribute('data-session-id');
                const players = e.target.getAttribute('data-players');
                
                // Highlight the point
                e.target.setAttribute('r', '8');
                e.target.style.fill = 'var(--casino-red)';
                
                // Show tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'neo-chart-tooltip';
                
                tooltip.innerHTML = `
                    <div><strong>Session ${date}</strong></div>
                    <div>This Session: ${sessionAmount}</div>
                    <div>Players: ${players}</div>
                    <div><strong>Cumulative: ${cumulativeValue}</strong></div>
                    <div style="margin-top: 0.5rem; font-size: 0.7rem; opacity: 0.8;">Click for details</div>
                `;
                
                document.body.appendChild(tooltip);
                
                // Position tooltip
                const rect = e.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 10}px`;
            });
            
            point.addEventListener('mouseleave', (e) => {
                // Reset point appearance
                e.target.setAttribute('r', '6');
                e.target.style.fill = 'var(--casino-gold)';
                
                // Remove tooltip
                const tooltip = document.querySelector('.neo-chart-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            });
            
            // Click event for detailed popup
            point.addEventListener('click', (e) => {
                const cumulativeValue = e.target.getAttribute('data-value');
                const sessionAmount = e.target.getAttribute('data-session-amount');
                const date = e.target.getAttribute('data-date');
                const sessionId = e.target.getAttribute('data-session-id');
                const players = e.target.getAttribute('data-players');
                
                // Remove any existing tooltips
                const tooltip = document.querySelector('.neo-chart-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
                
                // Show detailed modal
                this.showSessionDetails({
                    sessionId: sessionId,
                    date: date,
                    sessionAmount: sessionAmount,
                    cumulativeAmount: cumulativeValue,
                    players: players
                });
            });
        });
    }
    
    // Show session details modal
    showSessionDetails(sessionData) {
        // Remove existing modal if any
        const existingModal = document.querySelector('.neo-session-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'neo-session-modal';
        modalOverlay.innerHTML = `
            <div class="neo-session-modal-content">
                <div class="neo-session-modal-header">
                    <h3>🃏 Session Details</h3>
                    <button class="neo-session-modal-close">×</button>
                </div>
                <div class="neo-session-modal-body">
                    <div class="neo-session-info-grid">
                        <div class="neo-session-info-card">
                            <div class="neo-session-info-label">Session Date</div>
                            <div class="neo-session-info-value">${sessionData.date}</div>
                        </div>
                        <div class="neo-session-info-card">
                            <div class="neo-session-info-label">Players</div>
                            <div class="neo-session-info-value">${sessionData.players}</div>
                        </div>
                        <div class="neo-session-info-card">
                            <div class="neo-session-info-label">Total Buy-ins</div>
                            <div class="neo-session-info-value">${sessionData.sessionAmount}</div>
                        </div>
                        <div class="neo-session-info-card neo-highlight">
                            <div class="neo-session-info-label">Cumulative Total</div>
                            <div class="neo-session-info-value">${sessionData.cumulativeAmount}</div>
                        </div>
                    </div>
                    <div class="neo-session-actions">
                        <a href="#session/${sessionData.sessionId}" class="neo-btn neo-btn-green">
                            View Full Session
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to DOM
        document.body.appendChild(modalOverlay);
        
        // Add event listeners for closing
        const closeButtons = modalOverlay.querySelectorAll('.neo-session-modal-close');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                modalOverlay.remove();
            });
        });
        
        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modalOverlay.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}
