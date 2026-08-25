// Pure HTML renderers for the session detail page — no DOM access, no state.
// Kept out of session-detail-page.js so the page module stays an orchestration
// layer. Styling: css/styles/components/_cards.css (player chips), _charts.css
// (log stat cards), plus inline styles mirroring the original markup.
import { formatCurrency } from './formatters.js';
import { escapeHtml, renderAwardCard, renderEmptyState } from './ui.js';

// Render the chip-distribution block for an active session's buy-in.
export function renderChipDistribution(session) {
    if (!session || !session.session_info || !session.session_info.chip_distribution) {
        return `<div class="neo-card" style="margin-bottom: 2rem;">
            <h3 class="section-heading">🎰 Chip Distribution</h3>
            ${renderEmptyState({ icon: '🎰', message: 'No chip distribution data available.', card: false })}
        </div>`;
    }

    // Get chip distribution from session data
    const chipDistribution = session.session_info.chip_distribution;
    const buyInValue = session.session_info.default_buy_in_value || 20.00;
    const totalChips = session.session_info.total_chips || Object.values(chipDistribution).reduce((sum, count) => sum + count, 0);

    console.log("Chip distribution data:", chipDistribution);
    console.log("Buy-in value:", buyInValue);
    console.log("Total chips:", totalChips);

    // Define colors for styling with neobrutalist approach
    const chipColors = {
        'Black': '#1F2937',
        'Blue': '#1E3A8A',
        'Green': '#065F46',
        'Red': '#991B1B',
        'White': '#F9FAFB'
    };

    // Sort chips by value (highest first)
    const chipOrder = ['Black', 'Blue', 'Green', 'Red', 'White'];

    let html = `
        <div class="neo-card neo-card-purple" style="margin-bottom: 2rem;">
            <h3 class="section-heading" style="color: var(--casino-purple-dark);">🎰 Chip Distribution</h3>
            <p style="font-weight: 600; color: var(--casino-purple-dark); margin-bottom: 1.5rem;">
                For a buy-in of <span style="color: var(--casino-green); font-weight: 600;">${formatCurrency(buyInValue)}</span>, 
                use the following chip distribution (<span style="color: var(--casino-gold); font-weight: 600;">${totalChips} total chips</span>):
            </p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">`;

    // Create a chip element for each type
    for (const chipColor of chipOrder) {
        if (chipDistribution[chipColor] && chipDistribution[chipColor] > 0) {
            const backgroundColor = chipColors[chipColor];
            const textColor = ['White'].includes(chipColor) ? '#000000' : '#FFFFFF';

            html += `
                <div style="
                    width: 80px; 
                    height: 80px; 
                    border-radius: 50%; 
                    background-color: ${backgroundColor}; 
                    color: ${textColor}; 
                    border: 1px solid var(--border-color);
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center;
                    font-weight: 600;
                    text-align: center;
                    box-shadow: var(--neo-shadow-md);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="font-size: 1rem; line-height: 1;">${chipDistribution[chipColor]}</div>
                    <div style="font-size: 0.65rem; margin-top: 0.125rem;">${chipColor}</div>
                    
                    <!-- Chip texture lines -->
                    <div style="
                        position: absolute;
                        top: 10px; left: 10px; right: 10px; bottom: 10px;
                        border: 2px dashed ${textColor === '#FFFFFF' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'};
                        border-radius: 50%;
                    "></div>
                </div>`;
        }
    }

    html += `
            </div>
        </div>`;

    return html;
}

/**
 * Hand statistics from an imported PokerNow log.
 *
 * Only sessions created through the import flow have these; everything
 * else renders nothing at all rather than an empty shell.
 */
export function renderLogStats(session) {
    const stats = session.logStats;
    if (!stats || !stats.summary) return '';

    const summary = stats.summary;
    const players = (stats.players || []).filter(p => p.hands_dealt > 0);
    const awards = stats.awards || [];
    const minutes = summary.duration_minutes || 0;
    const duration = minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;

    const headline = [
        ['🃏', summary.hands_played || 0, 'Hands'],
        ['⏱️', duration, 'Played'],
        ['💰', formatCurrency(summary.biggest_pot || 0), 'Biggest Pot'],
        ['🤝', summary.showdowns || 0, 'Showdowns']
    ].map(([icon, value, label]) => `
        <div class="neo-stat-card">
            <div style="font-size: 1.25rem;">${icon}</div>
            <div class="neo-stat-value" style="font-size: 1.25rem;">${value}</div>
            <div class="neo-stat-label">${label}</div>
        </div>
    `).join('');

    const rows = players.map(player => {
        const biggest = player.biggest_pot;
        const name = player.player_id
            ? `<a href="#player/${escapeHtml(player.player_id)}" class="player-name-link">${escapeHtml(player.player_name || player.name)}</a>`
            : escapeHtml(player.player_name || player.name);
        return `
            <tr>
                <td>${name}</td>
                <td>${player.hands_dealt}</td>
                <td>${player.hands_won}</td>
                <td>${player.vpip}%</td>
                <td>${player.pfr}%</td>
                <td>${player.aggression_factor === null ? '—' : player.aggression_factor}</td>
                <td>${player.showdowns_won}/${player.showdowns}</td>
                <td>${biggest ? formatCurrency(biggest.amount) : '—'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="margin-top: 2rem;">
            <h3 class="section-heading">📊 From the Log</h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
                ${headline}
            </div>

            ${awards.length ? `
                <div class="neo-card" style="margin-bottom: 1.5rem;">
                    <h4 class="section-title">🏅 Awards</h4>
                    <div class="award-grid">${awards.map(a => renderAwardCard(a)).join('')}</div>
                </div>` : ''}

            ${rows ? `
                <div class="neo-card">
                    <h4 class="section-title">Player Breakdown</h4>
                    <div class="table-responsive">
                        <table class="neo-table neo-table--dense">
                            <thead>
                                <tr>
                                    <th>Player</th><th>Hands</th><th>Won</th><th>VPIP</th>
                                    <th>PFR</th><th>Aggr.</th><th>Showdowns</th><th>Big Pot</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <p class="log-stat-help">
                        <strong>VPIP</strong> is how often they put money in before the flop,
                        <strong>PFR</strong> how often they raised it, and <strong>Aggr.</strong>
                        is bets and raises per call — above 1 is aggressive, below is passive.
                    </p>
                </div>` : ''}
        </div>
    `;
}

export function renderPlayerCard(player, sessionData, isActive) {
    const buyIn = player.buyIn || 0;
    const cashOut = player.cashOut || 0;
    const profit = cashOut - buyIn;
    const isCashedOut = !!player.isCashedOut;
    const profitColor = isCashedOut ? (profit >= 0 ? 'neo-card-green' : 'neo-card-primary') : '';

    return `
        <div class="neo-card ${profitColor} clickable-player-details" data-player-id="${player.id}" style="cursor: pointer; padding: 1rem;${isActive && !isCashedOut ? ' border-left: 3px solid var(--casino-gold); opacity: 0.85;' : ''}">
            <!-- Name + Profit header row -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; row-gap: 0.25rem; margin-bottom: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h4 style="font-size: 1.125rem; font-weight: 600; margin: 0;">
                        <a href="#player/${player.id}" style="color: inherit; text-decoration: none;">${player.name}</a>
                        ${player.id === sessionData.wisdom_player_id ? ' 🗣️' : ''}
                    </h4>
                    ${isActive ? `
                        <span style="display: inline-block; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.03em; ${isCashedOut ? 'background: rgba(16, 185, 129, 0.15); color: var(--casino-green-dark);' : 'background: rgba(245, 158, 11, 0.15); color: var(--casino-gold-dark);'}">
                            ${isCashedOut ? '✓ Cashed Out' : 'In Play'}
                        </span>
                    ` : ''}
                </div>
                <span class="stat-value-lg ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">${formatCurrency(profit)}</span>
            </div>

            <!-- Stats grid: Buy-in, Cash-out, 7-2 Wins, Strikes -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; text-align: center;">
                <div>
                    <div class="stat-label stat-label--sm">Buy-in</div>
                    <div class="player-card-value" style="color: var(--casino-red);">${formatCurrency(buyIn)}</div>
                </div>
                <div>
                    <div class="stat-label stat-label--sm">Cash-out</div>
                    <div class="player-card-value" style="color: var(--casino-gold);">${formatCurrency(cashOut)}</div>
                </div>
                <div>
                    <div class="stat-label stat-label--sm">7-2 Wins</div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                        ${isActive ? `
                            <button class="session-counter-btn session-counter-btn--gold session-counter-btn--decrement seven-two-decrement-btn" data-player-id="${player.id}" aria-label="Decrease 7-2 wins">−</button>
                        ` : ''}
                        <span class="player-card-value" style="color: var(--casino-gold); min-width: 1.25rem;">${player.sevenTwoWins || 0}</span>
                        ${isActive ? `
                            <button class="session-counter-btn session-counter-btn--gold seven-two-increment-btn" data-player-id="${player.id}" aria-label="Increase 7-2 wins">+</button>
                        ` : ''}
                    </div>
                </div>
                <div>
                    <div class="stat-label stat-label--sm">Strikes</div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                        ${isActive ? `
                            <button class="session-counter-btn session-counter-btn--red session-counter-btn--decrement strikes-decrement-btn" data-player-id="${player.id}" aria-label="Decrease strikes">−</button>
                        ` : ''}
                        <span class="player-card-value" style="color: var(--casino-red); min-width: 1.25rem;">${player.strikes || 0}</span>
                        ${isActive ? `
                            <button class="session-counter-btn session-counter-btn--red strikes-increment-btn" data-player-id="${player.id}" aria-label="Increase strikes">+</button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Action Button -->
            ${isActive ? `
                <div style="margin-top: 0.75rem;">
                    ${player.isCashedOut ?
                        `<button class="neo-btn neo-btn-green buy-in-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}" style="width: 100%; padding: 0.75rem 1rem;">💰 Buy In</button>` :
                        `<div style="display: flex; gap: 0.5rem;">
                            <button class="neo-btn neo-btn-green rebuy-player-btn" data-player-id="${player.id}" style="flex: 1; padding: 0.75rem 1rem;">🔄 Re-buy</button>
                            <button class="neo-btn neo-btn-gold cash-out-player-btn" data-player-id="${player.id}" data-is-cashed-out="${player.isCashedOut}" style="flex: 1; padding: 0.75rem 1rem;">💸 Cash Out</button>
                        </div>`
                    }
                </div>
            ` : ''}
        </div>
    `;
}

// Inner HTML for the players list container (the .players grid).
export function renderPlayersListHTML(session, isActive) {
    const sessionData = session.session_info || session;
    let html = '';

    if (session.players && session.players.length > 0) {
        // Sort players: complete sessions by profit desc, active by alpha with cashed-out at bottom
        const sortedPlayers = [...session.players];
        if (isActive) {
            sortedPlayers.sort((a, b) => {
                if (a.isCashedOut !== b.isCashedOut) return a.isCashedOut ? 1 : -1;
                return a.name.localeCompare(b.name);
            });
        } else {
            sortedPlayers.sort((a, b) => ((b.cashOut || 0) - (b.buyIn || 0)) - ((a.cashOut || 0) - (a.buyIn || 0)));
        }

        html += `<div style="display: grid;">`;
        sortedPlayers.forEach(player => {
            html += renderPlayerCard(player, sessionData, isActive);
        });
        html += `</div>`;
    } else {
        html += `
            ${renderEmptyState({ icon: '👤', message: 'No players in this session yet.' })}
        `;
    }

    return html;
}
