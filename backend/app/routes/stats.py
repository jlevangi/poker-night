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
        
        total_buy_ins = sum(getattr(session, 'total_buy_ins', 0) or 0 for session in sessions)
        total_payouts = sum(getattr(session, 'total_payouts', 0) or 0 for session in sessions)
        
        # Get unique player count
        all_players = set()
        for session in sessions:
            entries = database_service.get_entries_for_session(session.session_id)
            for entry in entries:
                all_players.add(entry.player_id)
        
        # Calculate house loss as payouts over buy-ins (negative means house wins)
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
            buy_ins = getattr(session, 'total_buy_ins', 0) or 0
            cumulative_amount += buy_ins
            
            # Get player count for this session
            entries = database_service.get_entries_for_session(session.session_id)
            player_count = len(entries)
            
            chart_data.append({
                'session_id': session.session_id,
                'date': getattr(session, 'session_date', '') or '',
                'session_amount': buy_ins,
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
