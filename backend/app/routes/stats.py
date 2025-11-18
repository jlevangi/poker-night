# Stats API endpoints
from flask import Blueprint, jsonify
from app.services.database_service import DatabaseService
from datetime import datetime

stats_bp = Blueprint('stats', __name__)
database_service = DatabaseService()

@stats_bp.route('/api/stats/summary', methods=['GET'])
def get_stats_summary():
    """Get overall statistics summary"""
    try:
        # Get all sessions for calculations
        sessions = database_service.get_all_sessions()
        
        if not sessions:
            return jsonify({
                'total_buy_ins': 0,
                'total_payouts': 0,
                'total_sessions': 0,
                'total_players': 0,
                'average_session_value': 0,
                'house_loss': 0
            })
        
        # Calculate totals from all entries across all sessions
        total_buy_ins = 0
        total_payouts = 0
        all_players = set()
        
        for session in sessions:
            entries = database_service.get_entries_for_session(session.session_id)
            for entry in entries:
                # Add up buy-ins and payouts from entry data
                total_buy_ins += entry.total_buy_in_amount or 0
                total_payouts += entry.payout or 0
                all_players.add(entry.player_id)
        
        # Calculate house loss as payouts minus buy-ins (negative means house wins)
        house_loss = total_payouts - total_buy_ins if total_buy_ins > 0 else 0
        
        stats = {
            'total_buy_ins': total_buy_ins,
            'total_payouts': total_payouts,
            'total_sessions': len(sessions),
            'total_players': len(all_players),
            'average_session_value': total_buy_ins / len(sessions) if sessions else 0,
            'house_loss': house_loss
        }
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stats_bp.route('/api/stats/leaderboards', methods=['GET'])
def get_leaderboard_stats():
    """Get leaderboard statistics"""
    try:
        # Get all sessions and entries for calculations
        sessions = database_service.get_all_sessions()
        
        if not sessions:
            return jsonify({
                'biggest_session_win': {'amount': 0, 'players': [], 'session': None},
                'biggest_session_loss': {'amount': 0, 'players': [], 'session': None},
                'highest_win_streak': {'streak': 0, 'players': []},
                'most_games_played': {'games': 0, 'players': []},
                'highest_win_percentage': {'percentage': 0, 'players': [], 'games': 0}
            })
        
        # Initialize tracking variables - using lists to handle ties
        biggest_win = {'amount': 0, 'players': [], 'session': None}
        biggest_loss = {'amount': 0, 'players': [], 'session': None}  # Will track most negative profit
        
        # Player statistics tracking
        player_stats = {}
        
        for session in sessions:
            entries = database_service.get_entries_for_session(session.session_id)
            for entry in entries:
                player_id = entry.player_id
                profit = entry.profit or 0
                
                # Initialize player stats if not exists
                if player_id not in player_stats:
                    player_stats[player_id] = {
                        'games': 0,
                        'wins': 0,
                        'current_streak': 0,
                        'max_streak': 0,
                        'total_rebuys': 0,  # Track total rebuys across all sessions
                        'name': entry.player.name if entry.player else 'Unknown'
                    }
                
                # Update player game count
                player_stats[player_id]['games'] += 1
                
                # Track rebuys (buy_in_count > 1 means rebuys)
                rebuys = max(0, (entry.buy_in_count or 1) - 1)
                player_stats[player_id]['total_rebuys'] += rebuys
                
                # Check for biggest win
                player_name = entry.player.name if entry.player else 'Unknown'
                if profit > biggest_win['amount']:
                    biggest_win = {
                        'amount': profit,
                        'players': [player_name],
                        'session': session.session_id
                    }
                elif profit == biggest_win['amount'] and profit > 0:
                    if player_name not in biggest_win['players']:
                        biggest_win['players'].append(player_name)
                
                # Check for biggest loss (most negative profit)
                if profit < 0:
                    loss_amount = abs(profit)
                    if loss_amount > biggest_loss['amount']:
                        biggest_loss = {
                            'amount': loss_amount,
                            'players': [player_name],
                            'session': session.session_id
                        }
                    elif loss_amount == biggest_loss['amount'] and biggest_loss['amount'] > 0:
                        if player_name not in biggest_loss['players']:
                            biggest_loss['players'].append(player_name)
                
                # Update win/loss streaks
                if profit > 0:
                    player_stats[player_id]['wins'] += 1
                    player_stats[player_id]['current_streak'] += 1
                    player_stats[player_id]['max_streak'] = max(
                        player_stats[player_id]['max_streak'],
                        player_stats[player_id]['current_streak']
                    )
                else:
                    player_stats[player_id]['current_streak'] = 0
        
        # Find leaderboard winners - using lists to handle ties
        highest_win_streak = {'streak': 0, 'players': []}
        most_games = {'games': 0, 'players': []}
        highest_win_pct = {'percentage': 0, 'players': [], 'games': 0}
        
        for player_id, stats in player_stats.items():
            # Highest win streak
            if stats['max_streak'] > highest_win_streak['streak']:
                highest_win_streak = {
                    'streak': stats['max_streak'],
                    'players': [stats['name']]
                }
            elif stats['max_streak'] == highest_win_streak['streak'] and stats['max_streak'] > 0:
                if stats['name'] not in highest_win_streak['players']:
                    highest_win_streak['players'].append(stats['name'])
            
            # Most games played
            if stats['games'] > most_games['games']:
                most_games = {
                    'games': stats['games'],
                    'players': [stats['name']]
                }
            elif stats['games'] == most_games['games'] and stats['games'] > 0:
                if stats['name'] not in most_games['players']:
                    most_games['players'].append(stats['name'])
            
            # Highest win percentage (minimum 3 games)
            if stats['games'] >= 3:
                win_pct = (stats['wins'] / stats['games']) * 100
                if win_pct > highest_win_pct['percentage']:
                    highest_win_pct = {
                        'percentage': win_pct,
                        'players': [stats['name']],
                        'games': stats['games']
                    }
                elif abs(win_pct - highest_win_pct['percentage']) < 0.01 and win_pct > 0:  # Handle floating point precision
                    if stats['name'] not in highest_win_pct['players']:
                        highest_win_pct['players'].append(stats['name'])
        
        # Find biggest grinder (most total rebuys)
        biggest_grinder = {'rebuys': 0, 'players': []}
        for player_id, stats in player_stats.items():
            if stats['total_rebuys'] > biggest_grinder['rebuys']:
                biggest_grinder = {
                    'rebuys': stats['total_rebuys'],
                    'players': [stats['name']]
                }
            elif stats['total_rebuys'] == biggest_grinder['rebuys'] and stats['total_rebuys'] > 0:
                if stats['name'] not in biggest_grinder['players']:
                    biggest_grinder['players'].append(stats['name'])
        
        # Calculate additional advanced stats
        # Century Club - Sessions with $100+ profit
        century_club = {'sessions': 0, 'players': []}
        # Most Consistent - Lowest profit variance (min 5 games)  
        most_consistent = {'variance': float('inf'), 'players': [], 'games': 0}
        # Best Attendance - Percentage of sessions attended (min 3 games)
        best_attendance = {'percentage': 0, 'players': [], 'sessions_attended': 0, 'total_sessions': len(sessions)}
        # Longest Losing Streak
        longest_losing_streak = {'streak': 0, 'players': []}
        
        # Calculate per-player advanced stats
        player_advanced_stats = {}
        
        for session in sessions:
            entries = database_service.get_entries_for_session(session.session_id)
            for entry in entries:
                player_id = entry.player_id
                player_name = entry.player.name if entry.player else 'Unknown'
                profit = entry.profit or 0
                
                # Initialize advanced stats if needed
                if player_id not in player_advanced_stats:
                    player_advanced_stats[player_id] = {
                        'name': player_name,
                        'century_sessions': 0,
                        'all_profits': [],
                        'sessions_attended': 0,
                        'current_losing_streak': 0,
                        'max_losing_streak': 0
                    }
                
                # Track all profits for variance calculation
                player_advanced_stats[player_id]['all_profits'].append(profit)
                player_advanced_stats[player_id]['sessions_attended'] += 1
                
                # Century Club check
                if profit >= 100:
                    player_advanced_stats[player_id]['century_sessions'] += 1
                
                # Losing streak tracking
                if profit <= 0:
                    player_advanced_stats[player_id]['current_losing_streak'] += 1
                    player_advanced_stats[player_id]['max_losing_streak'] = max(
                        player_advanced_stats[player_id]['max_losing_streak'],
                        player_advanced_stats[player_id]['current_losing_streak']
                    )
                else:
                    player_advanced_stats[player_id]['current_losing_streak'] = 0
        
        # Find leaderboard winners for advanced stats
        for player_id, stats in player_advanced_stats.items():
            # Century Club (most $100+ sessions)
            if stats['century_sessions'] > century_club['sessions']:
                century_club = {
                    'sessions': stats['century_sessions'],
                    'players': [stats['name']]
                }
            elif stats['century_sessions'] == century_club['sessions'] and stats['century_sessions'] > 0:
                if stats['name'] not in century_club['players']:
                    century_club['players'].append(stats['name'])
            
            # Most Consistent (lowest coefficient of variation for players with avg profit >= -$20, min 5 games)
            if len(stats['all_profits']) >= 5:
                mean_profit = sum(stats['all_profits']) / len(stats['all_profits'])
                
                # Only consider players who aren't heavily losing on average
                if mean_profit >= -20:
                    # Calculate coefficient of variation (std dev / |mean|)
                    variance = sum((x - mean_profit) ** 2 for x in stats['all_profits']) / len(stats['all_profits'])
                    std_dev = variance ** 0.5
                    
                    # Use coefficient of variation, but handle near-zero means
                    if abs(mean_profit) < 1:
                        # For very small means, just use standard deviation
                        consistency_score = std_dev
                    else:
                        # Coefficient of variation
                        consistency_score = std_dev / abs(mean_profit)
                    
                    if consistency_score < most_consistent['variance']:
                        most_consistent = {
                            'variance': consistency_score,
                            'players': [stats['name']],
                            'games': len(stats['all_profits']),
                            'avg_profit': mean_profit,
                            'std_dev': std_dev
                        }
                    elif abs(consistency_score - most_consistent['variance']) < 0.01 and consistency_score < float('inf'):
                        if stats['name'] not in most_consistent['players']:
                            most_consistent['players'].append(stats['name'])
            
            # Best Attendance (highest percentage, min 3 games)
            if stats['sessions_attended'] >= 3 and len(sessions) > 0:
                attendance_pct = (stats['sessions_attended'] / len(sessions)) * 100
                if attendance_pct > best_attendance['percentage']:
                    best_attendance = {
                        'percentage': attendance_pct,
                        'players': [stats['name']],
                        'sessions_attended': stats['sessions_attended'],
                        'total_sessions': len(sessions)
                    }
                elif abs(attendance_pct - best_attendance['percentage']) < 0.01:
                    if stats['name'] not in best_attendance['players']:
                        best_attendance['players'].append(stats['name'])
            
            # Longest Losing Streak
            if stats['max_losing_streak'] > longest_losing_streak['streak']:
                longest_losing_streak = {
                    'streak': stats['max_losing_streak'],
                    'players': [stats['name']]
                }
            elif stats['max_losing_streak'] == longest_losing_streak['streak'] and stats['max_losing_streak'] > 0:
                if stats['name'] not in longest_losing_streak['players']:
                    longest_losing_streak['players'].append(stats['name'])
        
        return jsonify({
            'biggest_session_win': biggest_win,
            'biggest_session_loss': biggest_loss,
            'highest_win_streak': highest_win_streak,
            'most_games_played': most_games,
            'highest_win_percentage': highest_win_pct,
            'biggest_grinder': biggest_grinder,
            'century_club': century_club,
            'most_consistent': most_consistent,
            'best_attendance': best_attendance,
            'longest_losing_streak': longest_losing_streak
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stats_bp.route('/api/stats/gambling-over-time', methods=['GET'])
def get_gambling_over_time():
    """Get gambling data over time for chart visualization"""
    try:
        # Get all sessions ordered by date
        sessions = database_service.get_all_sessions()
        
        if not sessions:
            return jsonify({
                'data': [],
                'total_gambled': 0,
                'date_range': None
            })
        
        # Sort sessions by date
        sorted_sessions = sorted(sessions, key=lambda x: getattr(x, 'session_date', '') or '')
        
        # Build cumulative data for chart
        cumulative_amount = 0
        chart_data = []
        
        for session in sorted_sessions:
            # Calculate session buy-ins from entries
            entries = database_service.get_entries_for_session(session.session_id)
            session_buy_ins = sum(entry.total_buy_in_amount or 0 for entry in entries)
            cumulative_amount += session_buy_ins
            
            # Get player count for this session
            player_count = len(entries)
            
            chart_data.append({
                'session_id': session.session_id,
                'date': session.date,
                'session_amount': session_buy_ins,
                'cumulative_amount': cumulative_amount,
                'player_count': player_count
            })
        
        # Calculate date range
        date_range = None
        if chart_data:
            date_range = {
                'start': chart_data[0]['date'],
                'end': chart_data[-1]['date']
            }
        
        return jsonify({
            'data': chart_data,
            'total_gambled': cumulative_amount,
            'date_range': date_range
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
