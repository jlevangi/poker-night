"""
Dashboard routes for Poker Night PWA.

This module contains dashboard-related API endpoints.
"""

import logging
from typing import Dict, Any
from flask import Blueprint, jsonify

from ..services.database_service import DatabaseService

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/dashboard', methods=['GET'])
def get_dashboard_api() -> Dict[str, Any]:
    """
    Get dashboard data including total players, sessions, and recent activity.
    
    Returns:
        JSON response with dashboard statistics
    """
    try:
        db_service = DatabaseService()
        
        # Get basic counts
        players = db_service.get_all_players()
        sessions = db_service.get_all_sessions()
        
        # Get recent active session if any
        active_sessions = [s for s in sessions if s.is_active]
        
        # Calculate some basic stats
        total_entries = 0
        total_buy_ins = 0.0
        total_payouts = 0.0
        
        for session in sessions:
            session_details = db_service.get_session_by_id(session.session_id)
            if session_details and hasattr(session_details, 'entries'):
                entries = session_details.entries or []
                total_entries += len(entries)
                total_buy_ins += sum(entry.total_buy_in_amount for entry in entries)
                total_payouts += sum(entry.payout for entry in entries)
        
        dashboard_data = {
            "total_players": len(players),
            "total_sessions": len(sessions),
            "active_sessions": len(active_sessions),
            "total_entries": total_entries,
            "total_buy_ins": total_buy_ins,
            "total_payouts": total_payouts,
            "recent_sessions": [s.to_dict() for s in sessions[:5]]  # Last 5 sessions
        }
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        logger.error(f"Error loading dashboard data: {str(e)}")
        return jsonify({"error": "Failed to load dashboard data"}), 500