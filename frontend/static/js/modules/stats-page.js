// Stats page module
import { staggerChildren } from './animations.js';
import { formatCurrency, formatPercent } from './formatters.js';
import { renderSkeleton, renderSkeletonPage, renderSkeletonStatGrid, showPageError } from './ui.js';
import StatsChartsController from './stats-charts.js';

export default class StatsPage {
    static skeleton() {
        let players = '';
        for (let i = 0; i < 6; i++) {
            players +=
                '<div class="neo-card">' +
                    renderSkeleton({ classes: 'skeleton-text', style: 'width: 60%;' }) +
                    renderSkeleton({ classes: 'skeleton-text', style: 'width: 80%;' }) +
                    renderSkeleton({ classes: 'skeleton-text', style: 'width: 40%;' }) +
                '</div>';
        }
        return renderSkeletonPage([
            // Title
            renderSkeleton({ style: 'width: 40%; height: 2rem; margin-bottom: 2rem;' }),
            // Stats grid (2x2)
            renderSkeletonStatGrid({ count: 4 }),
            // Chart card
            '<div class="neo-card" style="margin-bottom: 2rem;">' +
                renderSkeleton({ style: 'width: 50%; height: 1.5rem; margin-bottom: 1rem;' }) +
                renderSkeleton({ style: 'width: 100%; height: 300px;' }) +
            '</div>',
            // Leaderboard
            renderSkeleton({ style: 'width: 30%; height: 1.75rem; margin-bottom: 1.5rem;' }),
            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem;">' + players + '</div>'
        ]);
    }

    constructor(appContent, apiService) {
        this.appContent = appContent;
        this.api = apiService;
        this.chartData = null;
        this.summaryData = null;
        this.resizeTimeout = null;
        this.boundHandleResize = null;
        this.charts = new StatsChartsController({
            getChartData: () => this.chartData,
            getPlayersData: () => this.playersData
        });
    }
    
    // Load the stats page
    async load() {
        try {
            document.title = 'Stats & Awards - Gamble King';
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
            showPageError(this.appContent, {
                message: 'Could not load the statistics. ' + error.message,
                actionLabel: 'Try Again',
                onAction: () => this.load()
            });
        }
    }
    
    // Render stats content
    render() {
        const html = `
            <div class="fade-in stats-page" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
                <h2 class="page-title">🏆 Stats & Awards</h2>
                
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

        // Stagger animate stat cards and leaderboard items
        staggerChildren(this.appContent, '.neo-stat-card');
        staggerChildren(this.appContent, '.neo-leaderboard-stat');

        // Initialize charts after DOM is rendered
        setTimeout(() => {
            this.charts.initializeChart();
            this.charts.initializePieChart();
            this.setupResizeListener();
        }, 100);
    }

    // Setup resize listener for responsive charts
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
                this.charts.initializeChart();
                this.charts.initializePieChart();
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
        this.charts.destroy();
    }
    
    // Render summary statistics
    renderSummaryStats() {
        if (!this.summaryData) return '';
        
        const stats = this.summaryData;
        
        return `
            <div class="neo-stats-grid" style="margin-bottom: 2rem;">
                <div class="neo-stat-card neo-card-gold">
                    <div class="neo-stat-value">${formatCurrency(stats.total_buy_ins || 0)}</div>
                    <div class="neo-stat-label">Total Buy-ins</div>
                </div>
                <div class="neo-stat-card neo-card-green">
                    <div class="neo-stat-value">${stats.total_sessions || 0}</div>
                    <div class="neo-stat-label">Poker Sessions</div>
                </div>
                <div class="neo-stat-card neo-card-purple">
                    <div class="neo-stat-value">${formatCurrency(stats.average_session_value || 0)}</div>
                    <div class="neo-stat-label">Avg Session Value</div>
                </div>
                <div class="neo-stat-card neo-card-red">
                    <div class="neo-stat-value">-${formatCurrency(Math.abs(stats.house_loss || 0))}</div>
                    <div class="neo-stat-label">House Loss</div>
                </div>
            </div>
        `;
    }
    
    // Render main chart section
    renderChartSection() {
        if (!this.chartData || !this.chartData.data || this.chartData.data.length === 0) {
            return `
                <div class="neo-card" style="margin-bottom: 2rem; text-align: center; padding: 2rem;">
                    <h2 class="section-heading">No Data Available</h2>
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
                    <h2 class="section-heading">💰 Money Gambled Over Time</h2>
                    <div class="neo-chart-subtitle">
                        ${dateRange?.start && dateRange?.end
                            ? `${dateRange.start} - ${dateRange.end}`
                            : 'All Time'
                        } • Total: ${formatCurrency(this.chartData.total_gambled || 0)}
                    </div>
                </div>
                <div id="gambling-chart" class="neo-chart-container" style="border: none; border-radius: 0; box-shadow: none; margin: 0; padding: 0;">
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
                    <h2 class="section-heading">🎰 Money Gambled by Player</h2>
                    <div class="neo-chart-subtitle">
                        Who's contributing to the pot?
                    </div>
                    <div class="neo-chart-subtitle">
                        • Total: ${formatCurrency(totalGambled)}
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
            <h2 class="section-heading">🏅 Leaderboards</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem;">

                <div class="neo-leaderboard-stat green">
                    <div class="neo-leaderboard-stat-label">💰 Biggest Session Win</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.biggest_session_win?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${formatCurrency(data.biggest_session_win?.amount || 0)}</div>
                </div>

                <div class="neo-leaderboard-stat purple">
                    <div class="neo-leaderboard-stat-label">🔥 Highest Win Streak</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.highest_win_streak?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${data.highest_win_streak?.streak || 0} wins</div>
                </div>

                <div class="neo-leaderboard-stat gold">
                    <div class="neo-leaderboard-stat-label">📊 Highest Win Rate</div>
                    <div class="neo-leaderboard-stat-value">${formatPlayers(data.highest_win_percentage?.players)}</div>
                    <div class="neo-leaderboard-stat-subtitle">${formatPercent(data.highest_win_percentage?.percentage || 0)}
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
                    <div class="neo-leaderboard-stat-subtitle">±${formatCurrency(data.most_consistent?.std_dev || 0)}
                        <div class="neo-leaderboard-stat-explanation">Lowest variability (avg: ${formatCurrency(data.most_consistent?.avg_profit || 0)})</div>
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
                    <div class="neo-leaderboard-stat-subtitle">-${formatCurrency(Math.abs(data.biggest_session_loss?.amount || 0))}</div>
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
                    <div class="neo-leaderboard-stat-subtitle">${formatPercent(data.best_attendance?.percentage || 0)}
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

}
