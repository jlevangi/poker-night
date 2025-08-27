"""
Admin routes for Poker Night PWA.

This module contains password-protected administrative endpoints for data management.
"""

import os
import logging
import functools
from typing import Dict, Any, Optional
from flask import Blueprint, request, jsonify, session, current_app, render_template, make_response
from werkzeug.security import check_password_hash

from ..services.database_service import DatabaseService
from ..database.models import db, Player, Session, Entry, round_to_cents
from ..database.backup import DatabaseBackup
from ..database.migration import DataMigration

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin', __name__)



@admin_bp.route('/')
@admin_bp.route('')
@admin_bp.route('/index')
@admin_bp.route('/index.html')
def admin_interface():
    """
    Serve the admin interface HTML page.
    Handles multiple URL patterns for maximum compatibility.
    
    Returns:
        Rendered admin interface template
    """
    response = make_response(render_template('admin.html'))
    # Prevent browser caching for development
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


def require_admin_auth(f):
    """
    Decorator to require admin authentication for routes.
    
    Args:
        f: Function to wrap
        
    Returns:
        Wrapped function
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_authenticated'):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function


@admin_bp.route('/login', methods=['POST'])
def admin_login() -> Dict[str, Any]:
    """
    Admin login endpoint.
    
    Returns:
        JSON response indicating login success or failure
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    password = data.get('password')
    if not password:
        return jsonify({"error": "Password is required"}), 400
    
    # Check password against stored hash
    stored_hash = current_app.config.get('ADMIN_PASSWORD_HASH')
    if check_password_hash(stored_hash, password):
        session['admin_authenticated'] = True
        session.permanent = True  # Make session persistent
        logger.info("Admin authentication successful")
        return jsonify({"message": "Authentication successful"})
    else:
        logger.warning("Admin authentication failed")
        return jsonify({"error": "Invalid password"}), 401


@admin_bp.route('/logout', methods=['POST'])
@require_admin_auth
def admin_logout() -> Dict[str, Any]:
    """
    Admin logout endpoint.
    
    Returns:
        JSON response confirming logout
    """
    session.pop('admin_authenticated', None)
    return jsonify({"message": "Logged out successfully"})


@admin_bp.route('/status', methods=['GET'])
@require_admin_auth
def admin_status() -> Dict[str, Any]:
    """
    Get admin dashboard status information.
    
    Returns:
        JSON response with database statistics and system info
    """
    try:
        db_service = DatabaseService()
        
        # Get database counts
        player_count = Player.query.count()
        session_count = Session.query.count()
        entry_count = Entry.query.count()
        active_session_count = Session.query.filter_by(is_active=True).count()
        
        # Calculate some basic statistics
        total_buy_ins = db.session.query(db.func.sum(Entry.total_buy_in_amount)).scalar() or 0
        total_payouts = db.session.query(db.func.sum(Entry.payout)).scalar() or 0
        
        return jsonify({
            "database_stats": {
                "players": player_count,
                "sessions": session_count,
                "entries": entry_count,
                "active_sessions": active_session_count
            },
            "financial_stats": {
                "total_buy_ins": float(total_buy_ins),
                "total_payouts": float(total_payouts),
                "net_difference": float(total_payouts - total_buy_ins)
            },
            "system_info": {
                "database_uri": current_app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', ''),
                "debug_mode": current_app.debug
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting admin status: {str(e)}")
        return jsonify({"error": "Failed to retrieve status"}), 500


# Player management endpoints
@admin_bp.route('/players', methods=['GET'])
@require_admin_auth
def admin_get_players() -> Dict[str, Any]:
    """
    Get all players with detailed information for admin interface.
    
    Returns:
        JSON response with list of all players
    """
    try:
        players = Player.query.order_by(Player.name).all()
        return jsonify([player.to_dict() for player in players])
    except Exception as e:
        logger.error(f"Error getting players: {str(e)}")
        return jsonify({"error": "Failed to retrieve players"}), 500


@admin_bp.route('/players', methods=['POST'])
@require_admin_auth
def admin_create_player() -> Dict[str, Any]:
    """
    Create a new player.
    
    Returns:
        JSON response with created player information
    """
    try:
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
        
        # Create new player using database service
        db_service = DatabaseService()
        player_data = db_service.add_player(name)
        
        if player_data and player_data.get('player_id'):
            logger.info(f"Admin created new player: {player_data['name']} ({player_data['player_id']})")
            return jsonify(player_data), 201
        else:
            return jsonify({"error": "Failed to create player"}), 500
        
    except Exception as e:
        logger.error(f"Error creating player: {str(e)}")
        return jsonify({"error": "Failed to create player"}), 500


@admin_bp.route('/players/<string:player_id>', methods=['PUT'])
@require_admin_auth
def admin_update_player(player_id: str) -> Dict[str, Any]:
    """
    Update a player's information.
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response with updated player information
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        player = Player.query.filter_by(player_id=player_id).first()
        if not player:
            return jsonify({"error": "Player not found"}), 404
        
        # Update allowed fields
        if 'name' in data:
            player.name = data['name'].strip()
        if 'seven_two_wins' in data:
            player.seven_two_wins = int(data['seven_two_wins'])
        
        db.session.commit()
        
        logger.info(f"Admin updated player {player_id}")
        return jsonify(player.to_dict())
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating player {player_id}: {str(e)}")
        return jsonify({"error": "Failed to update player"}), 500


@admin_bp.route('/players/<string:player_id>', methods=['DELETE'])
@require_admin_auth
def admin_delete_player(player_id: str) -> Dict[str, Any]:
    """
    Delete a player (WARNING: This will delete all associated entries).
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response confirming deletion
    """
    try:
        player = Player.query.filter_by(player_id=player_id).first()
        if not player:
            return jsonify({"error": "Player not found"}), 404
        
        # Check for force parameter first
        force = request.args.get('force', '').lower() == 'true'
        
        # Check if player has any entries
        entry_count = Entry.query.filter_by(player_id=player_id).count()
        if entry_count > 0:
            if not force:
                return jsonify({
                    "error": f"Cannot delete player with {entry_count} existing entries. "
                             f"Delete entries first or use force=true parameter."
                }), 400
            else:
                # Delete all associated entries first
                Entry.query.filter_by(player_id=player_id).delete()
        
        db.session.delete(player)
        db.session.commit()
        
        logger.warning(f"Admin deleted player {player_id} (force={force})")
        return jsonify({"message": f"Player {player_id} deleted successfully"})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting player {player_id}: {str(e)}")
        return jsonify({"error": "Failed to delete player"}), 500


# Session management endpoints
@admin_bp.route('/sessions', methods=['GET'])
@require_admin_auth
def admin_get_sessions() -> Dict[str, Any]:
    """
    Get all sessions with detailed information for admin interface.
    
    Returns:
        JSON response with list of all sessions
    """
    try:
        sessions = Session.query.order_by(Session.date.desc()).all()
        return jsonify([session.to_dict() for session in sessions])
    except Exception as e:
        logger.error(f"Error getting sessions: {str(e)}")
        return jsonify({"error": "Failed to retrieve sessions"}), 500


@admin_bp.route('/sessions', methods=['POST'])
@require_admin_auth
def admin_create_session() -> Dict[str, Any]:
    """
    Create a new session.
    
    Returns:
        JSON response with created session information
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        date_str = data.get('date')
        buy_in_value = data.get('default_buy_in_value', 20.00)
        
        if not date_str or not isinstance(date_str, str):
            return jsonify({"error": "Date is required and must be a string"}), 400
        
        # Validate date format
        try:
            from datetime import datetime
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        
        try:
            buy_in_float = float(buy_in_value)
            if buy_in_float <= 0 or buy_in_float > 10000:
                return jsonify({"error": "Buy-in value must be between 0.01 and 10000"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid buy-in value"}), 400
        
        # Create new session using database service
        db_service = DatabaseService()
        session_data = db_service.create_session(date_str, buy_in_float)
        
        if session_data and session_data.get('session_id'):
            logger.info(f"Admin created new session: {session_data['date']} ({session_data['session_id']})")
            return jsonify(session_data), 201
        else:
            return jsonify({"error": "Failed to create session"}), 500
        
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        return jsonify({"error": "Failed to create session"}), 500


@admin_bp.route('/sessions/<string:session_id>', methods=['PUT'])
@require_admin_auth
def admin_update_session(session_id: str) -> Dict[str, Any]:
    """
    Update a session's information.
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response with updated session information
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        session = Session.query.filter_by(session_id=session_id).first()
        if not session:
            return jsonify({"error": "Session not found"}), 404
        
        # Update allowed fields
        if 'date' in data:
            # Validate date format
            from datetime import datetime
            datetime.strptime(data['date'], "%Y-%m-%d")
            session.date = data['date']
        
        if 'default_buy_in_value' in data:
            session.default_buy_in_value = round_to_cents(float(data['default_buy_in_value']))
        
        if 'is_active' in data:
            session.is_active = bool(data['is_active'])
            session.status = 'ACTIVE' if session.is_active else 'ENDED'
        
        db.session.commit()
        
        logger.info(f"Admin updated session {session_id}")
        return jsonify(session.to_dict())
        
    except ValueError as e:
        return jsonify({"error": f"Invalid date format: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating session {session_id}: {str(e)}")
        return jsonify({"error": "Failed to update session"}), 500


@admin_bp.route('/sessions/<string:session_id>', methods=['DELETE'])
@require_admin_auth
def admin_delete_session(session_id: str) -> Dict[str, Any]:
    """
    Delete a session (WARNING: This will delete all associated entries).
    
    Args:
        session_id: Session's unique identifier
        
    Returns:
        JSON response confirming deletion
    """
    try:
        session = Session.query.filter_by(session_id=session_id).first()
        if not session:
            return jsonify({"error": "Session not found"}), 404
        
        # Check for force parameter first
        force = request.args.get('force', '').lower() == 'true'
        
        # Check if session has any entries
        entry_count = Entry.query.filter_by(session_id=session_id).count()
        if entry_count > 0:
            if not force:
                return jsonify({
                    "error": f"Cannot delete session with {entry_count} existing entries. "
                             f"Delete entries first or use force=true parameter."
                }), 400
            else:
                # Delete all associated entries first
                Entry.query.filter_by(session_id=session_id).delete()
        
        db.session.delete(session)
        db.session.commit()
        
        logger.warning(f"Admin deleted session {session_id} (force={force})")
        return jsonify({"message": f"Session {session_id} deleted successfully"})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting session {session_id}: {str(e)}")
        return jsonify({"error": "Failed to delete session"}), 500


# Entry management endpoints
@admin_bp.route('/entries', methods=['GET'])
@require_admin_auth
def admin_get_entries() -> Dict[str, Any]:
    """
    Get all entries with detailed information for admin interface.
    
    Returns:
        JSON response with list of all entries
    """
    try:
        # Get entries with player and session information
        entries = Entry.query.join(Player).join(Session).order_by(Session.date.desc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    except Exception as e:
        logger.error(f"Error getting entries: {str(e)}")
        return jsonify({"error": "Failed to retrieve entries"}), 500


@admin_bp.route('/entries/<string:entry_id>', methods=['PUT'])
@require_admin_auth
def admin_update_entry(entry_id: str) -> Dict[str, Any]:
    """
    Update an entry's information.
    
    Args:
        entry_id: Entry's unique identifier
        
    Returns:
        JSON response with updated entry information
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        entry = Entry.query.filter_by(entry_id=entry_id).first()
        if not entry:
            return jsonify({"error": "Entry not found"}), 404
        
        # Update allowed fields
        if 'buy_in_count' in data:
            entry.buy_in_count = int(data['buy_in_count'])
            # Only recalculate total_buy_in_amount if it's not explicitly provided
            if 'total_buy_in_amount' not in data:
                session = Session.query.filter_by(session_id=entry.session_id).first()
                if session:
                    entry.total_buy_in_amount = entry.buy_in_count * session.default_buy_in_value
        
        if 'total_buy_in_amount' in data:
            entry.total_buy_in_amount = round_to_cents(float(data['total_buy_in_amount']))
        
        if 'payout' in data:
            entry.payout = round_to_cents(float(data['payout']))
        
        if 'session_seven_two_wins' in data:
            entry.session_seven_two_wins = int(data['session_seven_two_wins'])
        
        if 'session_strikes' in data:
            entry.session_strikes = int(data['session_strikes'])
        
        # Recalculate profit
        entry.calculate_profit()
        
        db.session.commit()
        
        logger.info(f"Admin updated entry {entry_id}")
        return jsonify(entry.to_dict())
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating entry {entry_id}: {str(e)}")
        return jsonify({"error": "Failed to update entry"}), 500


@admin_bp.route('/entries/<string:entry_id>', methods=['DELETE'])
@require_admin_auth
def admin_delete_entry(entry_id: str) -> Dict[str, Any]:
    """
    Delete an entry.
    
    Args:
        entry_id: Entry's unique identifier
        
    Returns:
        JSON response confirming deletion
    """
    try:
        entry = Entry.query.filter_by(entry_id=entry_id).first()
        if not entry:
            return jsonify({"error": "Entry not found"}), 404
        
        db.session.delete(entry)
        db.session.commit()
        
        logger.info(f"Admin deleted entry {entry_id}")
        return jsonify({"message": f"Entry {entry_id} deleted successfully"})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting entry {entry_id}: {str(e)}")
        return jsonify({"error": "Failed to delete entry"}), 500


# Database management endpoints
@admin_bp.route('/backup', methods=['POST'])
@require_admin_auth
def admin_create_backup() -> Dict[str, Any]:
    """
    Create a database backup.
    
    Returns:
        JSON response with backup information
    """
    try:
        data = request.get_json() or {}
        description = data.get('description', 'Manual admin backup')
        
        db_path = current_app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')
        backup_dir = os.path.join(os.path.dirname(db_path), 'backups')
        
        backup_handler = DatabaseBackup(db_path, backup_dir)
        backup_path = backup_handler.backup_database(description)
        
        return jsonify({
            "message": "Backup created successfully",
            "backup_path": backup_path,
            "description": description
        })
        
    except Exception as e:
        logger.error(f"Error creating backup: {str(e)}")
        return jsonify({"error": "Failed to create backup"}), 500


@admin_bp.route('/backups', methods=['GET'])
@require_admin_auth
def admin_list_backups() -> Dict[str, Any]:
    """
    List all available database backups.
    
    Returns:
        JSON response with list of backups
    """
    try:
        db_path = current_app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')
        backup_dir = os.path.join(os.path.dirname(db_path), 'backups')
        
        backup_handler = DatabaseBackup(db_path, backup_dir)
        backups = backup_handler.list_backups()
        
        return jsonify(backups)
        
    except Exception as e:
        logger.error(f"Error listing backups: {str(e)}")
        return jsonify({"error": "Failed to list backups"}), 500


@admin_bp.route('/migrate', methods=['POST'])
@require_admin_auth
def admin_migrate_data() -> Dict[str, Any]:
    """
    Migrate data from JSON files to database.
    
    Returns:
        JSON response with migration results
    """
    try:
        data = request.get_json() or {}
        backup_first = data.get('backup_first', True)
        
        # Get JSON data directory path
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_app.root_path)))
        json_data_dir = os.path.join(project_root, 'poker_data')
        
        migration = DataMigration(current_app, json_data_dir)
        
        # Validate data first
        validation_results = migration.validate_json_data()
        if not validation_results['valid']:
            return jsonify({
                "error": "JSON data validation failed",
                "validation_errors": validation_results['errors']
            }), 400
        
        # Perform migration
        migration_results = migration.migrate_data(backup_first=backup_first)
        
        if migration_results['success']:
            # Verify migration
            verification_results = migration.verify_migration()
            migration_results['verification'] = verification_results
        
        return jsonify(migration_results)
        
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        return jsonify({"error": f"Migration failed: {str(e)}"}), 500