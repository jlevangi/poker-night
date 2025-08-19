import os
import argparse
import sys
import logging
from flask import Flask, jsonify, request, send_from_directory, render_template, url_for
# Assuming data_manager.py is in the same directory as app.py (the 'backend' directory)
import data_manager as dm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('poker_app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Add scripts directory to Python path for importing chip_calculator
scripts_dir = os.path.join(os.path.dirname(__file__), 'scripts')
sys.path.append(scripts_dir)
# Import the chip calculator
from chip_calculator import calculate_chip_distribution, display_distribution

# --- Argument Parsing for Debug Path Prints ---
parser = argparse.ArgumentParser(description="Run the Poker Night PWA Flask backend.")
parser.add_argument(
    '--debug-paths',
    action='store_true', # Sets to True if flag is present
    help="Enable verbose printing of calculated paths for debugging static/template folder setup."
)
parser.add_argument(
    '--port',
    type=int,
    default=5000,
    help="Port number to run the Flask server on."
)
args = parser.parse_args()
# --- End Argument Parsing ---


# Ensure data files are initialized (from data_manager)
dm.initialize_data_files()

# --- Path Calculations ---
SCRIPT_DIR = os.path.dirname(__file__)
PROJECT_ROOT_GUESS = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
FRONTEND_DIR_CALC = os.path.join(PROJECT_ROOT_GUESS, 'frontend')
STATIC_DIR_CALC = os.path.join(FRONTEND_DIR_CALC, 'static')
TEMPLATE_DIR_CALC = os.path.join(FRONTEND_DIR_CALC, 'templates')
IMAGE_PATH_EXPECTED = os.path.join(STATIC_DIR_CALC, 'images', 'icon-192x192.png')

# App version is managed in frontend/.env file
ENV_FILE_PATH = os.path.join(FRONTEND_DIR_CALC, '.env')

# Helper function to get APP_VERSION from .env file
def get_app_version():
    try:
        with open(ENV_FILE_PATH, 'r') as f:
            for line in f:
                if line.strip() and not line.strip().startswith('#'):
                    if '=' in line:
                        key, value = line.strip().split('=', 1)
                        if key.strip() == 'APP_VERSION':
                            return value.strip()
    except Exception as e:
        logger.warning(f"Error reading .env file: {e}")
    return '1.0.5'  # Default fallback version

APP_VERSION = get_app_version()

# --- Conditional Debug Path Printing ---
if args.debug_paths:
    logger.info("--- PATH DEBUGGING ENABLED ---")
    logger.info(f"DEBUG: SCRIPT_DIR (app.py location): {SCRIPT_DIR}")
    logger.info(f"DEBUG: Calculated PROJECT_ROOT_GUESS: {PROJECT_ROOT_GUESS}")
    logger.info(f"DEBUG: Calculated FRONTEND_DIR: {FRONTEND_DIR_CALC}")
    logger.info(f"DEBUG: Calculated STATIC_DIR (Flask 'static_folder'): {STATIC_DIR_CALC}")
    logger.info(f"DEBUG: Calculated TEMPLATE_DIR (Flask 'template_folder'): {TEMPLATE_DIR_CALC}")
    logger.info(f"DEBUG: Full expected image path for icon-192x192.png: {IMAGE_PATH_EXPECTED}")
    logger.info(f"DEBUG: Does the expected image file exist at that path? {os.path.exists(IMAGE_PATH_EXPECTED)}")
    logger.info("--- END PATH DEBUGGING ---")
# --- End Conditional Debug Path Printing ---

# Configure Flask using these calculated paths
app = Flask(__name__,
            template_folder=TEMPLATE_DIR_CALC,
            static_folder=STATIC_DIR_CALC)

# Function to create versioned URLs for static assets
@app.context_processor
def versioned_static():
    def versioned_url(filename):
        return url_for('static', filename=filename, v=APP_VERSION)
    return dict(versioned_url=versioned_url)

# --- API Endpoints ---
@app.route('/api/players', methods=['GET'])
def get_players():
    players = dm.get_all_players_summary_stats()
    return jsonify(players)

@app.route('/api/players/details', methods=['GET'])
def get_all_players_details():
    players = dm.get_all_players()
    return jsonify(players)

@app.route('/api/players', methods=['POST'])
def add_player_api():
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
    
    player = dm.add_player(name)
    if player.get('player_id'):
        return jsonify(dm.get_player_overall_stats(player['player_id'])), 201
    else:
        return jsonify({"error": "Could not add or retrieve player properly"}), 500


@app.route('/api/players/<string:player_id>/stats', methods=['GET'])
def get_player_stats_api(player_id):
    try:
        # Validate player ID format
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
            
        player_check = dm.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
            
        stats = dm.get_player_overall_stats(player_id)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/players/<string:player_id>/history', methods=['GET'])
def get_player_history_api(player_id):
    try:
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
            
        player_check = dm.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
            
        history = dm.get_player_session_history(player_id)
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/players/<string:player_id>/seven-two-wins', methods=['PUT'])
def increment_seven_two_wins_api(player_id):
    try:
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
            
        player_check = dm.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
        
        if dm.increment_seven_two_wins(player_id):
            stats = dm.get_player_overall_stats(player_id)
            return jsonify(stats)
        
        return jsonify({"error": "Failed to update 7-2 wins count"}), 500
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/players/<string:player_id>/seven-two-wins/decrement', methods=['PUT'])
def decrement_seven_two_wins_api(player_id):
    try:
        if not player_id or not isinstance(player_id, str):
            return jsonify({"error": "Invalid player ID"}), 400
            
        player_check = dm.get_player_by_id(player_id)
        if not player_check:
            return jsonify({"error": "Player not found"}), 404
        
        if dm.decrement_seven_two_wins(player_id):
            stats = dm.get_player_overall_stats(player_id)
            return jsonify(stats)
        
        return jsonify({"error": "Failed to decrement 7-2 wins count"}), 500
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/sessions/<string:session_id>/players/<string:player_id>/seven-two-wins/increment', methods=['PUT'])
def increment_session_seven_two_wins_api(session_id, player_id):
    if not session_id or not player_id:
        return jsonify({"error": "Session ID and Player ID are required"}), 400
    
    # Check if session and player exist
    session = dm.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
        
    player = dm.get_player_by_id(player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404
    
    try:
        if dm.increment_session_seven_two_wins(session_id, player_id):
            # Return updated session entries
            updated_entries = dm.get_entries_for_session(session_id)
            return jsonify(updated_entries)
        return jsonify({"error": "Failed to increment session 7-2 wins count"}), 500
    except Exception as e:
        logger.error(f"Error incrementing session 7-2 wins for player {player_id} in session {session_id}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/sessions/<string:session_id>/players/<string:player_id>/seven-two-wins/decrement', methods=['PUT'])
def decrement_session_seven_two_wins_api(session_id, player_id):
    if not session_id or not player_id:
        return jsonify({"error": "Session ID and Player ID are required"}), 400
    
    # Check if session and player exist
    session = dm.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
        
    player = dm.get_player_by_id(player_id)
    if not player:
        return jsonify({"error": "Player not found"}), 404
    
    try:
        if dm.decrement_session_seven_two_wins(session_id, player_id):
            # Return updated session entries
            updated_entries = dm.get_entries_for_session(session_id)
            return jsonify(updated_entries)
        return jsonify({"error": "Failed to decrement session 7-2 wins count"}), 500
    except Exception as e:
        logger.error(f"Error decrementing session 7-2 wins for player {player_id} in session {session_id}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions_api():
    sessions = dm.get_all_sessions()
    return jsonify(sessions)

@app.route('/api/sessions/active', methods=['GET'])
def get_active_sessions_api():
    sessions = dm.get_active_sessions()
    return jsonify(sessions)

@app.route('/api/sessions', methods=['POST'])
def create_session_api():
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
    
    # Calculate chip distribution for the session
    chip_distribution = calculate_chip_distribution(buy_in_float)
    
    # Create the session
    session = dm.create_session(date_str, buy_in_float)
    if session:
        # Add chip distribution to the session data
        if chip_distribution:
            session['chip_distribution'] = chip_distribution
            # Calculate total chip count for convenience
            total_chips = sum(chip_distribution.values())
            session['total_chips'] = total_chips
            
            # Update the session in the data store to persist the chip distribution
            dm.update_session(session['session_id'], session)
            
            # Session created with chip distribution
            logger.info(f"Session created with ID: {session.get('session_id')}")
            
        return jsonify(session), 201
    return jsonify({"error": "Failed to create session"}), 500

@app.route('/api/sessions/<string:session_id>', methods=['GET'])
def get_session_details_api(session_id):
    session = dm.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    entries = dm.get_entries_for_session(session_id)
    
    # Check if chip distribution is already in the session data
    # If not, calculate it based on the session's buy-in value
    if 'chip_distribution' not in session:
        buy_in_value = session.get('default_buy_in_value', 20.00)
        chip_distribution = calculate_chip_distribution(buy_in_value)
        if chip_distribution:
            session['chip_distribution'] = chip_distribution
            session['total_chips'] = sum(chip_distribution.values())
            
            # Save the updated session with chip distribution
            dm.update_session(session['session_id'], session)
    # else: use existing chip distribution
    
    # Prepare response
    response_data = {"session_info": session, "entries": entries}
    
    return jsonify(response_data)

@app.route('/api/sessions/<string:session_id>/end', methods=['PUT'])
def end_session_api(session_id):
    if dm.end_session(session_id):
        return jsonify({"message": "Session ended successfully"})
    return jsonify({"error": "Failed to end session or session not found"}), 404

@app.route('/api/sessions/<string:session_id>/reactivate', methods=['PUT'])
def reactivate_session_api(session_id):
    if dm.reactivate_session(session_id):
        return jsonify({"message": "Session reactivated successfully"})
    return jsonify({"error": "Failed to reactivate session or session not found"}), 404

@app.route('/api/sessions/<string:session_id>/delete', methods=['DELETE'])
def delete_session_api(session_id):
    # First check if the session exists
    session = dm.get_session_by_id(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    # Check if session is active - can't delete active sessions
    if session.get('is_active', False):
        return jsonify({"error": "Cannot delete an active session. End the session first."}), 400
    
    # Delete (archive) the session
    if dm.delete_session(session_id):
        return jsonify({"message": "Session deleted successfully and data archived"})
    else:
        return jsonify({"error": "Failed to delete session"}), 500

@app.route('/api/sessions/<string:session_id>/entries', methods=['POST'])
def add_player_to_session_api(session_id):
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

    entry = dm.record_player_entry(session_id, player_id, num_buy_ins)
    if entry:
        all_entries = dm.get_entries_for_session(session_id)
        return jsonify(all_entries), 201
    # record_player_entry prints errors, check its return for more specific client errors
    session_check = dm.get_session_by_id(session_id)
    if not session_check:
        return jsonify({"error": f"Session {session_id} not found."}), 404
    player_check = dm.get_player_by_id(player_id)
    if not player_check:
        return jsonify({"error": f"Player {player_id} not found."}), 404
    return jsonify({"error": "Failed to add player entry for an unknown reason"}), 500

@app.route('/api/sessions/<string:session_id>/entries/<string:player_id>/remove-buyin', methods=['PUT'])
def remove_buyin_api(session_id, player_id):
    result = dm.remove_buy_in(session_id, player_id)
    if result is not None:
        # Return all entries to refresh the UI
        all_entries = dm.get_entries_for_session(session_id)
        return jsonify(all_entries)
    
    # Check for specific errors
    session_check = dm.get_session_by_id(session_id)
    if not session_check:
        return jsonify({"error": f"Session {session_id} not found."}), 404
    if not session_check.get('is_active', False):
        return jsonify({"error": f"Session {session_id} is not active."}), 400
    player_check = dm.get_player_by_id(player_id)
    if not player_check:
        return jsonify({"error": f"Player {player_id} not found."}), 404
    
    return jsonify({"error": "Failed to remove buy-in. Player may not have any buy-ins in this session."}), 400

@app.route('/api/sessions/<string:session_id>/entries/<string:player_id>/payout', methods=['PUT'])
def record_payout_api(session_id, player_id):
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

    if dm.record_payout(session_id, player_id, payout_amount):
        all_entries = dm.get_entries_for_session(session_id)
        return jsonify(all_entries)
    # record_payout prints errors, check its return for more specific client errors
    entry_check = any(e['player_id'] == player_id for e in dm.get_entries_for_session(session_id))
    if not entry_check:
        return jsonify({"error": f"Player {player_id} not found in session {session_id}"}), 404
    return jsonify({"error": "Failed to record payout for an unknown reason"}), 500

@app.route('/api/chip-calculator/<float:buy_in>', methods=['GET'])
def get_chip_distribution_api(buy_in):
    """API endpoint to calculate chip distribution for a specific buy-in amount"""
    try:
        # Validate buy-in amount
        if buy_in <= 0:
            return jsonify({"error": "Buy-in amount must be positive"}), 400
            
        # Calculate chip distribution
        chip_distribution = calculate_chip_distribution(buy_in)
        
        if not chip_distribution:
            return jsonify({"error": "Failed to calculate chip distribution"}), 500
            
        # Calculate total chip count
        total_chips = sum(chip_distribution.values())
        
        # Return the distribution data
        return jsonify({
            "buy_in": buy_in,
            "chip_distribution": chip_distribution,
            "total_chips": total_chips
        })
        
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# --- Serve Frontend ---
@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/manifest.json')
def serve_manifest():
    response = send_from_directory(FRONTEND_DIR_CALC, 'manifest.json')
    # Set headers to prevent caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/sw.js')
def serve_sw():
    # static_folder is STATIC_DIR_CALC, so sw.js should be in STATIC_DIR_CALC/js/
    response = send_from_directory(os.path.join(STATIC_DIR_CALC, 'js'), 'sw.js')
    # Set headers to prevent caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# .env endpoint removed for security - use environment variables instead

# Test endpoint removed for production

# Flask's default static file handling will use the `static_folder` parameter
# (STATIC_DIR_CALC) and the default `static_url_path` which is '/static'.
# So, a request to '/static/images/icon-192x192.png' will automatically be looked for in
# STATIC_DIR_CALC/images/icon-192x192.png by Flask.
# An explicit @app.route('/static/<path:filename>') is not strictly necessary
# if the app instance is configured with the correct static_folder.

if __name__ == '__main__':
    # Flask's own debug mode for auto-reloading, traceback in browser, etc.
    # This is separate from our --debug-paths argument.
    FLASK_DEBUG_MODE = False # Set to False for production if desired

    if args.debug_paths:
        logger.info(f"Flask app starting with FLASK_DEBUG_MODE={FLASK_DEBUG_MODE} and --debug-paths enabled.")
    else:
        logger.info(f"Flask app starting with FLASK_DEBUG_MODE={FLASK_DEBUG_MODE}. Use --debug-paths to see path calculations.")

    app.run(debug=FLASK_DEBUG_MODE, host='0.0.0.0', port=args.port)