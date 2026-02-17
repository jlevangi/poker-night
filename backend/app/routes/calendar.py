"""
Calendar routes for Poker Night PWA.

This module contains all calendar event and RSVP-related API endpoints.
"""

import logging
from datetime import datetime
from flask import Blueprint, jsonify, request

from ..services.database_service import DatabaseService

try:
    from scripts.chip_calculator import calculate_chip_distribution
except ImportError:
    try:
        from chip_calculator import calculate_chip_distribution
    except ImportError:
        def calculate_chip_distribution(buy_in):
            return {}

logger = logging.getLogger(__name__)

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/events', methods=['GET'])
def get_events_api():
    """Get all events, or upcoming only if ?upcoming=true."""
    db_service = DatabaseService()
    upcoming = request.args.get('upcoming', '').lower() == 'true'

    if upcoming:
        events = db_service.get_upcoming_events()
    else:
        events = db_service.get_all_events()

    return jsonify([event.to_dict() for event in events])


@calendar_bp.route('/events', methods=['POST'])
def create_event_api():
    """Create a new calendar event."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    date_str = data.get('date')
    if not date_str or not isinstance(date_str, str):
        return jsonify({"error": "Date is required (YYYY-MM-DD)"}), 400

    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    title = data.get('title', 'Poker Night')
    time_str = data.get('time')
    location = data.get('location')
    description = data.get('description')
    buy_in = data.get('default_buy_in_value', 20.00)
    max_players = data.get('max_players')

    # Validate buy-in
    try:
        buy_in = float(buy_in)
        if buy_in < 0 or buy_in > 10000:
            return jsonify({"error": "Buy-in must be between 0 and 10000"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid buy-in value"}), 400

    # Validate max_players if provided
    if max_players is not None:
        try:
            max_players = int(max_players)
            if max_players < 2 or max_players > 50:
                return jsonify({"error": "Max players must be between 2 and 50"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid max players value"}), 400

    db_service = DatabaseService()
    event = db_service.create_calendar_event(
        date_str=date_str,
        title=title,
        time=time_str,
        location=location,
        description=description,
        default_buy_in_value=buy_in,
        max_players=max_players
    )

    if event:
        return jsonify(event.to_dict()), 201
    return jsonify({"error": "Failed to create event"}), 500


@calendar_bp.route('/events/<string:event_id>', methods=['GET'])
def get_event_api(event_id):
    """Get a single event with its RSVPs."""
    db_service = DatabaseService()
    event = db_service.get_event_by_id(event_id)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event.to_dict())


@calendar_bp.route('/events/<string:event_id>', methods=['PUT'])
def update_event_api(event_id):
    """Update a calendar event."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    # Validate date if provided
    if 'date' in data:
        try:
            datetime.strptime(data['date'], "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    db_service = DatabaseService()
    event = db_service.update_event(event_id, **data)
    if event:
        return jsonify(event.to_dict())
    return jsonify({"error": "Event not found or update failed"}), 404


@calendar_bp.route('/events/<string:event_id>/cancel', methods=['PUT'])
def cancel_event_api(event_id):
    """Cancel a calendar event."""
    db_service = DatabaseService()
    if db_service.cancel_event(event_id):
        event = db_service.get_event_by_id(event_id)
        return jsonify(event.to_dict())
    return jsonify({"error": "Event not found or cancel failed"}), 404


@calendar_bp.route('/events/<string:event_id>/uncancel', methods=['PUT'])
def uncancel_event_api(event_id):
    """Restore a cancelled calendar event."""
    db_service = DatabaseService()
    if db_service.uncancel_event(event_id):
        event = db_service.get_event_by_id(event_id)
        return jsonify(event.to_dict())
    return jsonify({"error": "Event not found or uncancel failed"}), 404


@calendar_bp.route('/events/<string:event_id>', methods=['DELETE'])
def delete_event_api(event_id):
    """Delete a calendar event."""
    db_service = DatabaseService()
    if db_service.delete_event(event_id):
        return jsonify({"message": "Event deleted successfully"})
    return jsonify({"error": "Event not found or delete failed"}), 404


@calendar_bp.route('/events/<string:event_id>/start-session', methods=['POST'])
def start_session_from_event(event_id):
    """Create a poker session from a calendar event, seating all YES RSVPs."""
    db_service = DatabaseService()
    event = db_service.get_event_by_id(event_id)

    if not event:
        return jsonify({"error": "Event not found"}), 404
    if event.is_cancelled:
        return jsonify({"error": "Cannot start session for a cancelled event"}), 400
    if event.session_id:
        return jsonify({"error": "Event already has a linked session", "session_id": event.session_id}), 409

    # Create the session
    session = db_service.create_session(
        date_str=event.date,
        default_buy_in_value=event.default_buy_in_value
    )
    if not session:
        return jsonify({"error": "Failed to create session"}), 500

    # Calculate and store chip distribution
    chip_distribution = calculate_chip_distribution(session.default_buy_in_value)
    if chip_distribution:
        session.chip_distribution = chip_distribution
        session.total_chips = sum(chip_distribution.values())
        db_service.update_session(session.session_id, session)

    # Link event to session
    event = db_service.update_event(event_id, session_id=session.session_id)

    # Add YES RSVP players to the session
    rsvps = db_service.get_event_rsvps(event_id)
    added_players = []
    for rsvp in rsvps:
        if rsvp.status == 'YES':
            entry = db_service.add_player_to_session(session.session_id, rsvp.player_id)
            if entry:
                added_players.append(rsvp.player_id)

    return jsonify({
        "session": session.to_dict(),
        "event": event.to_dict(),
        "added_players": added_players
    }), 201


@calendar_bp.route('/events/<string:event_id>/rsvp', methods=['POST'])
def rsvp_event_api(event_id):
    """Create or update an RSVP for an event."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    player_id = data.get('player_id')
    status = data.get('status')

    if not player_id:
        return jsonify({"error": "player_id is required"}), 400
    if not status or status.upper() not in ('YES', 'NO', 'MAYBE'):
        return jsonify({"error": "status must be YES, NO, or MAYBE"}), 400

    db_service = DatabaseService()
    rsvp = db_service.create_or_update_rsvp(event_id, player_id, status)
    if rsvp:
        # Return the full updated event
        event = db_service.get_event_by_id(event_id)
        return jsonify(event.to_dict())
    return jsonify({"error": "Failed to submit RSVP"}), 400


@calendar_bp.route('/events/<string:event_id>/rsvp/<string:player_id>', methods=['DELETE'])
def delete_rsvp_api(event_id, player_id):
    """Remove an RSVP."""
    db_service = DatabaseService()
    if db_service.delete_rsvp(event_id, player_id):
        event = db_service.get_event_by_id(event_id)
        return jsonify(event.to_dict())
    return jsonify({"error": "RSVP not found"}), 404
