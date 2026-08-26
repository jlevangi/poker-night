// Pure SVG geometry builders for the stats page charts.
// No DOM access, no page state: inputs are data plus scale functions,
// so these can be tested with node directly.
import { formatCurrency, formatPercent } from './formatters.js';
import { escapeHtml } from './ui.js';

// Build the SVG path for the line chart
export function buildLinePath(data, xScale, yScale, marginTop) {
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

// Create SVG path for pie slice
// slice: { value, percentage } supplies the data-* attributes;
// pass null when only geometry is needed.
export function createPieSlice({ cx, cy, radius, innerRadius, startAngle, endAngle, color, name = '', slice = null }) {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z'
    ].join(' ');

    const playerValue = slice ? formatCurrency(slice.value) : '0.00';
    const playerPercentage = slice ? formatPercent(slice.percentage) : '0.0%';

    return `<path d="${pathData}"
                      fill="${color}"
                      stroke="var(--bg-card)"
                      stroke-width="3"
                      filter="url(#pieSliceShadow)"
                      class="neo-pie-slice"
                      data-player-name="${escapeHtml(name)}"
                      data-player-value="${playerValue}"
                      data-player-percentage="${playerPercentage}" />`;
}
