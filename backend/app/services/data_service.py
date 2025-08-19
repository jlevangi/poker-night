"""
Data service for Poker Night PWA.

This module handles all data operations including file I/O, CRUD operations, and statistics.
"""

import json
import os
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from ..models import Player, PlayerStats, Session, Entry, PlayerSessionHistory


class DataService:
    """
    Service class for handling all data operations.
    
    This class encapsulates all file operations and data manipulations,
    providing a clean interface for the rest of the application.
    """
    
    def __init__(self):
        """Initialize DataService with file paths."""
        self.logger = logging.getLogger(__name__)
        self._setup_file_paths()
    
    def _setup_file_paths(self) -> None:
        """Set up file paths for data storage."""
        # Use the poker_data directory in the root project folder
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.data_dir = os.path.join(project_root, "poker_data")
        self.players_file = os.path.join(self.data_dir, 'players.json')
        self.sessions_file = os.path.join(self.data_dir, 'sessions.json')
        self.entries_file = os.path.join(self.data_dir, 'entries.json')
        
        # Archive file paths
        self.archive_dir = os.path.join(self.data_dir, 'archives')
        self.archived_sessions_file = os.path.join(self.archive_dir, 'archived_sessions.json')
        self.archived_entries_file = os.path.join(self.archive_dir, 'archived_entries.json')
    
    def initialize_data_files(self) -> None:
        """Create the data directory and empty JSON files if they don't exist."""
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.archive_dir, exist_ok=True)
        
        for file_path in [
            self.players_file, 
            self.sessions_file, 
            self.entries_file, 
            self.archived_sessions_file, 
            self.archived_entries_file
        ]:
            if not os.path.exists(file_path):
                with open(file_path, 'w') as f:
                    json.dump([], f)
    
    def _load_data(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Load data from JSON file.
        
        Args:
            file_path: Path to the JSON file
            
        Returns:
            List of dictionaries containing the data
        """
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                if not content:  # Handle empty file case
                    return []
                return json.loads(content)
        except FileNotFoundError:
            return []
        except json.JSONDecodeError:
            self.logger.warning(f"Could not decode JSON from {file_path}. Returning empty list.")
            return []
    
    def _save_data(self, data: List[Dict[str, Any]], file_path: str) -> None:
        """
        Save data to JSON file.
        
        Args:
            data: List of dictionaries to save
            file_path: Path to the JSON file
        """
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=4)
    
    # Player operations
    def add_player(self, name: str) -> Optional[Player]:
        """
        Add a new player if they don't already exist (case-insensitive name check).
        
        Args:
            name: Player's name
            
        Returns:
            Player instance if successful, None otherwise
        """
        players_data = self._load_data(self.players_file)
        
        # Check if player already exists (case-insensitive)
        existing_player = next(
            (p for p in players_data if p['name'].lower() == name.lower()), 
            None
        )
        if existing_player:
            self.logger.info(f"Player '{name}' already exists.")
            return Player.from_dict(existing_player)
        
        # Create new player
        player_id = f"pid_{len(players_data) + 1:03d}"
        new_player = Player(
            player_id=player_id,
            name=name.strip(),
            seven_two_wins=0
        )
        
        players_data.append(new_player.to_dict())
        self._save_data(players_data, self.players_file)
        
        self.logger.info(f"Player '{name}' added with ID {player_id}")
        return new_player
    
    def get_player_by_id(self, player_id: str) -> Optional[Player]:
        """
        Get player by ID.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            Player instance if found, None otherwise
        """
        players_data = self._load_data(self.players_file)
        player_data = next((p for p in players_data if p['player_id'] == player_id), None)
        return Player.from_dict(player_data) if player_data else None
    
    def get_player_by_name(self, name: str) -> Optional[Player]:
        """
        Get player by name (case-insensitive).
        
        Args:
            name: Player's name
            
        Returns:
            Player instance if found, None otherwise
        """
        players_data = self._load_data(self.players_file)
        player_data = next(
            (p for p in players_data if p['name'].lower() == name.lower()), 
            None
        )
        return Player.from_dict(player_data) if player_data else None
    
    def get_all_players(self) -> List[Player]:
        """
        Get all players.
        
        Returns:
            List of Player instances
        """
        players_data = self._load_data(self.players_file)
        return [Player.from_dict(p) for p in players_data]
    
    def increment_seven_two_wins(self, player_id: str) -> bool:
        """
        Increment the counter for a player winning with a 7-2 hand.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        players_data = self._load_data(self.players_file)
        
        for player_data in players_data:
            if player_data['player_id'] == player_id:
                # Initialize the counter if it doesn't exist
                if 'seven_two_wins' not in player_data:
                    player_data['seven_two_wins'] = 0
                
                player_data['seven_two_wins'] += 1
                self._save_data(players_data, self.players_file)
                
                self.logger.info(
                    f"Player {player_data['name']} now has {player_data['seven_two_wins']} wins with 7-2 hands."
                )
                return True
        
        self.logger.error(f"Player {player_id} not found to update 7-2 wins.")
        return False
    
    def decrement_seven_two_wins(self, player_id: str) -> bool:
        """
        Decrement the counter for a player winning with a 7-2 hand.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        players_data = self._load_data(self.players_file)
        
        for player_data in players_data:
            if player_data['player_id'] == player_id:
                # Initialize the counter if it doesn't exist
                if 'seven_two_wins' not in player_data:
                    player_data['seven_two_wins'] = 0
                    self._save_data(players_data, self.players_file)
                    return True
                
                # Only decrement if greater than zero
                if player_data['seven_two_wins'] > 0:
                    player_data['seven_two_wins'] -= 1
                    self._save_data(players_data, self.players_file)
                    
                    self.logger.info(
                        f"Player {player_data['name']} now has {player_data['seven_two_wins']} wins with 7-2 hands."
                    )
                else:
                    self.logger.warning(
                        f"Player {player_data['name']} already has 0 wins with 7-2 hands, cannot decrement."
                    )
                return True
        
        self.logger.error(f"Player {player_id} not found to update 7-2 wins.")
        return False
    
    # Session operations
    def create_session(self, date_str: str, default_buy_in_value: float = 20.00) -> Optional[Session]:
        """
        Create a new session.
        
        Args:
            date_str: Session date in YYYY-MM-DD format
            default_buy_in_value: Default buy-in amount for the session
            
        Returns:
            Session instance if successful, None otherwise
        """
        # Validate date format
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            self.logger.error("Invalid date format. Please use YYYY-MM-DD.")
            return None
        
        sessions_data = self._load_data(self.sessions_file)
        session_id = f"sid_{date_str.replace('-', '')}_{len(sessions_data) + 1}"
        
        new_session = Session(
            session_id=session_id,
            date=date_str,
            default_buy_in_value=float(default_buy_in_value),
            is_active=True,
            status="ACTIVE"
        )
        
        sessions_data.append(new_session.to_dict())
        sessions_data.sort(key=lambda s: s['date'], reverse=True)  # Sort by date, newest first
        self._save_data(sessions_data, self.sessions_file)
        
        self.logger.info(f"Session created for {date_str} with ID {session_id}, Buy-in: ${default_buy_in_value:.2f}")
        return new_session
    
    def get_session_by_id(self, session_id: str) -> Optional[Session]:
        """
        Get session by ID.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            Session instance if found, None otherwise
        """
        sessions_data = self._load_data(self.sessions_file)
        
        for session_data in sessions_data:
            if session_data['session_id'] == session_id:
                # Ensure session has a status field for consistency
                if 'status' not in session_data:
                    session_data['status'] = 'ENDED' if not session_data.get('is_active', False) else 'ACTIVE'
                return Session.from_dict(session_data)
        
        return None
    
    def get_active_sessions(self) -> List[Session]:
        """
        Get all active sessions.
        
        Returns:
            List of active Session instances
        """
        sessions_data = self._load_data(self.sessions_file)
        active_sessions = [s for s in sessions_data if s['is_active']]
        return [Session.from_dict(s) for s in active_sessions]
    
    def get_all_sessions(self) -> List[Session]:
        """
        Get all sessions.
        
        Returns:
            List of all Session instances, sorted by date (newest first)
        """
        sessions_data = self._load_data(self.sessions_file)
        
        # Ensure all sessions have a status field for consistency
        for session_data in sessions_data:
            if 'status' not in session_data:
                session_data['status'] = 'ENDED' if not session_data.get('is_active', False) else 'ACTIVE'
        
        sessions_data.sort(key=lambda s: s['date'], reverse=True)
        return [Session.from_dict(s) for s in sessions_data]
    
    def end_session(self, session_id: str) -> bool:
        """
        Mark a session as no longer active.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        sessions_data = self._load_data(self.sessions_file)
        
        for session_data in sessions_data:
            if session_data['session_id'] == session_id:
                session_data['is_active'] = False
                session_data['status'] = 'ENDED'
                self._save_data(sessions_data, self.sessions_file)
                
                self.logger.info(f"Session {session_id} has been ended.")
                return True
        
        self.logger.error(f"Session {session_id} not found to end.")
        return False
    
    def reactivate_session(self, session_id: str) -> bool:
        """
        Reactivate a session that was previously ended.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        sessions_data = self._load_data(self.sessions_file)
        
        for session_data in sessions_data:
            if session_data['session_id'] == session_id:
                session_data['is_active'] = True
                session_data['status'] = 'ACTIVE'
                self._save_data(sessions_data, self.sessions_file)
                
                self.logger.info(f"Session {session_id} has been reactivated.")
                return True
        
        self.logger.error(f"Session {session_id} not found to reactivate.")
        return False
    
    def update_session(self, session_id: str, updated_session: Session) -> bool:
        """
        Update a session with new data.
        
        Args:
            session_id: Session's unique identifier
            updated_session: Updated Session instance
            
        Returns:
            True if successful, False otherwise
        """
        sessions_data = self._load_data(self.sessions_file)
        
        for i, session_data in enumerate(sessions_data):
            if session_data['session_id'] == session_id:
                # Ensure the session_id doesn't change
                updated_data = updated_session.to_dict()
                updated_data['session_id'] = session_id
                sessions_data[i] = updated_data
                self._save_data(sessions_data, self.sessions_file)
                
                self.logger.info(f"Session {session_id} has been updated with new data.")
                return True
        
        self.logger.error(f"Session {session_id} not found to update.")
        return False