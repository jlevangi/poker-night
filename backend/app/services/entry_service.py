"""
Entry service for Poker Night PWA.

This module handles entry-related operations including buy-ins, payouts, and statistics.
"""

import logging
from typing import List, Dict, Any, Optional

from .data_service import DataService
from ..models import Entry, PlayerStats, PlayerSessionHistory


class EntryService(DataService):
    """
    Service class for handling entry operations.
    
    Extends DataService to provide entry-specific functionality.
    """
    
    def __init__(self):
        """Initialize EntryService."""
        super().__init__()
        self.logger = logging.getLogger(__name__)
    
    # Entry operations
    def record_player_entry(self, session_id: str, player_id: str, num_buy_ins: int = 1) -> Optional[Entry]:
        """
        Record initial buy-ins or re-buys for a player in a session.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            num_buy_ins: Number of buy-ins to record
            
        Returns:
            Entry instance if successful, None otherwise
        """
        # Check if session and player exist
        session = self.get_session_by_id(session_id)
        player = self.get_player_by_id(player_id)
        
        if not session:
            self.logger.error(f"Session {session_id} not found.")
            return None
        if not player:
            self.logger.error(f"Player {player_id} not found.")
            return None
        
        # Check if session is still active
        if not session.is_active:
            self.logger.error(f"Cannot record entry for session {session_id} because it has ended.")
            return None
        
        entries_data = self._load_data(self.entries_file)
        cost_per_buy_in = session.default_buy_in_value
        total_buy_in_for_this_action = num_buy_ins * cost_per_buy_in
        
        # Check if player is already in the session
        existing_entry_data = None
        for entry_data in entries_data:
            if entry_data['session_id'] == session_id and entry_data['player_id'] == player_id:
                existing_entry_data = entry_data
                break
        
        # Either update existing entry or create a new one
        if existing_entry_data:
            existing_entry_data['buy_in_count'] += num_buy_ins
            existing_entry_data['total_buy_in_amount'] = existing_entry_data['buy_in_count'] * cost_per_buy_in
            existing_entry_data['profit'] = existing_entry_data.get('payout', 0.00) - existing_entry_data['total_buy_in_amount']
            
            self.logger.info(
                f"{player.name} added {num_buy_ins} buy-in(s) to session {session_id}. "
                f"New total buy-ins: {existing_entry_data['buy_in_count']}"
            )
            result_entry = Entry.from_dict(existing_entry_data)
        else:
            entry_id = f"eid_{len(entries_data) + 1:04d}"
            new_entry = Entry(
                entry_id=entry_id,
                session_id=session_id,
                player_id=player_id,
                player_name=player.name,
                buy_in_count=num_buy_ins,
                total_buy_in_amount=total_buy_in_for_this_action,
                payout=0.00,
                profit=-total_buy_in_for_this_action,
                session_seven_two_wins=0
            )
            entries_data.append(new_entry.to_dict())
            result_entry = new_entry
            
            self.logger.info(f"{player.name} joined session {session_id} with {num_buy_ins} buy-in(s).")
        
        self._save_data(entries_data, self.entries_file)
        return result_entry
    
    def remove_buy_in(self, session_id: str, player_id: str) -> Optional[Entry]:
        """
        Remove one buy-in from a player in a session.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            
        Returns:
            Updated Entry instance if successful, None otherwise
        """
        # Check if session and player exist
        session = self.get_session_by_id(session_id)
        player = self.get_player_by_id(player_id)
        
        if not session:
            self.logger.error(f"Session {session_id} not found.")
            return None
        if not player:
            self.logger.error(f"Player {player_id} not found.")
            return None
        
        # Check if session is still active
        if not session.is_active:
            self.logger.error(f"Cannot modify entry for session {session_id} because it has ended.")
            return None
        
        entries_data = self._load_data(self.entries_file)
        cost_per_buy_in = session.default_buy_in_value
        updated_entry = None
        
        # Find the player's entry
        for i, entry_data in enumerate(entries_data):
            if entry_data['session_id'] == session_id and entry_data['player_id'] == player_id:
                if entry_data['buy_in_count'] > 1:
                    # Decrement buy-in count
                    entry_data['buy_in_count'] -= 1
                    entry_data['total_buy_in_amount'] = entry_data['buy_in_count'] * cost_per_buy_in
                    entry_data['profit'] = entry_data.get('payout', 0.00) - entry_data['total_buy_in_amount']
                    updated_entry = Entry.from_dict(entry_data)
                    
                    self.logger.info(
                        f"Removed one buy-in from {player.name} in session {session_id}. "
                        f"New total: {entry_data['buy_in_count']}"
                    )
                else:
                    # If only one buy-in, remove the player from the session entirely
                    entries_data.pop(i)
                    self.logger.info(
                        f"Removed last buy-in for {player.name} from session {session_id}. "
                        f"Player removed from session."
                    )
                break
        
        if updated_entry is not None or len(entries_data) < len(self._load_data(self.entries_file)):
            self._save_data(entries_data, self.entries_file)
            return updated_entry
        else:
            self.logger.warning(
                f"Player {player.name} not found in session {session_id} or has no buy-ins to remove."
            )
            return None
    
    def record_payout(self, session_id: str, player_id: str, payout_amount: float) -> bool:
        """
        Record the final payout for a player and calculate profit.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            payout_amount: Amount of the payout
            
        Returns:
            True if successful, False otherwise
        """
        entries_data = self._load_data(self.entries_file)
        player = self.get_player_by_id(player_id)
        
        for entry_data in entries_data:
            if entry_data['session_id'] == session_id and entry_data['player_id'] == player_id:
                try:
                    entry_data['payout'] = float(payout_amount)
                    entry_data['profit'] = entry_data['payout'] - entry_data['total_buy_in_amount']
                    self._save_data(entries_data, self.entries_file)
                    
                    player_name = player.name if player else player_id
                    self.logger.info(
                        f"Payout for {player_name} in session {session_id} recorded as "
                        f"${payout_amount:.2f}. Profit: ${entry_data['profit']:.2f}"
                    )
                    return True
                except ValueError:
                    self.logger.error(f"Invalid payout amount '{payout_amount}'. Must be a number.")
                    return False
        
        self.logger.error(f"No entry found for player {player_id} in session {session_id} to record payout.")
        return False
    
    def get_entries_for_session(self, session_id: str) -> List[Entry]:
        """
        Get all entries for a specific session.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            List of Entry instances for the session
        """
        entries_data = self._load_data(self.entries_file)
        session_entries = []
        
        for entry_data in entries_data:
            if entry_data['session_id'] == session_id:
                player = self.get_player_by_id(entry_data['player_id'])
                # Ensure player_name is up-to-date if it changed in players.json
                entry_data['player_name'] = player.name if player else entry_data.get('player_name', 'Unknown Player')
                # Initialize session_seven_two_wins if it doesn't exist
                if 'session_seven_two_wins' not in entry_data:
                    entry_data['session_seven_two_wins'] = 0
                session_entries.append(Entry.from_dict(entry_data))
        
        return session_entries
    
    def increment_session_seven_two_wins(self, session_id: str, player_id: str) -> bool:
        """
        Increment session-specific 7-2 wins for a player in a specific session.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        entries_data = self._load_data(self.entries_file)
        
        for entry_data in entries_data:
            if entry_data['session_id'] == session_id and entry_data['player_id'] == player_id:
                # Initialize the counter if it doesn't exist
                if 'session_seven_two_wins' not in entry_data:
                    entry_data['session_seven_two_wins'] = 0
                
                entry_data['session_seven_two_wins'] += 1
                self._save_data(entries_data, self.entries_file)
                
                self.logger.info(
                    f"Player {entry_data['player_name']} now has {entry_data['session_seven_two_wins']} "
                    f"7-2 wins in session {session_id}."
                )
                return True
        
        self.logger.error(f"Player {player_id} not found in session {session_id} to update session 7-2 wins.")
        return False
    
    def decrement_session_seven_two_wins(self, session_id: str, player_id: str) -> bool:
        """
        Decrement session-specific 7-2 wins for a player in a specific session.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        entries_data = self._load_data(self.entries_file)
        
        for entry_data in entries_data:
            if entry_data['session_id'] == session_id and entry_data['player_id'] == player_id:
                # Initialize the counter if it doesn't exist
                if 'session_seven_two_wins' not in entry_data:
                    entry_data['session_seven_two_wins'] = 0
                    self._save_data(entries_data, self.entries_file)
                    return True
                
                # Only decrement if greater than zero
                if entry_data['session_seven_two_wins'] > 0:
                    entry_data['session_seven_two_wins'] -= 1
                    self._save_data(entries_data, self.entries_file)
                    
                    self.logger.info(
                        f"Player {entry_data['player_name']} now has {entry_data['session_seven_two_wins']} "
                        f"7-2 wins in session {session_id}."
                    )
                else:
                    self.logger.warning(
                        f"Player {entry_data['player_name']} already has 0 session 7-2 wins "
                        f"in session {session_id}, cannot decrement."
                    )
                return True
        
        self.logger.error(f"Player {player_id} not found in session {session_id} to update session 7-2 wins.")
        return False
    
    def get_player_session_history(self, player_id: str) -> List[PlayerSessionHistory]:
        """
        Get a player's session history.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            List of PlayerSessionHistory instances, sorted by date (newest first)
        """
        entries_data = self._load_data(self.entries_file)
        player_entries = []
        
        for entry_data in entries_data:
            if entry_data['player_id'] == player_id:
                session = self.get_session_by_id(entry_data['session_id'])
                entry_copy = entry_data.copy()
                entry_copy['session_date'] = session.date if session else 'N/A'
                entry_copy['session_buy_in_value'] = session.default_buy_in_value if session else 0.0
                player_entries.append(PlayerSessionHistory.from_entry_dict(entry_copy))
        
        player_entries.sort(key=lambda x: x.session_date, reverse=True)
        return player_entries
    
    def get_player_overall_stats(self, player_id: str) -> PlayerStats:
        """
        Calculate and return a player's overall statistics.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            PlayerStats instance with calculated statistics
        """
        player_history = self.get_player_session_history(player_id)
        player = self.get_player_by_id(player_id)
        
        if not player_history:
            return PlayerStats(
                player_id=player_id,
                name=player.name if player else "Unknown",
                seven_two_wins=player.seven_two_wins if player else 0
            )
        
        # Calculate statistics
        entries = [h.entry for h in player_history]
        total_buy_ins_value = sum(e.total_buy_in_amount for e in entries)
        total_payout = sum(e.payout for e in entries)
        net_profit = sum(e.profit for e in entries)
        games_played = len(entries)
        wins = sum(1 for e in entries if e.profit > 0)
        losses = sum(1 for e in entries if e.profit < 0)
        breakeven = sum(1 for e in entries if e.profit == 0)
        
        return PlayerStats(
            player_id=player_id,
            name=player.name if player else "Unknown",
            games_played=games_played,
            total_buy_ins_value=total_buy_ins_value,
            total_payout=total_payout,
            net_profit=net_profit,
            wins=wins,
            losses=losses,
            breakeven=breakeven,
            average_profit_per_game=net_profit / games_played if games_played > 0 else 0,
            win_percentage=(wins / games_played * 100) if games_played > 0 else 0,
            seven_two_wins=player.seven_two_wins if player else 0
        )
    
    def get_all_players_summary_stats(self) -> List[PlayerStats]:
        """
        Get summary statistics for all players.
        
        Returns:
            List of PlayerStats instances, sorted by net profit (highest first)
        """
        players = self.get_all_players()
        summary = []
        
        for player in players:
            stats = self.get_player_overall_stats(player.player_id)
            summary.append(stats)
        
        # Sort by net profit, highest first
        summary.sort(key=lambda x: x.net_profit, reverse=True)
        return summary