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
            const [gamblingData, summaryData, leaderboardData, playersData] = await Promise.all([
                this.api.get('stats/gambling-over-time'),
                this.api.get('stats/summary'),
                this.api.get('stats/leaderboards'),
                this.api.get('players')
            ]);

            this.chartData = gamblingData;
            this.summaryData = summaryData;
            this.leaderboardData = leaderboardData;
            this.playersData = playersData;
            
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

                <!-- Pie Chart Section -->
                ${this.renderPieChartSection()}

                <!-- Leaderboards Section -->
                ${this.renderLeaderboards()}
                
            </div>
        `;
        
        this.appContent.innerHTML = html;

        // Initialize charts after DOM is rendered
        setTimeout(() => {
            this.initializeChart();
            this.initializePieChart();
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
    
    // Render pie chart section
    renderPieChartSection() {
        if (!this.playersData || this.playersData.length === 0) {
            return '';
        }

        // Filter players with buy-ins > 0
        const playersWithBuyIns = this.playersData.filter(p => p.total_buy_ins_value > 0);

        if (playersWithBuyIns.length === 0) {
            return '';
        }

        const totalGambled = playersWithBuyIns.reduce((sum, p) => sum + p.total_buy_ins_value, 0);

        return `
            <div class="neo-card neo-card-purple" style="margin-bottom: 2rem;">
                <div class="neo-chart-header">
                    <h2>🎰 Money Gambled by Player</h2>
                    <div class="neo-chart-subtitle">
                        Who's contributing to the pot?
                    </div>
                    <div class="neo-chart-subtitle">
                        • Total: $${totalGambled.toLocaleString()}
                    </div>
                </div>
                <div id="pie-chart-container" class="neo-pie-chart-container">
                    <!-- Pie chart will be rendered here -->
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

                <div class="neo-leaderboard-stat green">
                    <div class="neo-leaderboard-stat-label">💯 Century Club</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.century_club?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.century_club?.sessions || 0} sessions
                        <div class="neo-leaderboard-stat-explanation">Sessions with $100+ profit</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat purple">
                    <div class="neo-leaderboard-stat-label">🗣️ Speaker of the House</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.speaker_of_house?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.speaker_of_house?.quotes || 0} quotes
                        <div class="neo-leaderboard-stat-explanation">Most Words of Wisdom</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat blue">
                    <div class="neo-leaderboard-stat-label">🎯 Most Consistent</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.most_consistent?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">±$${Math.round(data.most_consistent?.std_dev || 0).toLocaleString()}
                        <div class="neo-leaderboard-stat-explanation">Lowest variability (avg: $${Math.round(data.most_consistent?.avg_profit || 0).toLocaleString()})</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat black">
                    <div class="neo-leaderboard-stat-label">🔄 Biggest Grinder</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.biggest_grinder?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.biggest_grinder?.rebuys || 0} rebuys
                        <div class="neo-leaderboard-stat-explanation">Most additional buy-ins across all sessions</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat red">
                    <div class="neo-leaderboard-stat-label">💸 Biggest Session Loss</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.biggest_session_loss?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">-$${Math.abs(data.biggest_session_loss?.amount || 0).toLocaleString()}</div>
                </div>

                <div class="neo-leaderboard-stat red">
                    <div class="neo-leaderboard-stat-label">😤 Longest Losing Streak</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.longest_losing_streak?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.longest_losing_streak?.streak || 0} losses
                        <div class="neo-leaderboard-stat-explanation">Consecutive sessions without profit</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat blue">
                    <div class="neo-leaderboard-stat-label">🎖️ Attendance Award</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.best_attendance?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${(data.best_attendance?.percentage || 0).toFixed(1)}%
                        <div class="neo-leaderboard-stat-explanation">${data.best_attendance?.sessions_attended || 0}/${data.best_attendance?.total_sessions || 0} sessions attended</div>
                    </div>
                </div>

                <div class="neo-leaderboard-stat gold">
                    <div class="neo-leaderboard-stat-label">🏅 Most Decorated</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.most_decorated?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.most_decorated?.awards || 0} awards
                        <div class="neo-leaderboard-stat-explanation">Most awards on this page</div>
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
        
        // Get container dimensions
        const containerWidth = chartContainer.offsetWidth || 800;
        
        // Chart configuration
        const margin = { top: 20, right: 20, bottom: 10, left: 80 };
        const padding = 10; // Horizontal padding for circles
        const width = containerWidth - margin.left - margin.right - (padding * 2); // Account for circle padding
        const height = Math.max(300, Math.min(500, containerWidth * 0.4)) - margin.top - margin.bottom;
        
        // Data configuration
        const values = data.map(d => d.cumulative_amount);
        const minValue = values[0]; // Start from first session's cumulative amount
        const maxValue = Math.max(...values);
        const valueRange = maxValue - minValue;

        // Y-axis labels: start at first session value, then 500, 1000, 1500, etc.
        const increment = 500;
        const yLabels = [minValue]; // Start with first session's cumulative amount

        // Find the first multiple of 500 above minValue
        const firstIncrement = Math.ceil(minValue / increment) * increment;
        for (let v = firstIncrement; v <= maxValue; v += increment) {
            if (v > minValue) { // Don't duplicate if minValue is exactly a multiple of 500
                yLabels.push(v);
            }
        }
        // Add next increment above max value
        const lastLabel = Math.ceil(maxValue / increment) * increment;
        if (yLabels[yLabels.length - 1] < lastLabel) {
            yLabels.push(lastLabel);
        }

        // Adjust scale to match label range
        const scaleMin = minValue;
        const scaleMax = yLabels[yLabels.length - 1];
        const scaleRange = scaleMax - scaleMin;

        // Scale functions - map data values to pixel positions (with horizontal padding)
        const xScale = (index) => padding + (index / Math.max(data.length - 1, 1)) * width;
        const yScale = (value) => height - ((value - scaleMin) / scaleRange) * height;
        
        // Build the chart HTML
        let html = `
            <div style="display: flex; width: 100%; height: ${height + margin.top + margin.bottom}px;">
                <!-- Y-axis labels -->
                <div style="width: ${margin.left}px; position: relative; height: ${height + margin.top}px;">
                    ${[...yLabels].reverse().map(value => {
                        const y = margin.top + yScale(value);
                        return `<div style="position: absolute; top: ${y}px; right: 10px; transform: translateY(-50%); font-size: 0.75rem; font-weight: bold; color: var(--text-secondary);">$${value.toLocaleString()}</div>`;
                    }).join('')}
                </div>

                <!-- Chart area -->
                <div style="flex: 1; border-left: 3px solid var(--casino-black); border-bottom: 3px solid var(--casino-black); position: relative;">
                    <svg width="${width + padding * 2}" height="${height + margin.top + 10}" style="display: block; overflow: visible;">
                        <!-- Grid lines -->
                        <g>
                            ${yLabels.map(value => {
                                const y = margin.top + yScale(value);
                                return `<line x1="${padding}" y1="${y}" x2="${width + padding}" y2="${y}" stroke="var(--text-muted)" stroke-width="1" opacity="0.3" />`;
                            }).join('')}
                        </g>

                        <!-- Line -->
                        <path d="${this.buildLinePath(data, xScale, yScale, margin.top)}"
                              fill="none"
                              stroke="var(--casino-green-dark)"
                              stroke-width="3" />

                        <!-- Data points -->
                        ${data.map((point, index) => {
                            const cx = xScale(index);
                            const cy = margin.top + yScale(point.cumulative_amount);
                            return `
                                <circle cx="${cx}"
                                        cy="${cy}"
                                        r="6"
                                        fill="var(--casino-gold)"
                                        stroke="var(--casino-black)"
                                        stroke-width="2"
                                        class="neo-data-point"
                                        data-session-id="${point.session_id}"
                                        data-date="${point.date}"
                                        data-session-amount="$${point.session_amount.toLocaleString()}"
                                        data-value="$${point.cumulative_amount.toLocaleString()}"
                                        data-players="${point.player_count}" />
                            `;
                        }).join('')}
                    </svg>
                </div>
            </div>
        `;
        
        chartContainer.innerHTML = html;
        
        // Add interactions
        this.addChartInteractions();
    }
    
    // Build the SVG path for the line chart
    buildLinePath(data, xScale, yScale, marginTop) {
        if (data.length === 0) return '';

        // Start at first point
        const firstX = xScale(0);
        const firstY = marginTop + yScale(data[0].cumulative_amount);
        let path = `M ${firstX} ${firstY}`;

        // Draw line through all data points
        for (let i = 1; i < data.length; i++) {
            const x = xScale(i);
            const y = marginTop + yScale(data[i].cumulative_amount);
            path += ` L ${x} ${y}`;
        }

        return path;
    }

    // Generate x-axis labels for every 3 months
    generateXAxisLabels(data) {
        if (!data || data.length === 0) return [];

        const labels = [];
        const usedIndices = new Set();

        // Get first and last dates
        const firstDate = new Date(data[0].date);
        const lastDate = new Date(data[data.length - 1].date);

        // Always show first date
        const firstMonth = firstDate.getMonth() + 1;
        const firstYear = firstDate.getFullYear().toString().slice(-2);
        labels.push({
            index: 0,
            text: `${firstMonth}/${firstYear}`
        });
        usedIndices.add(0);

        // Find quarter months between first and last date
        let currentDate = new Date(firstDate);
        currentDate.setDate(1);
        // Move to next quarter (0, 3, 6, 9)
        const startMonth = currentDate.getMonth();
        const nextQuarter = Math.ceil((startMonth + 1) / 3) * 3;
        if (nextQuarter <= 11) {
            currentDate.setMonth(nextQuarter);
        } else {
            currentDate.setMonth(0);
            currentDate.setFullYear(currentDate.getFullYear() + 1);
        }

        // Generate labels every 3 months
        while (currentDate <= lastDate) {
            const month = currentDate.getMonth();
            const year = currentDate.getFullYear();

            // Find the closest data point index to this date
            let closestIndex = 0;
            let closestDiff = Infinity;

            data.forEach((point, index) => {
                const pointDate = new Date(point.date);
                const diff = Math.abs(pointDate - currentDate);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestIndex = index;
                }
            });

            // Only add if not already used
            if (!usedIndices.has(closestIndex)) {
                const shortYear = year.toString().slice(-2);
                const displayMonth = month + 1;
                labels.push({
                    index: closestIndex,
                    text: `${displayMonth}/${shortYear}`
                });
                usedIndices.add(closestIndex);
            }

            // Move to next quarter
            currentDate.setMonth(currentDate.getMonth() + 3);
        }

        // Always show last date if different from others
        if (data.length > 1 && !usedIndices.has(data.length - 1)) {
            const lastMonth = lastDate.getMonth() + 1;
            const lastYear = lastDate.getFullYear().toString().slice(-2);
            labels.push({
                index: data.length - 1,
                text: `${lastMonth}/${lastYear}`
            });
        }

        return labels;
    }

    // Create Y-axis labels with absolute positioning
    createYAxisLabels(coords) {
        return coords.yLabels.map(value => {
            const y = coords.getLabelYCoordinate(value);
            return `<div class="neo-y-label" style="position: absolute; top: ${y}px; right: 0.5rem; transform: translateY(-50%);">$${value.toLocaleString()}</div>`;
        }).join('');
    }

    // Create grid lines for Y-axis values
    createGridLines(coords) {
        let gridHTML = '';
        
        coords.yLabels.forEach((value) => {
            const y = coords.getLabelYCoordinate(value);
            
            const strokeWidth = value === coords.chartMinValue ? "3" : "2";
            const opacity = value === coords.chartMinValue ? "1" : "0.3";
            const stroke = value === coords.chartMinValue ? "var(--casino-black)" : "var(--text-muted)";
            
            gridHTML += `<line x1="0" y1="${y}" x2="${coords.chartWidth}" y2="${y}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
        });
        
        return gridHTML;
    }

    // Create SVG area path
    createAreaPath(data, coords) {
        if (data.length === 0) return '';
        
        // Y position for baseline ($0) - use same coordinate system as grid lines
        const baselineY = coords.getYCoordinate(coords.chartMinValue);
        
        let pathD = '';
        
        // Start from the baseline at the first data point's X position
        const firstX = coords.getXCoordinate(0, data.length);
        
        // Start the path from the bottom baseline ($0)
        pathD += `M ${firstX} ${baselineY}`;
        
        // Draw the line through all data points
        data.forEach((point, index) => {
            const x = coords.getXCoordinate(index, data.length);
            const y = coords.getYCoordinate(point.cumulative_amount);
            pathD += ` L ${x} ${y}`;
        });
        
        // Close the area by going down to the bottom and back to start
        if (data.length > 0) {
            const lastX = coords.getXCoordinate(data.length - 1, data.length);
            pathD += ` L ${lastX} ${baselineY}`;
            pathD += ` L ${firstX} ${baselineY}`;
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
    createDataPoints(data, coords) {
        if (data.length === 0) return '';
        
        return data.map((point, index) => {
            const x = coords.getXCoordinate(index, data.length);
            const y = coords.getYCoordinate(point.cumulative_amount);
            
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
    }    // Add chart interaction handlers
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

    // Initialize SVG pie chart with neobrutalist styling
    initializePieChart() {
        const pieContainer = document.getElementById('pie-chart-container');

        if (!pieContainer || !this.playersData) {
            return;
        }

        // Filter players with buy-ins > 0 and sort by total buy-ins (descending)
        const playersWithBuyIns = this.playersData
            .filter(p => p.total_buy_ins_value > 0)
            .sort((a, b) => b.total_buy_ins_value - a.total_buy_ins_value);

        if (playersWithBuyIns.length === 0) {
            pieContainer.innerHTML = '<p style="text-align: center; padding: 2rem;">No data to display</p>';
            return;
        }

        const totalGambled = playersWithBuyIns.reduce((sum, p) => sum + p.total_buy_ins_value, 0);

        // Color palette for pie slices (neobrutalist colors)
        const colors = [
            '#10B981', // green
            '#3B82F6', // blue
            '#F59E0B', // gold/orange
            '#EF4444', // red
            '#8B5CF6', // purple
            '#EC4899', // pink
            '#14B8A6', // teal
            '#F97316', // orange
            '#06B6D4', // cyan
            '#84CC16', // lime
        ];

        // Separate top 10 and others
        const TOP_COUNT = 10;
        const topPlayers = playersWithBuyIns.slice(0, TOP_COUNT);
        const otherPlayers = playersWithBuyIns.slice(TOP_COUNT);

        // Calculate slices - top 10 + "Everyone Else"
        const slices = [];

        topPlayers.forEach((player, index) => {
            const percentage = (player.total_buy_ins_value / totalGambled) * 100;
            slices.push({
                name: player.name,
                value: player.total_buy_ins_value,
                percentage: percentage,
                color: colors[index % colors.length],
                isTopPlayer: true
            });
        });

        // Add "Everyone Else" slice if there are more players
        if (otherPlayers.length > 0) {
            const othersTotal = otherPlayers.reduce((sum, p) => sum + p.total_buy_ins_value, 0);
            const othersPercentage = (othersTotal / totalGambled) * 100;
            slices.push({
                name: `Everyone Else (${otherPlayers.length})`,
                value: othersTotal,
                percentage: othersPercentage,
                color: '#6B7280', // gray
                isTopPlayer: false,
                otherPlayers: otherPlayers
            });
        }

        // SVG configuration
        const size = 400;
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 20;

        // Store slices data for access in createPieSlice method
        this._currentPieSlices = slices;

        // Build SVG
        let currentAngle = -90; // Start at top
        const slicePaths = slices.map((slice, index) => {
            const angle = (slice.percentage / 100) * 360;
            const path = this.createPieSlice(centerX, centerY, radius, currentAngle, currentAngle + angle, slice.color, slice.name, index);
            currentAngle += angle;
            return path;
        });

        // Create legend items in a responsive grid
        const topLegendItems = slices.filter(s => s.isTopPlayer).map((slice, index) => `
            <div class="neo-pie-legend-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: var(--neo-border); background: var(--bg-card);">
                <div style="width: 20px; height: 20px; background: ${slice.color}; border: var(--neo-border); flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 800; font-size: 0.75rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${slice.name}</div>
                    <div style="font-weight: 600; font-size: 0.7rem; color: var(--text-secondary);">$${slice.value.toLocaleString()} • ${slice.percentage.toFixed(1)}%</div>
                </div>
            </div>
        `).join('');

        // Create "Everyone Else" section if applicable
        const everyoneElseItem = otherPlayers.length > 0 ? `
            <div class="neo-pie-legend-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: var(--neo-border); background: var(--bg-card); cursor: pointer;" id="everyone-else-item">
                <div style="width: 20px; height: 20px; background: #6B7280; border: var(--neo-border); flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 800; font-size: 0.75rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Everyone Else (${otherPlayers.length})</div>
                    <div style="font-weight: 600; font-size: 0.7rem; color: var(--text-secondary);">$${otherPlayers.reduce((sum, p) => sum + p.total_buy_ins_value, 0).toLocaleString()} • ${((otherPlayers.reduce((sum, p) => sum + p.total_buy_ins_value, 0) / totalGambled) * 100).toFixed(1)}%</div>
                </div>
                <div class="everyone-else-arrow" style="font-weight: 800; color: var(--casino-purple); font-size: 1rem;">▼</div>
            </div>
        ` : '';

        const everyoneElseExpanded = otherPlayers.length > 0 ? `
            <!-- Expandable list of everyone else -->
            <div id="everyone-else-expanded" style="display: none; margin-top: 0.5rem; padding: 0.5rem; border: var(--neo-border); background: var(--bg-content); grid-column: 1 / -1;">
                ${otherPlayers.map((player, idx) => `
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: ${idx < otherPlayers.length - 1 ? '1px solid var(--text-muted)' : 'none'};">
                        <span style="font-weight: 700; font-size: 0.75rem; color: var(--text-primary);">${player.name}</span>
                        <span style="font-weight: 600; font-size: 0.75rem; color: var(--text-secondary);">$${player.total_buy_ins_value.toLocaleString()} • ${((player.total_buy_ins_value / totalGambled) * 100).toFixed(1)}%</span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        pieContainer.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: center; flex-wrap: wrap;">
                <!-- Pie Chart SVG -->
                <div style="position: relative; flex-shrink: 0;">
                    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block;">
                        ${slicePaths.join('')}
                    </svg>
                </div>

                <!-- Legend Grid -->
                <div style="flex: 1; min-width: 300px; max-width: 700px;">
                    <div class="neo-pie-legend-grid">
                        ${topLegendItems}
                        ${everyoneElseItem}
                        ${everyoneElseExpanded}
                    </div>
                </div>
            </div>
        `;

        // Add click handler for "Everyone Else" expansion
        if (otherPlayers.length > 0) {
            const everyoneElseItem = document.getElementById('everyone-else-item');
            const everyoneElseExpanded = document.getElementById('everyone-else-expanded');

            if (everyoneElseItem && everyoneElseExpanded) {
                everyoneElseItem.addEventListener('click', () => {
                    const isExpanded = everyoneElseExpanded.style.display !== 'none';
                    everyoneElseExpanded.style.display = isExpanded ? 'none' : 'block';
                    const arrow = everyoneElseItem.querySelector('.everyone-else-arrow');
                    if (arrow) {
                        arrow.textContent = isExpanded ? '▼' : '▲';
                    }
                });
            }
        }

        // Add click handlers to pie slices
        this.addPieSliceInteractions();
    }

    // Add click interactions to pie slices
    addPieSliceInteractions() {
        const pieSlices = document.querySelectorAll('.neo-pie-slice');
        const pieChartSvg = document.querySelector('#pie-chart-container svg');

        if (!pieChartSvg) return;

        pieSlices.forEach(slice => {
            slice.addEventListener('click', (e) => {
                const playerName = e.target.getAttribute('data-player-name');
                const playerValue = e.target.getAttribute('data-player-value');
                const playerPercentage = e.target.getAttribute('data-player-percentage');

                // Remove any existing tooltip
                const existingTooltip = document.querySelector('.neo-pie-click-tooltip');
                if (existingTooltip) {
                    existingTooltip.remove();
                }

                // Get click position
                const clickX = e.clientX;
                const clickY = e.clientY;

                // Create tooltip at click position
                const tooltip = document.createElement('div');
                tooltip.className = 'neo-pie-click-tooltip';
                tooltip.innerHTML = `
                    <div style="font-weight: 900; font-size: 1.25rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); margin-bottom: 0.5rem;">
                        ${playerName}
                    </div>
                    <div style="font-size: 1.125rem; font-weight: 700; color: var(--casino-gold); margin-bottom: 0.25rem;">
                        $${playerValue}
                    </div>
                    <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-secondary);">
                        ${playerPercentage}% of total
                    </div>
                `;

                tooltip.style.cssText = `
                    position: fixed;
                    left: ${clickX}px;
                    top: ${clickY}px;
                    transform: translate(-50%, calc(-100% - 10px));
                    background: var(--bg-card);
                    padding: 1rem 1.5rem;
                    border: var(--neo-border-thick);
                    box-shadow: var(--neo-shadow-lg);
                    z-index: 1000;
                    text-align: center;
                    pointer-events: none;
                `;

                document.body.appendChild(tooltip);

                // Remove tooltip after 3 seconds or on next click
                setTimeout(() => {
                    if (tooltip.parentElement) {
                        tooltip.remove();
                    }
                }, 3000);
            });
        });

        // Click anywhere to dismiss tooltip
        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('neo-pie-slice')) {
                const tooltip = document.querySelector('.neo-pie-click-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            }
        });
    }

    // Create SVG path for pie slice
    createPieSlice(cx, cy, radius, startAngle, endAngle, color, playerName = '', sliceIndex = 0) {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        const pathData = [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');

        // Get player data from slices array
        const slice = this.getCurrentSliceData(sliceIndex);
        const playerValue = slice ? slice.value.toLocaleString() : '0';
        const playerPercentage = slice ? slice.percentage.toFixed(1) : '0';

        return `<path d="${pathData}"
                      fill="${color}"
                      stroke="var(--casino-black)"
                      stroke-width="3"
                      class="neo-pie-slice"
                      data-player-name="${playerName}"
                      data-player-value="${playerValue}"
                      data-player-percentage="${playerPercentage}" />`;
    }

    // Helper to get current slice data (stored temporarily during pie chart rendering)
    getCurrentSliceData(index) {
        return this._currentPieSlices ? this._currentPieSlices[index] : null;
    }
}
