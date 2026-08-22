"""
Import routes for Poker Night PWA.

Turns a PokerNow (pokernow.club) CSV export into a session. The flow is two
steps on purpose:

1. ``POST /api/imports/pokernow/analyze`` parses the upload and hands back a
   preview — detected players matched against the roster, a reconstructed
   ledger, and the hand statistics. Nothing is written.
2. ``POST /api/imports/pokernow/commit`` takes that preview back, with whatever
   the user corrected, and creates the session, players, and entries.

The split exists because a PokerNow log records chips, not cash: rebuys,
stack transfers between seats, and admin corrections all look alike in the
log, so the money always needs a human to confirm it before it becomes a
session. The hand statistics need no such confirmation and are stored as-is.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request

from ..services.database_service import DatabaseService
from ..services import pokernow_parser as pokernow

logger = logging.getLogger(__name__)

imports_bp = Blueprint('imports', __name__)

# A four-hour game logs a few thousand rows; 12 MB is far more than that and
# still small enough to reject anything that is not really a poker log.
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


def _read_upload(storage) -> Tuple[Optional[str], Optional[str]]:
    """Decode an uploaded CSV. Returns (text, error)."""
    if storage is None or not storage.filename:
        return None, None
    raw = storage.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        return None, f"{storage.filename} is too large (limit 12 MB)."
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            return raw.decode(encoding), None
        except UnicodeDecodeError:
            continue
    return None, f"Could not read {storage.filename} as text."


def _normalize(name: str) -> str:
    """Fold a name for matching: case, spaces, and punctuation ignored."""
    return ''.join(ch for ch in (name or '').lower() if ch.isalnum())


def _match_players(parsed_players: List[Dict[str, Any]],
                   roster: List[Any]) -> None:
    """
    Attach a suggested app player to each PokerNow player, in place.

    PokerNow nicknames are freeform, so an exact (normalized) name match is
    all that is offered — a wrong guess here silently credits the night's
    winnings to the wrong person, which is worse than making the user pick.
    """
    by_name: Dict[str, Any] = {}
    for player in roster:
        by_name.setdefault(_normalize(player.name), player)

    for entry in parsed_players:
        match = by_name.get(_normalize(entry['name']))
        entry['suggested_player_id'] = match.player_id if match else None
        entry['suggested_player_name'] = match.name if match else None


@imports_bp.route('/imports/pokernow/analyze', methods=['POST'])
def analyze_pokernow_upload() -> Any:
    """
    Parse an uploaded PokerNow export and return an import preview.

    Accepts multipart form data with a ``log`` file and/or a ``ledger`` file.
    Either may be omitted; when a file's role is not obvious from the field
    name it is classified by its header row. An optional ``tz_offset_hours``
    field shifts the log's UTC timestamps to local time so the suggested
    session date lands on the right night.

    Returns:
        JSON preview with summary, players, awards, and reconciliation
    """
    log_text: Optional[str] = None
    ledger_text: Optional[str] = None

    for field in ('log', 'ledger', 'file'):
        for storage in request.files.getlist(field):
            text, error = _read_upload(storage)
            if error:
                return jsonify({"error": error}), 400
            if not text:
                continue
            kind = pokernow.detect_kind(text)
            if kind == 'ledger' and ledger_text is None:
                ledger_text = text
            elif kind == 'log' and log_text is None:
                log_text = text

    if not log_text and not ledger_text:
        return jsonify({"error": "Upload a PokerNow log or ledger CSV."}), 400

    try:
        tz_offset = int(request.form.get('tz_offset_hours', 0))
    except (TypeError, ValueError):
        tz_offset = 0
    tz_offset = max(-14, min(14, tz_offset))

    try:
        analysis = pokernow.analyze(log_text, ledger_text, tz_offset_hours=tz_offset)
    except Exception as e:  # noqa: BLE001 - a malformed CSV must not 500
        logger.exception("Failed to parse PokerNow upload")
        return jsonify({"error": f"Could not parse that file: {e}"}), 400

    if not analysis['players']:
        return jsonify({"error": "No players were found in that file."}), 400

    db_service = DatabaseService()
    _match_players(analysis['players'], db_service.get_all_players())

    filenames = [s.filename for f in ('log', 'ledger', 'file')
                 for s in request.files.getlist(f) if s and s.filename]
    analysis['filename'] = filenames[0] if filenames else None
    return jsonify(analysis)


@imports_bp.route('/imports/pokernow/commit', methods=['POST'])
def commit_pokernow_import() -> Any:
    """
    Create a session from a reviewed PokerNow preview.

    Body:
        date: YYYY-MM-DD for the session
        default_buy_in_value: the table's standard buy-in
        players: [{seat, player_id | new_player_name, buy_in, cash_out,
                   buy_in_count, seven_two_wins}] — entries with neither
                 player_id nor new_player_name are skipped
        stats: the analyze payload to store against the session
        filename: original upload name, for display
        end_session: whether to mark the session ENDED (default true)

    Returns:
        JSON with the created session_id and what was imported
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    date_str = data.get('date')
    if not date_str or not isinstance(date_str, str):
        return jsonify({"error": "Date is required and must be a string"}), 400

    from datetime import datetime
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        buy_in_value = float(data.get('default_buy_in_value', 20.00))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid buy-in value"}), 400
    if buy_in_value <= 0 or buy_in_value > 10000:
        return jsonify({"error": "Buy-in value must be between 0.01 and 10000"}), 400

    players = data.get('players')
    if not isinstance(players, list) or not players:
        return jsonify({"error": "At least one player is required"}), 400

    db_service = DatabaseService()

    # Resolve every player before creating anything, so a bad roster entry
    # cannot leave a half-built session behind.
    resolved: List[Dict[str, Any]] = []
    created_player_names: List[str] = []
    for raw in players:
        if not isinstance(raw, dict):
            continue
        player_id = (raw.get('player_id') or '').strip()
        new_name = (raw.get('new_player_name') or '').strip()

        if player_id:
            player = db_service.get_player_by_id(player_id)
            if not player:
                return jsonify({"error": f"Unknown player: {player_id}"}), 400
        elif new_name:
            player = db_service.get_player_by_name(new_name)
            if not player:
                player = db_service.add_player(new_name)
                if not player:
                    return jsonify({"error": f"Could not create player '{new_name}'"}), 500
                created_player_names.append(player.name)
        else:
            continue  # explicitly skipped in the review step

        try:
            buy_in = float(raw.get('buy_in', 0) or 0)
            cash_out = float(raw.get('cash_out', 0) or 0)
        except (TypeError, ValueError):
            return jsonify({"error": f"Invalid amounts for player '{player.name}'"}), 400
        if buy_in < 0 or cash_out < 0:
            return jsonify({"error": f"Amounts for '{player.name}' cannot be negative"}), 400

        resolved.append({
            'player': player,
            'buy_in': buy_in,
            'cash_out': cash_out,
            'buy_in_count': int(raw.get('buy_in_count') or 1),
            'seven_two_wins': int(raw.get('seven_two_wins') or 0),
            'seat': raw.get('seat'),
        })

    if not resolved:
        return jsonify({"error": "No players were selected for import"}), 400

    seen_ids = {r['player'].player_id for r in resolved}
    if len(seen_ids) != len(resolved):
        return jsonify({"error": "The same player is mapped to two PokerNow names"}), 400

    session = db_service.create_session(date_str, buy_in_value)
    if not session:
        return jsonify({"error": "Failed to create session"}), 500

    imported: List[Dict[str, Any]] = []
    for record in resolved:
        entry = db_service.upsert_entry_with_amounts(
            session_id=session.session_id,
            player_id=record['player'].player_id,
            buy_in_count=record['buy_in_count'],
            total_buy_in_amount=record['buy_in'],
            payout=record['cash_out'],
            seven_two_wins=record['seven_two_wins'],
        )
        if entry is None:
            return jsonify({
                "error": f"Failed to import entry for {record['player'].name}"
            }), 500
        imported.append(entry.to_dict())

    # Store the hand statistics, tagged with the app player each PokerNow
    # seat became so the session page can link the awards to real profiles.
    stats = data.get('stats')
    if isinstance(stats, dict):
        seat_to_player = {
            r['seat']: {'player_id': r['player'].player_id, 'player_name': r['player'].name}
            for r in resolved if r.get('seat')
        }
        for player_stats in stats.get('players') or []:
            mapping = seat_to_player.get(player_stats.get('seat'))
            if mapping:
                player_stats.update(mapping)
        for award in stats.get('awards') or []:
            mapping = seat_to_player.get(award.get('seat'))
            if mapping:
                award.update(mapping)
        db_service.save_session_import(
            session.session_id, stats, filename=data.get('filename')
        )

    if data.get('end_session', True):
        db_service.end_session(session.session_id)

    session = db_service.get_session_by_id(session.session_id)
    return jsonify({
        'session_id': session.session_id,
        'session': session.to_dict(),
        'entries': imported,
        'created_players': created_player_names,
    }), 201


@imports_bp.route('/sessions/<string:session_id>/import', methods=['GET'])
def get_session_import_api(session_id: str) -> Any:
    """
    Get the stored PokerNow statistics for a session.

    Returns:
        JSON stats payload, or 404 when the session was not imported
    """
    db_service = DatabaseService()
    record = db_service.get_session_import(session_id)
    if not record:
        return jsonify({"error": "No import found for this session"}), 404
    return jsonify(record.to_dict())


@imports_bp.route('/sessions/<string:session_id>/import', methods=['DELETE'])
def delete_session_import_api(session_id: str) -> Any:
    """
    Remove a session's stored PokerNow statistics.

    The session, its players, and their money are left untouched — only the
    hand-level stats and awards go away.

    Returns:
        JSON confirmation, or 404 when there was nothing to delete
    """
    db_service = DatabaseService()
    if not db_service.delete_session_import(session_id):
        return jsonify({"error": "No import found for this session"}), 404
    return jsonify({"message": "Import removed", "session_id": session_id})
