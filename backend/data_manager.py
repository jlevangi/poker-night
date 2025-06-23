import json
from datetime import datetime
import os

# --- DATA FILE PATHS ---
# Use the poker_data directory in the root project folder
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "poker_data")
PLAYERS_FILE = os.path.join(DATA_DIR, 'players.json')
SESSIONS_FILE = os.path.join(DATA_DIR, 'sessions.json')
ENTRIES_FILE = os.path.join(DATA_DIR, 'entries.json')

# --- ARCHIVE FILE PATHS ---
ARCHIVE_DIR = os.path.join(DATA_DIR, 'archives')
ARCHIVED_SESSIONS_FILE = os.path.join(ARCHIVE_DIR, 'archived_sessions.json')
ARCHIVED_ENTRIES_FILE = os.path.join(ARCHIVE_DIR, 'archived_entries.json')

# --- UTILITY: ENSURE DATA DIRECTORY AND FILES EXIST ---
def initialize_data_files():
    """Creates the data directory and empty JSON files if they don't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    for file_path in [PLAYERS_FILE, SESSIONS_FILE, ENTRIES_FILE, ARCHIVED_SESSIONS_FILE, ARCHIVED_ENTRIES_FILE]:
        if not os.path.exists(file_path):
            with open(file_path, 'w') as f:
                json.dump([], f) # Initialize with an empty list

# --- DATA LOADING/SAVING FUNCTIONS ---
def load_data(file_path):
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            if not content: # Handle empty file case
                return []
            return json.loads(content)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        print(f"Warning: Could not decode JSON from {file_path}. Returning empty list.")
        return []


def save_data(data, file_path):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4) # Indent for readability

# --- PLAYER MANAGEMENT ---
def add_player(name):
    """Adds a new player if they don't already exist (case-insensitive name check)."""
    players = load_data(PLAYERS_FILE)
    # Check if player already exists (case-insensitive)
    if any(p['name'].lower() == name.lower() for p in players):
        print(f"Player '{name}' already exists.")
        return next((p for p in players if p['name'].lower() == name.lower()), None)

    player_id = f"pid_{len(players) + 1:03d}" # Simple ID generation
    new_player = {
        "player_id": player_id, 
        "name": name.strip(),
        "seven_two_wins": 0  # Track wins with 7-2 hands
    }
    players.append(new_player)
    save_data(players, PLAYERS_FILE)
    print(f"Player '{name}' added with ID {player_id}")
    return new_player

def get_player_by_id(player_id):
    players = load_data(PLAYERS_FILE)
    for p in players:
        if p['player_id'] == player_id:
            return p
    return None

def get_player_by_name(name):
    players = load_data(PLAYERS_FILE)
    for p in players:
        if p['name'].lower() == name.lower():
            return p
    return None

def get_all_players():
    return load_data(PLAYERS_FILE)

# --- SESSION MANAGEMENT ---
def create_session(date_str, default_buy_in_value=20.00):
    """Creates a new session."""
    sessions = load_data(SESSIONS_FILE)
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        print("Invalid date format. Please use YYYY-MM-DD.")
        return None

    # Check if a session for this date already exists to prevent duplicates if needed
    # For now, allowing multiple sessions on the same date but with different IDs.
    session_id = f"sid_{date_str.replace('-', '')}_{len(sessions) + 1}"
    new_session = {
        "session_id": session_id,
        "date": date_str,
        "default_buy_in_value": float(default_buy_in_value),
        "is_active": True, # Flag to indicate if session is ongoing
        "status": "ACTIVE"  # Explicit status field for consistency 
    }
    sessions.append(new_session)
    sessions.sort(key=lambda s: s['date'], reverse=True) # Sort by date, newest first
    save_data(sessions, SESSIONS_FILE)
    print(f"Session created for {date_str} with ID {session_id}, Buy-in: ${default_buy_in_value:.2f}")
    return new_session

def get_session_by_id(session_id):
    sessions = load_data(SESSIONS_FILE)
    for s in sessions:
        if s['session_id'] == session_id:
            return s
    return None

def get_active_sessions():
    """Returns all active sessions."""
    sessions = load_data(SESSIONS_FILE)
    active_sessions = [s for s in sessions if s['is_active']]
    return active_sessions

def get_all_sessions():
    sessions = load_data(SESSIONS_FILE)
    sessions.sort(key=lambda s: s['date'], reverse=True)
    return sessions

def end_session(session_id):
    """Marks a session as no longer active."""
    sessions = load_data(SESSIONS_FILE)
    session_found = False
    for s in sessions:
        if s['session_id'] == session_id:
            s['is_active'] = False
            s['status'] = 'ENDED'  # Add explicit status field for consistency
            session_found = True
            break
    if session_found:
        save_data(sessions, SESSIONS_FILE)
        print(f"Session {session_id} has been ended.")
        return True
    print(f"Error: Session {session_id} not found to end.")
    return False

def reactivate_session(session_id):
    """Reactivates a session that was previously ended."""
    sessions = load_data(SESSIONS_FILE)
    session_found = False
    for s in sessions:
        if s['session_id'] == session_id:
            s['is_active'] = True
            s['status'] = 'ACTIVE'  # Add explicit status field for consistency
            session_found = True
            break
    if session_found:
        save_data(sessions, SESSIONS_FILE)
        print(f"Session {session_id} has been reactivated.")
        return True
    print(f"Error: Session {session_id} not found to reactivate.")
    return False

def update_session(session_id, updated_session_data):
    """Updates a session with new data, preserving the session ID."""
    sessions = load_data(SESSIONS_FILE)
    session_found = False
    
    for i, session in enumerate(sessions):
        if session['session_id'] == session_id:
            # Ensure the session_id doesn't change
            updated_session_data['session_id'] = session_id
            sessions[i] = updated_session_data
            session_found = True
            break
    
    if session_found:
        save_data(sessions, SESSIONS_FILE)
        print(f"Session {session_id} has been updated with new data.")
        return True
    
    print(f"Error: Session {session_id} not found to update.")
    return False

# --- ENTRY (BUY-IN/PROFIT) MANAGEMENT ---
def record_player_entry(session_id, player_id, num_buy_ins=1):
    """Records initial buy-ins or re-buys for a player in a session.
       Dynamically handles players joining a session.
    """
    # Check if session and player exist
    session = get_session_by_id(session_id)
    player_info = get_player_by_id(player_id)
    if not session:
        print(f"Error: Session {session_id} not found.")
        return None
    if not player_info:
        print(f"Error: Player {player_id} not found.")
        return None
    
    # Check if session is still active
    if not session.get('is_active', False):
        print(f"Error: Cannot record entry for session {session_id} because it has ended.")
        return None
    
    entries = load_data(ENTRIES_FILE)
    cost_per_buy_in = session['default_buy_in_value']
    total_buy_in_for_this_action = num_buy_ins * cost_per_buy_in
    
    # Check if player is already in the session
    existing_entry = None
    for e in entries:
        if e['session_id'] == session_id and e['player_id'] == player_id:
            existing_entry = e
            break
            
    # Either update existing entry or create a new one
    if existing_entry:
        existing_entry['buy_in_count'] += num_buy_ins
        existing_entry['total_buy_in_amount'] = existing_entry['buy_in_count'] * cost_per_buy_in # Recalculate total
        # Profit will be recalculated when payout is set or if it's based on current buy-ins
        existing_entry['profit'] = existing_entry.get('payout', 0.00) - existing_entry['total_buy_in_amount']
        print(f"{player_info['name']} added {num_buy_ins} buy-in(s) to session {session_id}. New total buy-ins: {existing_entry['buy_in_count']}")
    else:
        entry_id = f"eid_{len(entries) + 1:04d}"
        new_entry = {
            "entry_id": entry_id,
            "session_id": session_id,
            "player_id": player_id,
            "player_name": player_info['name'], # Store name for easier display
            "buy_in_count": num_buy_ins,
            "total_buy_in_amount": total_buy_in_for_this_action,
            "payout": 0.00, # Initial payout
            "profit": -total_buy_in_for_this_action
        }
        entries.append(new_entry)
        print(f"{player_info['name']} joined session {session_id} with {num_buy_ins} buy-in(s).")
    
    save_data(entries, ENTRIES_FILE)
    return existing_entry or new_entry

def remove_buy_in(session_id, player_id):
    """Removes one buy-in from a player in a session."""
    # Check if session and player exist
    session = get_session_by_id(session_id)
    player_info = get_player_by_id(player_id)
    if not session:
        print(f"Error: Session {session_id} not found.")
        return None
    if not player_info:
        print(f"Error: Player {player_id} not found.")
        return None
    
    # Check if session is still active
    if not session.get('is_active', False):
        print(f"Error: Cannot modify entry for session {session_id} because it has ended.")
        return None
    
    entries = load_data(ENTRIES_FILE)
    cost_per_buy_in = session['default_buy_in_value']
    entry_updated = False
    updated_entry = None
    
    # Find the player's entry
    for entry in entries:
        if entry['session_id'] == session_id and entry['player_id'] == player_id:
            if entry['buy_in_count'] > 1:
                # Decrement buy-in count
                entry['buy_in_count'] -= 1
                entry['total_buy_in_amount'] = entry['buy_in_count'] * cost_per_buy_in
                entry['profit'] = entry.get('payout', 0.00) - entry['total_buy_in_amount']
                entry_updated = True
                updated_entry = entry
                print(f"Removed one buy-in from {player_info['name']} in session {session_id}. New total: {entry['buy_in_count']}")
                break
            else:
                # If only one buy-in, remove the player from the session entirely
                entries.remove(entry)
                entry_updated = True
                print(f"Removed last buy-in for {player_info['name']} from session {session_id}. Player removed from session.")
                break
    
    if entry_updated:
        save_data(entries, ENTRIES_FILE)
        return updated_entry
    else:
        print(f"Player {player_info['name']} not found in session {session_id} or has no buy-ins to remove.")
        return None

def remove_player_from_session(session_id, player_id):
    """Removes a player's entry from a session entirely. Use with caution."""
    entries = load_data(ENTRIES_FILE)
    player_info = get_player_by_id(player_id) # For logging
    original_length = len(entries)
    entries = [e for e in entries if not (e['session_id'] == session_id and e['player_id'] == player_id)]

    if len(entries) < original_length:
        save_data(entries, ENTRIES_FILE)
        print(f"Player {player_info['name'] if player_info else player_id} removed from session {session_id}.")
        return True
    else:
        print(f"Player {player_info['name'] if player_info else player_id} not found in session {session_id} to remove.")
        return False

def record_payout(session_id, player_id, payout_amount):
    """Records the final payout for a player and calculates profit."""
    entries = load_data(ENTRIES_FILE)
    player_info = get_player_by_id(player_id)
    entry_updated = False

    for entry in entries:
        if entry['session_id'] == session_id and entry['player_id'] == player_id:
            try:
                entry['payout'] = float(payout_amount)
                entry['profit'] = entry['payout'] - entry['total_buy_in_amount']
                entry_updated = True
                print(f"Payout for {player_info['name'] if player_info else player_id} in session {session_id} recorded as ${payout_amount:.2f}. Profit: ${entry['profit']:.2f}")
                break
            except ValueError:
                print(f"Error: Invalid payout amount '{payout_amount}'. Must be a number.")
                return False


    if entry_updated:
        save_data(entries, ENTRIES_FILE)
        return True
    else:
        print(f"Error: No entry found for player {player_id} in session {session_id} to record payout.")
        return False

def get_entries_for_session(session_id):
    all_entries = load_data(ENTRIES_FILE)
    session_entries = []
    for e in all_entries:
        if e['session_id'] == session_id:
            player = get_player_by_id(e['player_id'])
            # Ensure player_name is up-to-date if it changed in players.json
            e['player_name'] = player['name'] if player else e.get('player_name', 'Unknown Player')
            session_entries.append(e)
    return session_entries

# --- STATISTICS ---
def get_player_session_history(player_id):
    all_entries = load_data(ENTRIES_FILE)
    player_entries = []
    for entry in all_entries:
        if entry['player_id'] == player_id:
            session = get_session_by_id(entry['session_id'])
            entry_copy = entry.copy()
            entry_copy['session_date'] = session['date'] if session else 'N/A'
            entry_copy['session_buy_in_value'] = session['default_buy_in_value'] if session else 'N/A'
            player_entries.append(entry_copy)
    player_entries.sort(key=lambda x: x.get('session_date', ''), reverse=True)
    return player_entries


def get_player_overall_stats(player_id):
    player_entries = get_player_session_history(player_id)
    player_info = get_player_by_id(player_id)

    if not player_entries:
        return {
            "player_id": player_id,
            "name": player_info['name'] if player_info else "Unknown",
            "games_played": 0, "total_buy_ins_value": 0, "total_payout": 0,
            "net_profit": 0, "wins": 0, "losses": 0, "breakeven": 0,
            "average_profit_per_game": 0, "win_percentage": 0,
            "seven_two_wins": player_info.get('seven_two_wins', 0) if player_info else 0
        }

    total_buy_ins_value = sum(e['total_buy_in_amount'] for e in player_entries)
    total_payout = sum(e['payout'] for e in player_entries)
    net_profit = sum(e['profit'] for e in player_entries)
    games_played = len(player_entries)
    wins = sum(1 for e in player_entries if e['profit'] > 0)
    losses = sum(1 for e in player_entries if e['profit'] < 0)
    breakeven = sum(1 for e in player_entries if e['profit'] == 0)


    return {
        "player_id": player_id,
        "name": player_info['name'] if player_info else "Unknown",
        "games_played": games_played,
        "total_buy_ins_value": total_buy_ins_value,
        "total_payout": total_payout,
        "net_profit": net_profit,
        "wins": wins,
        "losses": losses,
        "breakeven": breakeven,
        "average_profit_per_game": net_profit / games_played if games_played > 0 else 0,
        "win_percentage": (wins / games_played * 100) if games_played > 0 else 0,
        "seven_two_wins": player_info.get('seven_two_wins', 0) if player_info else 0
    }

def increment_seven_two_wins(player_id):
    """Increments the counter for a player winning with a 7-2 hand."""
    players = load_data(PLAYERS_FILE)
    player_updated = False
    
    for player in players:
        if player['player_id'] == player_id:
            # Initialize the counter if it doesn't exist
            if 'seven_two_wins' not in player:
                player['seven_two_wins'] = 0
            
            player['seven_two_wins'] += 1
            player_updated = True
            print(f"Player {player['name']} now has {player['seven_two_wins']} wins with 7-2 hands.")
            break
    
    if player_updated:
        save_data(players, PLAYERS_FILE)
        return True
    else:
        print(f"Error: Player {player_id} not found to update 7-2 wins.")
        return False

def decrement_seven_two_wins(player_id):
    """Decrements the counter for a player winning with a 7-2 hand."""
    players = load_data(PLAYERS_FILE)
    player_updated = False
    
    for player in players:
        if player['player_id'] == player_id:
            # Initialize the counter if it doesn't exist
            if 'seven_two_wins' not in player:
                player['seven_two_wins'] = 0
                player_updated = True
                break
            
            # Only decrement if greater than zero
            if player['seven_two_wins'] > 0:
                player['seven_two_wins'] -= 1
                player_updated = True
                print(f"Player {player['name']} now has {player['seven_two_wins']} wins with 7-2 hands.")
            else:
                print(f"Player {player['name']} already has 0 wins with 7-2 hands, cannot decrement.")
                return True  # Return true since we found the player but no action needed
            break
    
    if player_updated:
        save_data(players, PLAYERS_FILE)
        return True
    else:
        print(f"Error: Player {player_id} not found to update 7-2 wins.")
        return False

def get_all_players_summary_stats():
    players = get_all_players()
    summary = []
    for player in players:
        stats = get_player_overall_stats(player['player_id'])
        summary.append(stats) # stats already includes player_id and name
    # Sort by net profit, for example
    summary.sort(key=lambda x: x['net_profit'], reverse=True)
    return summary

# Initialize data files on first import/run
initialize_data_files()

if __name__ == "__main__":
    print("Data manager initialized. Running basic tests...")

    # Clean up old data for fresh test
    save_data([], PLAYERS_FILE)
    save_data([], SESSIONS_FILE)
    save_data([], ENTRIES_FILE)
    save_data([], ARCHIVED_SESSIONS_FILE)
    save_data([], ARCHIVED_ENTRIES_FILE)
    initialize_data_files() # Ensure they are recreated if deleted manually for testing

    # Add players
    p1 = add_player("Alice")
    p2 = add_player("Bob")
    p3 = add_player("Charlie")
    add_player("Alice") # Test adding existing player

    print("\n--- Players ---")
    print(get_all_players())

    # Create a session
    session1_date = datetime.now().strftime("%Y-%m-%d")
    session1 = create_session(session1_date, default_buy_in_value=25.00)
    session2 = create_session("2024-01-15", default_buy_in_value=20.00)


    print("\n--- Sessions ---")
    print(get_all_sessions())

    if session1 and p1 and p2:
        # Record entries
        record_player_entry(session1['session_id'], p1['player_id'], num_buy_ins=2)
        record_player_entry(session1['session_id'], p2['player_id'], num_buy_ins=1)
        record_player_entry(session1['session_id'], p1['player_id'], num_buy_ins=1) # Re-buy for Alice

        print("\n--- Entries for Session 1 (Before Payout) ---")
        for entry in get_entries_for_session(session1['session_id']):
            print(entry)

        # Record payouts
        record_payout(session1['session_id'], p1['player_id'], 50.00)  # Alice: 3 buy-ins = $75. Payout $50. Profit -$25
        record_payout(session1['session_id'], p2['player_id'], 100.00) # Bob: 1 buy-in = $25. Payout $100. Profit $75

        print("\n--- Entries for Session 1 (After Payout) ---")
        for entry in get_entries_for_session(session1['session_id']):
            print(entry)

        end_session(session1['session_id'])

    if session2 and p1 and p3:
        record_player_entry(session2['session_id'], p1['player_id'], 1)
        record_player_entry(session2['session_id'], p3['player_id'], 2)
        record_payout(session2['session_id'], p1['player_id'], 70) # Alice: 1 buy-in @20 = 20. Payout 70. Profit 50.
        record_payout(session2['session_id'], p3['player_id'], 0)  # Charlie: 2 buy-ins @20 = 40. Payout 0. Profit -40.
        end_session(session2['session_id'])


    print("\n--- Overall Player Stats ---")
    for stat in get_all_players_summary_stats():
        print(f"{stat['name']}: Games: {stat['games_played']}, Net Profit: ${stat['net_profit']:.2f}")

    print("\n--- Alice's Session History ---")
    if p1:
        for entry in get_player_session_history(p1['player_id']):
            print(f"Date: {entry['session_date']}, Buy-ins: {entry['buy_in_count']}, Spent: {entry['total_buy_in_amount']:.2f}, Payout: {entry['payout']:.2f}, Profit: {entry['profit']:.2f}")

    print("\n--- Removing Bob from Session 1 (Example) ---")
    if session1 and p2:
      #  remove_player_from_session(session1['session_id'], p2['player_id']) # Uncomment to test removal
        print("\n--- Entries for Session 1 (After Bob's potential removal) ---")
        for entry in get_entries_for_session(session1['session_id']):
            print(entry)

    # Archive and delete session tests
    if session1:
        archive_session(session1['session_id']) # Test archiving
        print("\n--- Archived Sessions ---")
        print(get_archived_sessions())

        # delete_session(session1['session_id']) # Uncomment to test deletion