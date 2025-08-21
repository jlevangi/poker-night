"""
Player routes for Poker Night PWA.

This module contains all player-related API endpoints.
"""

import logging
from typing import Dict, Any
from flask import Blueprint, jsonify, request

from ..services.database_service import DatabaseService

logger = logging.getLogger(__name__)
players_bp = Blueprint('players', __name__)


@players_bp.route('/players', methods=['GET'])
def get_players() -> Dict[str, Any]:
    """
    Get all players with summary statistics.
    
    Returns:
        JSON response with list of player summary statistics
    """
    db_service = DatabaseService()
    players = db_service.get_all_players_summary_stats()
    return jsonify([player.to_dict() for player in players])


@players_bp.route('/players/details', methods=['GET'])
def get_all_players_details() -> Dict[str, Any]:
    """
    Get all players with detailed information.
    
    Returns:
        JSON response with list of all players
    """
    db_service = DatabaseService()
    players = db_service.get_all_players()
    return jsonify([player.to_dict() for player in players])


@players_bp.route('/players', methods=['POST'])
def add_player_api() -> Dict[str, Any]:
    """
    Add a new player.
    
    Returns:
        JSON response with player statistics or error message
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    name = data.get('name')
    if not name or not isinstance(name, str):
        return jsonify({"error": "Name is required and must be a string"}), 400
    
    # Validate name length and characters
    name = name.strip()
    if len(name) < 1 or len(name) > 50:
        return jsonify({"error": "Name must be between 1 and 50 characters"}), 400
    
    db_service = DatabaseService()
    player = db_service.add_player(name)
    if player:
        stats = db_service.get_player_overall_stats(player.player_id)
        return jsonify(stats.to_dict()), 201
    else:
        return jsonify({"error": "Could not add or retrieve player properly"}), 500


@players_bp.route('/players/<string:player_id>/stats', methods=['GET'])
def get_player_stats_api(player_id: str) -> Dict[str, Any]:
    """
    Get statistics for a specific player.
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response with player statistics or error message
    """
    try:
        # Validate player ID format
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
        
        db_service = DatabaseService()
        player_check = db_service.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
        
        stats = db_service.get_player_overall_stats(player_id)
        return jsonify(stats.to_dict())
    except Exception as e:
        logger.error(f"Error getting player stats: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@players_bp.route('/players/<string:player_id>/history', methods=['GET'])
def get_player_history_api(player_id: str) -> Dict[str, Any]:
    """
    Get session history for a specific player.
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response with player session history or error message
    """
    try:
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
        
        db_service = DatabaseService()
        player_check = db_service.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
        
        history = db_service.get_player_session_history(player_id)
        return jsonify([h.to_dict() for h in history])
    except Exception as e:
        logger.error(f"Error getting player history: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@players_bp.route('/players/<string:player_id>/seven-two-wins', methods=['PUT'])
def increment_seven_two_wins_api(player_id: str) -> Dict[str, Any]:
    """
    Increment the 7-2 wins counter for a player.
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated player statistics or error message
    """
    try:
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
        
        db_service = DatabaseService()
        player_check = db_service.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
        
        if db_service.increment_seven_two_wins(player_id):
            stats = db_service.get_player_overall_stats(player_id)
            return jsonify(stats.to_dict())
        
        return jsonify({"error": "Failed to update 7-2 wins count"}), 500
    except Exception as e:
        logger.error(f"Error incrementing 7-2 wins: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@players_bp.route('/players/<string:player_id>/seven-two-wins/decrement', methods=['PUT'])
def decrement_seven_two_wins_api(player_id: str) -> Dict[str, Any]:
    """
    Decrement the 7-2 wins counter for a player.
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated player statistics or error message
    """
    try:
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
        
        db_service = DatabaseService()
        player_check = db_service.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
        
        if db_service.decrement_seven_two_wins(player_id):
            stats = db_service.get_player_overall_stats(player_id)
            return jsonify(stats.to_dict())
        
        return jsonify({"error": "Failed to decrement 7-2 wins count"}), 500
    except Exception as e:
        logger.error(f"Error decrementing 7-2 wins: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500