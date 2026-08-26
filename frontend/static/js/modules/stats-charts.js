// Chart UI controller for the stats page.
// Owns both SVG charts and the session-details modal: renders the line
// chart into #gambling-chart, the pie chart into #pie-chart-container,
// wires up their hover/click interactions, and manages the
// .stats-session-modal dialog. The page constructs it in its constructor,
// calls initializeChart()/initializePieChart() after rendering and from the
// resize handler, and calls destroy() from cleanup(). It receives a context
// object of live getters ({ getChartData, getPlayersData }) so it always
// sees fresh page state after load() reassigns. It never touches page
// internals.
import { formatCurrency, formatCurrencyWhole, formatPercent } from './formatters.js';
import { buildLinePath, createPieSlice } from './stats-chart-paths.js';
import { escapeHtml, renderEmptyState } from './ui.js';

export default class StatsChartsController {
    constructor(context) {
        this.context = context;
        this.boundPieChartResetHandler = null;
    }

    // Initialize SVG area chart with neobrutalist styling
    initializeChart() {
        const chartContainer = document.getElementById('gambling-chart');

        const chartData = this.context.getChartData();

        if (!chartContainer || !chartData || !chartData.data) {
            return;
        }

        const data = chartData.data;

        if (data.length === 0) {
            chartContainer.innerHTML = renderEmptyState({ icon: '📊', message: 'No data to display', card: false });
            return;
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
        const width = containerWidth - margin.left - margin.right - (padding * 2); // Account for circle padding
        const height = Math.max(250, Math.min(500, containerWidth * 0.4)) - margin.top - margin.bottom;

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
                        return `<div style="position: absolute; top: ${y}px; right: ${labelRightMargin}; transform: translateY(-50%); font-size: ${labelFontSize}; font-weight: 700; color: var(--text-secondary);">${formatCurrencyWhole(value)}</div>`;
                    }).join('')}
                </div>

                <!-- Chart area -->
                <div style="flex: 1; border-left: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); position: relative;">
                    <svg width="${width + padding * 2}" height="${height + margin.top + 10}" style="display: block; overflow: visible;">
                        <!-- Grid lines -->
                        <g>
                            ${yLabels.map(value => {
                                const y = margin.top + yScale(value);
                                return `<line x1="${padding}" y1="${y}" x2="${width + padding}" y2="${y}" stroke="var(--text-muted)" stroke-width="1" opacity="0.3" />`;
                            }).join('')}
                        </g>

                        <!-- Line -->
                        <path d="${buildLinePath(data, xScale, yScale, margin.top)}"
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
                                        stroke="var(--casino-green-dark)"
                                        stroke-width="1.5"
                                        class="neo-data-point"
                                        data-session-id="${point.session_id}"
                                        data-date="${point.date}"
                                        data-session-amount="${formatCurrency(point.session_amount)}"
                                        data-value="${formatCurrency(point.cumulative_amount)}"
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
        const existingModal = document.querySelector('.modal-overlay.stats-session-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Shared dialog chrome (components/_modals.css); content stays stats-owned
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay stats-session-modal';
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🃏 Session Details</h3>
                    <button class="modal-close-btn" type="button" aria-label="Close session details">&times;</button>
                </div>
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
        `;

        // Add modal to DOM
        document.body.appendChild(modalOverlay);
        requestAnimationFrame(() => requestAnimationFrame(() => modalOverlay.classList.add('active')));

        // Add event listeners for closing
        const closeButtons = modalOverlay.querySelectorAll('.modal-close-btn');
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

        const playersData = this.context.getPlayersData();

        if (!pieContainer || !playersData) {
            return;
        }

        // Filter players with buy-ins > 0 and sort by total buy-ins (descending)
        const playersWithBuyIns = playersData
            .filter(p => p.total_buy_ins_value > 0)
            .sort((a, b) => b.total_buy_ins_value - a.total_buy_ins_value);

        if (playersWithBuyIns.length === 0) {
            pieContainer.innerHTML = renderEmptyState({ icon: '📊', message: 'No data to display', card: false });
            return;
        }

        const totalGambled = playersWithBuyIns.reduce((sum, p) => sum + p.total_buy_ins_value, 0);

        // Color palette for pie slices
        const colors = [
            '#22C55E',
            '#3B82F6',
            '#F59E0B',
            '#EF4444',
            '#8B5CF6',
            '#14B8A6',
            '#F97316',
            '#EC4899',
            '#06B6D4',
            '#84CC16',
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
        const size = 420;
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 24;
        const innerRadius = 92;
        // Build SVG
        let currentAngle = -90; // Start at top
        const slicePaths = slices.map((slice, index) => {
            const angle = (slice.percentage / 100) * 360;
            const path = createPieSlice({
                cx: centerX,
                cy: centerY,
                radius: radius,
                innerRadius: innerRadius,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                color: slice.color,
                name: slice.name,
                slice: slice
            });
            currentAngle += angle;
            return path;
        });

        // Create legend items in a responsive grid
        const topLegendItems = slices.filter(s => s.isTopPlayer).map((slice, index) => `
            <div class="neo-pie-legend-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-card);">
                <div class="neo-pie-legend-swatch" style="background: ${slice.color}; flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.75rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(slice.name)}</div>
                    <div class="neo-pie-legend-meta">${formatCurrency(slice.value)} • ${formatPercent(slice.percentage)}</div>
                </div>
            </div>
        `).join('');

        // Create "Everyone Else" section if applicable
        const everyoneElseItem = otherPlayers.length > 0 ? `
            <div class="neo-pie-legend-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-card); cursor: pointer;" id="everyone-else-item">
                <div class="neo-pie-legend-swatch" style="background: #6B7280; flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.75rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Everyone Else (${otherPlayers.length})</div>
                    <div class="neo-pie-legend-meta">${formatCurrency(otherPlayers.reduce((sum, p) => sum + p.total_buy_ins_value, 0))} • ${formatPercent((otherPlayers.reduce((sum, p) => sum + p.total_buy_ins_value, 0) / totalGambled) * 100)}</div>
                </div>
                <div class="everyone-else-arrow" style="font-weight: 600; color: var(--casino-purple-dark); font-size: 1rem;">▼</div>
            </div>
        ` : '';

        const everyoneElseExpanded = otherPlayers.length > 0 ? `
            <!-- Expandable list of everyone else -->
            <div id="everyone-else-expanded" style="display: none; margin-top: 0.5rem; padding: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-content); border-radius: var(--radius-lg); grid-column: 1 / -1;">
                ${otherPlayers.map((player, idx) => `
                    <div class="neo-pie-expanded-row" style="display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem; border-bottom: ${idx < otherPlayers.length - 1 ? '1px solid var(--border-light)' : 'none'};">
                        <span style="font-weight: 700; font-size: 0.75rem; color: var(--text-primary);">${escapeHtml(player.name)}</span>
                        <span class="neo-pie-legend-meta">${formatCurrency(player.total_buy_ins_value)} • ${formatPercent((player.total_buy_ins_value / totalGambled) * 100)}</span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        pieContainer.innerHTML = `
            <div class="neo-pie-chart-layout">
                <!-- Pie Chart SVG -->
                <div class="neo-pie-chart-canvas">
                    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block;">
                        <defs>
                            <filter id="pieSliceShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(15,23,42,0.12)"/>
                            </filter>
                        </defs>
                        ${slicePaths.join('')}
                    </svg>
                    <div class="neo-pie-chart-center" data-default-label="Total Gambled" data-default-value="${formatCurrency(totalGambled)}" data-default-subtitle="${playersWithBuyIns.length} players">
                        <div id="pie-chart-center-label" class="neo-pie-chart-center-label">Total Gambled</div>
                        <div id="pie-chart-center-value" class="neo-pie-chart-center-value">${formatCurrency(totalGambled)}</div>
                        <div id="pie-chart-center-subtitle" class="neo-pie-chart-center-subtitle">${playersWithBuyIns.length} players</div>
                    </div>
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
        const center = document.getElementById('pie-chart-center-label')?.parentElement;

        if (!pieChartSvg || !center) return;

        const resetCenter = () => {
            const defaultLabel = center.getAttribute('data-default-label') || '';
            const defaultValue = center.getAttribute('data-default-value') || '';
            const defaultSubtitle = center.getAttribute('data-default-subtitle') || '';

            const labelEl = document.getElementById('pie-chart-center-label');
            const valueEl = document.getElementById('pie-chart-center-value');
            const subtitleEl = document.getElementById('pie-chart-center-subtitle');

            if (labelEl) labelEl.textContent = defaultLabel;
            if (valueEl) valueEl.textContent = defaultValue;
            if (subtitleEl) subtitleEl.textContent = defaultSubtitle;

            pieSlices.forEach(slice => slice.classList.remove('active'));
        };

        pieSlices.forEach(slice => {
            slice.addEventListener('click', (e) => {
                e.stopPropagation();

                const playerName = e.target.getAttribute('data-player-name');
                const playerValue = e.target.getAttribute('data-player-value');
                const playerPercentage = e.target.getAttribute('data-player-percentage');

                const labelEl = document.getElementById('pie-chart-center-label');
                const valueEl = document.getElementById('pie-chart-center-value');
                const subtitleEl = document.getElementById('pie-chart-center-subtitle');

                if (labelEl) labelEl.textContent = playerName;
                if (valueEl) valueEl.textContent = `$${playerValue}`;
                if (subtitleEl) subtitleEl.textContent = `${playerPercentage}% of total`;

                pieSlices.forEach(otherSlice => otherSlice.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        if (this.boundPieChartResetHandler) {
            document.removeEventListener('click', this.boundPieChartResetHandler);
        }

        this.boundPieChartResetHandler = (e) => {
            if (!e.target.closest('.neo-pie-slice')) {
                resetCenter();
            }
        };

        document.addEventListener('click', this.boundPieChartResetHandler);
    }

    // Remove the document-level outside-click listener added by
    // addPieSliceInteractions. The page calls this from cleanup(); the
    // handler would only reference removed DOM afterwards, but removing it
    // keeps the document clean across keep-alive page switches.
    destroy() {
        if (this.boundPieChartResetHandler) {
            document.removeEventListener('click', this.boundPieChartResetHandler);
            this.boundPieChartResetHandler = null;
        }
    }
}
