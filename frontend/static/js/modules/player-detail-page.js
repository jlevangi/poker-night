// Player detail page module
export default class PlayerDetailPage {    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.chartData = null;
        this.resizeTimeout = null;
        this.boundHandleResize = null;
    }
      // Load player detail page
    async load(playerId) {
        try {
            // Fetch player data, history, and profit over time
            const player = await this.api.get(`players/${playerId}/stats`);
            const history = await this.api.get(`players/${playerId}/history`);
            this.chartData = await this.api.get(`players/${playerId}/profit-over-time`);
            player.sessions = this.processPlayerHistory(history);

            // Map API response properties to match template expectations
            player.id = player.player_id;
            player.totalProfit = player.net_profit;
            player.sessionsPlayed = player.games_played;
            player.winRate = player.win_percentage / 100; // Convert percentage to decimal

            // Render player details
            this.render(player);

            // Initialize chart after rendering
            this.initializeProfitChart();

            // Setup resize listener for responsive chart
            this.setupResizeListener();
        } catch (error) {
            console.error(`Error loading player details for ${playerId}:`, error);
            this.appContent.innerHTML = `<p>Could not load details for player ${playerId}. ${error.message}</p>`;
        }
    }

    // Setup resize listener for responsive chart
    setupResizeListener() {
        // Remove existing listener if any
        if (this.boundHandleResize) {
            window.removeEventListener('resize', this.boundHandleResize);
        }

        // Create bound handler
        this.boundHandleResize = () => {
            // Debounce resize events
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(() => {
                this.initializeProfitChart();
            }, 250);
        };

        // Add resize listener
        window.addEventListener('resize', this.boundHandleResize);
    }

    // Cleanup method to remove event listeners
    cleanup() {
        if (this.boundHandleResize) {
            window.removeEventListener('resize', this.boundHandleResize);
            this.boundHandleResize = null;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    }
    
    // Process player history into session data
    processPlayerHistory(history) {
        if (!history || !Array.isArray(history)) return [];
        
        return history.map(entry => {
            return {
                sessionId: entry.session_id,
                date: entry.session_date,
                buyIn: entry.total_buy_in_amount || 0,
                cashOut: entry.payout || 0,
                profit: entry.profit || 0
            };
        });
    }
    
    // Helper to format date as 'MMM DD, YYYY' or fallback
    formatDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr; // Return original if can't parse
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    // Render player detail content
    render(player) {
        const isTopPerformer = player.totalProfit > 0;
        
        let html = `
            <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <!-- Header with navigation -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <a href="#players" class="neo-btn neo-btn-purple">← Back to Players</a>
                    <button id="share-btn" class="neo-btn neo-btn-gold">&#128203; Share</button>
                </div>
                
                <!-- Player Header Card -->
                <div class="neo-card ${isTopPerformer ? 'neo-card-gold' : 'neo-card-primary'}">
                    <h2 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; color: inherit; display: flex; align-items: center; gap: 1rem;">
                        ${player.name}
                    </h2>
                    
                    <!-- Main Stats Grid -->
                    <div class="neo-stats-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 1.5rem;">
                        <div class="neo-stat-card" style="border-color: ${player.totalProfit >= 0 ? 'var(--casino-green)' : 'var(--casino-red)'};">
                            <div class="neo-stat-value ${player.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$${player.totalProfit !== undefined ? player.totalProfit.toFixed(2) : '0.00'}</div>
                            <div class="neo-stat-label">Total Profit</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-purple);">
                            <div class="neo-stat-value">${player.sessionsPlayed || 0}</div>
                            <div class="neo-stat-label">Sessions Played</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-gold);">
                            <div class="neo-stat-value">${player.winRate !== undefined ? (player.winRate * 100).toFixed(0) : '0'}%</div>
                            <div class="neo-stat-label">Win Rate</div>
                        </div>
                        <div class="neo-stat-card" style="border-color: var(--casino-gold);">
                            <div class="neo-stat-value">${player.seven_two_wins || 0}</div>
                            <div class="neo-stat-label">7-2 Wins Total</div>
                        </div>
                    </div>
                </div>

                <!-- Profit/Loss Over Time Chart -->
                <div class="neo-card">
                    <div class="neo-chart-header">
                        <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">📈 Profit/Loss Over Time</h3>
                        <div class="neo-chart-subtitle" id="profit-chart-subtitle"></div>
                    </div>
                    <div id="profit-chart" style="margin-top: 1.5rem;"></div>
                </div>
        `;

        // Add sessions section
        if (player.sessions && player.sessions.length > 0) {
            html += `
                <!-- Sessions History -->
                <div class="neo-card">
                    <h3 style="font-size: 1.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem;">📊 Session History</h3>
                    <div class="table-responsive">
                        <table class="neo-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Buy-In</th>
                                    <th>Cash Out</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
              player.sessions.forEach(session => {
                // Ensure buyIn and cashOut are defined before calculating profit
                const buyIn = session.buyIn || 0;
                const cashOut = session.cashOut || 0; 
                const profit = cashOut - buyIn;
                
                html += `
                    <tr>
                        <td><a href="#session/${session.sessionId}" style="color: var(--primary-color); text-decoration: none; font-weight: 700;">${this.formatDate(session.date)}</a></td>
                        <td style="font-weight: 700; color: var(--casino-red);">$${buyIn.toFixed(2)}</td>
                        <td style="font-weight: 700; color: var(--casino-gold);">$${cashOut.toFixed(2)}</td>
                        <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-weight: 700;">$${profit.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="neo-card" style="text-align: center; padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">📈</div>
                    <p style="font-size: 1.25rem; font-weight: 700; color: var(--text-secondary); margin: 0;">No sessions found for this player.</p>
                </div>
            `;
        }
        
        html += `
            </div>
        `;
        
        
        this.appContent.innerHTML = html;
        
        // Add event listeners
        this.setupEventListeners(player);
    }
    
    async handleShare() {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ url });
                return;
            } catch (e) { /* user cancelled or error, fall through to clipboard */ }
        }
        try {
            await navigator.clipboard.writeText(url);
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        const btn = document.getElementById('share-btn');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '✅ Copied!';
            setTimeout(() => btn.innerHTML = original, 2000);
        }
    }

    // Setup event listeners for the page
    setupEventListeners(player) {
        // Share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.handleShare());
        }
    }

    // Initialize profit/loss chart
    initializeProfitChart() {
        const chartContainer = document.getElementById('profit-chart');
        const subtitleElement = document.getElementById('profit-chart-subtitle');

        if (!chartContainer || !this.chartData || !this.chartData.data) {
            return;
        }

        const data = this.chartData.data;

        if (data.length === 0) {
            chartContainer.innerHTML = '<p style="text-align: center; padding: 2rem;">No data to display</p>';
            return;
        }

        // Update subtitle with date range and total
        if (subtitleElement && this.chartData.date_range) {
            const totalProfit = this.chartData.total_profit || 0;
            const profitClass = totalProfit >= 0 ? 'profit-positive' : 'profit-negative';
            subtitleElement.innerHTML = `${this.formatDate(this.chartData.date_range.start)} - ${this.formatDate(this.chartData.date_range.end)} | Total: <span class="${profitClass}">$${totalProfit.toFixed(2)}</span>`;
        }

        // Get container dimensions
        const containerWidth = chartContainer.offsetWidth || 800;

        // Chart configuration - responsive margins
        const isMobile = containerWidth < 600;
        const margin = {
            top: 20,
            right: isMobile ? 10 : 20,
            bottom: 10,
            left: isMobile ? 60 : 80
        };
        const padding = 10; // Horizontal padding for circles
        const width = containerWidth - margin.left - margin.right - (padding * 2);
        const height = Math.max(250, Math.min(500, containerWidth * 0.4)) - margin.top - margin.bottom;

        // Data configuration
        const values = data.map(d => d.cumulative_profit);
        const minValue = Math.min(...values, 0); // Include 0 to show baseline
        const maxValue = Math.max(...values, 0);
        const valueRange = maxValue - minValue;

        // Y-axis labels configuration
        const increment = this.calculateIncrement(valueRange);
        const yLabels = this.generateYAxisLabels(minValue, maxValue, increment);

        // Adjust scale to match label range
        const scaleMin = yLabels[0];
        const scaleMax = yLabels[yLabels.length - 1];
        const scaleRange = scaleMax - scaleMin;

        // Scale functions
        const xScale = (index) => padding + (index / Math.max(data.length - 1, 1)) * width;
        const yScale = (value) => height - ((value - scaleMin) / scaleRange) * height;

        // Determine line color based on final profit
        const finalProfit = data[data.length - 1].cumulative_profit;
        const lineColor = finalProfit >= 0 ? 'var(--casino-green-dark)' : 'var(--casino-red)';

        // Responsive font sizes
        const labelFontSize = isMobile ? '0.65rem' : '0.75rem';
        const labelRightMargin = isMobile ? '5px' : '10px';

        // Build the chart HTML
        let html = `
            <div style="display: flex; width: 100%; height: ${height + margin.top + margin.bottom}px;">
                <!-- Y-axis labels -->
                <div style="width: ${margin.left}px; position: relative; height: ${height + margin.top}px;">
                    ${[...yLabels].reverse().map(value => {
                        const y = margin.top + yScale(value);
                        const displayValue = value >= 0 ? `$${value.toLocaleString()}` : `-$${Math.abs(value).toLocaleString()}`;
                        return `<div style="position: absolute; top: ${y}px; right: ${labelRightMargin}; transform: translateY(-50%); font-size: ${labelFontSize}; font-weight: bold; color: var(--text-secondary);">${displayValue}</div>`;
                    }).join('')}
                </div>

                <!-- Chart area -->
                <div style="flex: 1; border-left: 3px solid var(--casino-black); border-bottom: 3px solid var(--casino-black); position: relative;">
                    <svg width="${width + padding * 2}" height="${height + margin.top + 10}" style="display: block; overflow: visible;">
                        <!-- Grid lines -->
                        <g>
                            ${yLabels.map(value => {
                                const y = margin.top + yScale(value);
                                const isZeroLine = value === 0;
                                const strokeWidth = isZeroLine ? '2' : '1';
                                const opacity = isZeroLine ? '0.6' : '0.3';
                                return `<line x1="${padding}" y1="${y}" x2="${width + padding}" y2="${y}" stroke="var(--text-muted)" stroke-width="${strokeWidth}" opacity="${opacity}" />`;
                            }).join('')}
                        </g>

                        <!-- Line -->
                        <path d="${this.buildLinePath(data, xScale, yScale, margin.top)}"
                              fill="none"
                              stroke="${lineColor}"
                              stroke-width="3" />

                        <!-- Data points -->
                        ${data.map((point, index) => {
                            const cx = xScale(index);
                            const cy = margin.top + yScale(point.cumulative_profit);
                            const pointColor = point.cumulative_profit >= 0 ? 'var(--casino-gold)' : 'var(--casino-red)';
                            return `
                                <circle cx="${cx}"
                                        cy="${cy}"
                                        r="6"
                                        fill="${pointColor}"
                                        stroke="var(--casino-black)"
                                        stroke-width="2"
                                        class="neo-data-point"
                                        data-session-id="${point.session_id}"
                                        data-date="${point.date}"
                                        data-session-profit="${point.session_profit}"
                                        data-cumulative-profit="${point.cumulative_profit}"
                                        data-buy-in="${point.buy_in}"
                                        data-cash-out="${point.cash_out}" />
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

    // Calculate appropriate increment for Y-axis based on value range
    calculateIncrement(range) {
        if (range <= 100) return 20;
        if (range <= 500) return 50;
        if (range <= 1000) return 100;
        if (range <= 2500) return 250;
        return 500;
    }

    // Generate Y-axis labels
    generateYAxisLabels(minValue, maxValue, increment) {
        const labels = [];

        // Find the first label below or at minValue
        const firstLabel = Math.floor(minValue / increment) * increment;

        // Find the last label above or at maxValue
        const lastLabel = Math.ceil(maxValue / increment) * increment;

        // Generate labels from first to last
        for (let v = firstLabel; v <= lastLabel; v += increment) {
            labels.push(v);
        }

        // Ensure we have at least 0 in the labels if range crosses zero
        if (minValue < 0 && maxValue > 0 && !labels.includes(0)) {
            labels.push(0);
            labels.sort((a, b) => a - b);
        }

        return labels;
    }

    // Build the SVG path for the line chart
    buildLinePath(data, xScale, yScale, marginTop) {
        if (data.length === 0) return '';

        // Start at first point
        const firstX = xScale(0);
        const firstY = marginTop + yScale(data[0].cumulative_profit);
        let path = `M ${firstX} ${firstY}`;

        // Draw line through all data points
        for (let i = 1; i < data.length; i++) {
            const x = xScale(i);
            const y = marginTop + yScale(data[i].cumulative_profit);
            path += ` L ${x} ${y}`;
        }

        return path;
    }

    // Add chart interaction handlers
    addChartInteractions() {
        const dataPoints = document.querySelectorAll('.neo-data-point');

        dataPoints.forEach(point => {
            // Hover effects
            point.addEventListener('mouseenter', (e) => {
                const cumulativeProfit = parseFloat(e.target.getAttribute('data-cumulative-profit'));
                const sessionProfit = parseFloat(e.target.getAttribute('data-session-profit'));
                const date = e.target.getAttribute('data-date');
                const buyIn = parseFloat(e.target.getAttribute('data-buy-in'));
                const cashOut = parseFloat(e.target.getAttribute('data-cash-out'));

                // Highlight the point
                e.target.setAttribute('r', '8');
                const originalFill = e.target.style.fill || e.target.getAttribute('fill');
                e.target.setAttribute('data-original-fill', originalFill);
                e.target.style.fill = 'var(--casino-purple)';

                // Show tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'neo-chart-tooltip';

                const sessionProfitClass = sessionProfit >= 0 ? 'profit-positive' : 'profit-negative';
                const cumulativeProfitClass = cumulativeProfit >= 0 ? 'profit-positive' : 'profit-negative';

                tooltip.innerHTML = `
                    <div><strong>${this.formatDate(date)}</strong></div>
                    <div>Buy-In: $${buyIn.toFixed(2)}</div>
                    <div>Cash Out: $${cashOut.toFixed(2)}</div>
                    <div class="${sessionProfitClass}">Session: $${sessionProfit.toFixed(2)}</div>
                    <div class="${cumulativeProfitClass}"><strong>Total: $${cumulativeProfit.toFixed(2)}</strong></div>
                    <div style="margin-top: 0.5rem; font-size: 0.7rem; opacity: 0.8;">Click for session details</div>
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
                const originalFill = e.target.getAttribute('data-original-fill');
                if (originalFill) {
                    e.target.style.fill = originalFill;
                }

                // Remove tooltip
                const tooltip = document.querySelector('.neo-chart-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            });

            // Click event to navigate to session
            point.addEventListener('click', (e) => {
                const sessionId = e.target.getAttribute('data-session-id');

                // Remove tooltip
                const tooltip = document.querySelector('.neo-chart-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }

                // Navigate to session details
                if (sessionId) {
                    window.location.hash = `#session/${sessionId}`;
                }
            });
        });
    }
}
