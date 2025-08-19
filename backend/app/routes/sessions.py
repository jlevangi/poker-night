"""
Session routes for Poker Night PWA.

This module contains all session-related API endpoints.
"""

import logging
from typing import Dict, Any
from datetime import datetime
from flask import Blueprint, jsonify, request

from ..services.database_service import DatabaseService

logger = logging.getLogger(__name__)

# Import chip calculator from scripts directory
try:
    from scripts.chip_calculator import calculate_chip_distribution
except ImportError:
    try:
        # Fallback: try importing from current path (if scripts dir was added to sys.path)
        from chip_calculator import calculate_chip_distribution
    except ImportError:
        logger.warning("Could not import chip_calculator. Chip distribution functionality may not work.")
        
        def calculate_chip_distribution(buy_in: float) -> Dict[str, int]:
            """Fallback function if chip_calculator is not available."""
            return {}
sessions_bp = Blueprint('sessions', __name__)


@sessions_bp.route('/sessions', methods=['GET'])
def get_sessions_api() -> Dict[str, Any]:
    """
    Get all sessions.
    
    Returns:
        JSON response with list of all sessions
    """
    db_service = DatabaseService()
    sessions = db_service.get_all_sessions()
    return jsonify([session.to_dict() for session in sessions])


@sessions_bp.route('/sessions/active', methods=['GET'])
def get_active_sessions_api() -> Dict[str, Any]:
    """
    Get all active sessions.
    
    Returns:
        JSON response with list of active sessions
    """
    db_service = DatabaseService()
    sessions = db_service.get_active_sessions()
    return jsonify([session.to_dict() for session in sessions])


@sessions_bp.route('/sessions', methods=['POST'])
def create_session_api() -> Dict[str, Any]:
    """
    Create a new session.
    
    Returns:
        JSON response with created session or error message
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    date_str = data.get('date')
    buy_in_value = data.get('default_buy_in_value', 20.00)
    
    if not date_str or not isinstance(date_str, str):
        return jsonify({"error": "Date is required and must be a string"}), 400
    
    # Validate date format
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    
    try:
        buy_in_float = float(buy_in_value)
        if buy_in_float <= 0 or buy_in_float > 10000:
            return jsonify({"error": "Buy-in value must be between 0.01 and 10000"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid buy-in value"}), 400
    
    # Calculate chip distribution for the session
    chip_distribution = calculate_chip_distribution(buy_in_float)
    
    # Create the session
    db_service = DatabaseService()
    session = db_service.create_session(date_str, buy_in_float)
    if session:
        # Add chip distribution to the session data
        if chip_distribution:
            session.chip_distribution = chip_distribution
            # Calculate total chip count for convenience
            session.total_chips = sum(chip_distribution.values())
            
            # Update the session in the data store to persist the chip distribution
            db_service.update_session(session.session_id, session)
            
            logger.info(f"Session created with ID: {session.session_id}")
        
        return jsonify(session.to_dict()), 201
    return jsonify({"error": "Failed to create session"}), 500


@sessions_bp.route('/sessions/<string:session_id>', methods=['GET'])
def get_session_details_api(session_id: str) -> Dict[str, Any]:
    """
    Get details for a specific session.
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response with session details and entries
    """
    db_service = DatabaseService()
    session = db_service.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    entries = db_service.get_entries_for_session(session_id)
    
    # Check if chip distribution is already in the session data
    # If not, calculate it based on the session's buy-in value
    if session.chip_distribution is None:
        chip_distribution = calculate_chip_distribution(session.default_buy_in_value)
        if chip_distribution:
            session.chip_distribution = chip_distribution
            session.total_chips = sum(chip_distribution.values())
            
            # Save the updated session with chip distribution
            db_service.update_session(session.session_id, session)
    
    # Prepare response
    response_data = {
        "session_info": session.to_dict(), 
        "entries": [entry.to_dict() for entry in entries]
    }
    
    return jsonify(response_data)


@sessions_bp.route('/sessions/<string:session_id>/end', methods=['PUT'])
def end_session_api(session_id: str) -> Dict[str, Any]:
    """
    End a session.
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response with success message or error
    """
    db_service = DatabaseService()
    if db_service.end_session(session_id):
        return jsonify({"message": "Session ended successfully"})
    return jsonify({"error": "Failed to end session or session not found"}), 404


@sessions_bp.route('/sessions/<string:session_id>/reactivate', methods=['PUT'])
def reactivate_session_api(session_id: str) -> Dict[str, Any]:
    """
    Reactivate a session.
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response with success message or error
    """
    db_service = DatabaseService()
    if db_service.reactivate_session(session_id):
        return jsonify({"message": "Session reactivated successfully"})
    return jsonify({"error": "Failed to reactivate session or session not found"}), 404


@sessions_bp.route('/sessions/<string:session_id>/delete', methods=['DELETE'])
def delete_session_api(session_id: str) -> Dict[str, Any]:
    """
    Delete (archive) a session.
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response with success message or error
    """
    db_service = DatabaseService()
    
    # First check if the session exists
    session = db_service.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    # Check if session is active - can't delete active sessions
    if session.is_active:
        return jsonify({"error": "Cannot delete an active session. End the session first."}), 400
    
    # TODO: Implement session deletion/archiving logic
    # For now, return a placeholder response
    return jsonify({"error": "Session deletion not yet implemented"}), 501


@sessions_bp.route('/sessions/<string:session_id>/entries', methods=['POST'])
def add_player_to_session_api(session_id: str) -> Dict[str, Any]:
    """
    Add a player entry to a session.
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response with all session entries or error message
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    player_id = data.get('player_id')
    num_buy_ins_str = data.get('num_buy_ins', "1")
    
    if not player_id or not isinstance(player_id, str):
        return jsonify({"error": "Player ID is required and must be a string"}), 400
    
    # Validate session_id format
    if not session_id or not isinstance(session_id, str):
        return jsonify({"error": "Invalid session ID"}), 400
    
    try:
        num_buy_ins = int(num_buy_ins_str)
        if num_buy_ins <= 0 or num_buy_ins > 100:
            return jsonify({"error": "Number of buy-ins must be between 1 and 100"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid number of buy-ins"}), 400
    
    db_service = DatabaseService()
    entry = db_service.record_player_entry(session_id, player_id, num_buy_ins)
    if entry:
        all_entries = db_service.get_entries_for_session(session_id)
        return jsonify([entry.to_dict() for entry in all_entries]), 201
    
    # Check for specific errors
    session_check = db_service.get_session_by_id(session_id)
    if not session_check:
        return jsonify({"error": f"Session {session_id} not found."}), 404
    player_check = db_service.get_player_by_id(player_id)
    if not player_check:
        return jsonify({"error": f"Player {player_id} not found."}), 404
    return jsonify({"error": "Failed to add player entry for an unknown reason"}), 500


@sessions_bp.route('/sessions/<string:session_id>/entries/<string:player_id>/remove-buyin', methods=['PUT'])
def remove_buyin_api(session_id: str, player_id: str) -> Dict[str, Any]:
    """
    Remove a buy-in from a player in a session.
    
    Args:
        session_id: Session's unique identifier
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated session entries or error message
    """
    db_service = DatabaseService()
    result = db_service.remove_buy_in(session_id, player_id)
    if result is not None:
        # Return all entries to refresh the UI
        all_entries = db_service.get_entries_for_session(session_id)
        return jsonify([entry.to_dict() for entry in all_entries])
    
    # Check for specific errors
    session_check = db_service.get_session_by_id(session_id)
    if not session_check:
        return jsonify({"error": f"Session {session_id} not found."}), 404
    if not session_check.is_active:
        return jsonify({"error": f"Session {session_id} is not active."}), 400
    player_check = db_service.get_player_by_id(player_id)
    if not player_check:
        return jsonify({"error": f"Player {player_id} not found."}), 404
    
    return jsonify({"error": "Failed to remove buy-in. Player may not have any buy-ins in this session."}), 400


@sessions_bp.route('/sessions/<string:session_id>/entries/<string:player_id>/payout', methods=['PUT'])
def record_payout_api(session_id: str, player_id: str) -> Dict[str, Any]:
    """
    Record a payout for a player in a session.
    
    Args:
        session_id: Session's unique identifier
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated session entries or error message
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    payout_amount_str = data.get('payout_amount')
    if payout_amount_str is None:
        return jsonify({"error": "Payout amount is required"}), 400
    
    # Validate IDs
    if not session_id or not isinstance(session_id, str):
        return jsonify({"error": "Invalid session ID"}), 400
    if not player_id or not isinstance(player_id, str):
        return jsonify({"error": "Invalid player ID"}), 400
    
    try:
        payout_amount = float(payout_amount_str)
        if payout_amount < 0 or payout_amount > 100000:
            return jsonify({"error": "Payout amount must be between 0 and 100000"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid payout amount format"}), 400
    
    db_service = DatabaseService()
    if db_service.record_payout(session_id, player_id, payout_amount):
        all_entries = db_service.get_entries_for_session(session_id)
        return jsonify([entry.to_dict() for entry in all_entries])
    
    # Check for specific errors
    entries = db_service.get_entries_for_session(session_id)
    entry_check = any(e.player_id == player_id for e in entries)
    if not entry_check:
        return jsonify({"error": f"Player {player_id} not found in session {session_id}"}), 404
    return jsonify({"error": "Failed to record payout for an unknown reason"}), 500


@sessions_bp.route('/sessions/<string:session_id>/players/<string:player_id>/seven-two-wins/increment', methods=['PUT'])
def increment_session_seven_two_wins_api(session_id: str, player_id: str) -> Dict[str, Any]:
    """
    Increment session-specific 7-2 wins for a player.
    
    Args:
        session_id: Session's unique identifier
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated session entries or error message
    """
    if not session_id or not player_id:
        return jsonify({"error": "Session ID and Player ID are required"}), 400
    
    db_service = DatabaseService()
    
    # Check if session and player exist
    session = db_service.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    player = db_service.get_player_by_id(player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404
    
    try:
        if db_service.increment_session_seven_two_wins(session_id, player_id):
            # Return updated session entries
            updated_entries = db_service.get_entries_for_session(session_id)
            return jsonify([entry.to_dict() for entry in updated_entries])
        return jsonify({"error": "Failed to increment session 7-2 wins count"}), 500
    except Exception as e:
        logger.error(f"Error incrementing session 7-2 wins for player {player_id} in session {session_id}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@sessions_bp.route('/sessions/<string:session_id>/players/<string:player_id>/seven-two-wins/decrement', methods=['PUT'])
def decrement_session_seven_two_wins_api(session_id: str, player_id: str) -> Dict[str, Any]:
    """
    Decrement session-specific 7-2 wins for a player.
    
    Args:
        session_id: Session's unique identifier
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated session entries or error message
    """
    if not session_id or not player_id:
        return jsonify({"error": "Session ID and Player ID are required"}), 400
    
    db_service = DatabaseService()
    
    # Check if session and player exist
    session = db_service.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    player = db_service.get_player_by_id(player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404
    
    try:
        if db_service.decrement_session_seven_two_wins(session_id, player_id):
            # Return updated session entries
            updated_entries = db_service.get_entries_for_session(session_id)
            return jsonify([entry.to_dict() for entry in updated_entries])
        return jsonify({"error": "Failed to decrement session 7-2 wins count"}), 500
    except Exception as e:
        logger.error(f"Error decrementing session 7-2 wins for player {player_id} in session {session_id}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500