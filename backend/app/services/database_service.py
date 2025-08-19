"""
Database service for Poker Night PWA.

This module handles all database operations using SQLAlchemy ORM.
"""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc

from ..database.models import db, Player, Session, Entry
from ..models import PlayerStats, PlayerSessionHistory

logger = logging.getLogger(__name__)


class DatabaseService:
    """
    Service class for handling all database operations using SQLAlchemy.
    
    This class provides a clean interface for database operations,
    replacing the JSON-based data service.
    """
    
    def __init__(self):
        """Initialize DatabaseService."""
        self.logger = logging.getLogger(__name__)
    
    # Player operations
    def add_player(self, name: str) -> Optional[Player]:
        """
        Add a new player if they don't already exist (case-insensitive name check).
        
        Args:
            name: Player's name
            
        Returns:
            Player instance if successful, None otherwise
        """
        try:
            # Check if player already exists (case-insensitive)
            existing_player = Player.query.filter(
                db.func.lower(Player.name) == name.lower()
            ).first()
            
            if existing_player:
                self.logger.info(f"Player '{name}' already exists.")
                return existing_player
            
            # Generate new player ID based on existing player_ids
            existing_player_ids = db.session.query(Player.player_id).all()
            existing_numbers = []
            for (player_id,) in existing_player_ids:
                if player_id.startswith('pid_'):
                    try:
                        num = int(player_id.split('_')[1])
                        existing_numbers.append(num)
                    except (ValueError, IndexError):
                        pass
            
            max_num = max(existing_numbers) if existing_numbers else 0
            player_id = f"pid_{max_num + 1:03d}"
            
            # Create new player
            new_player = Player(
                player_id=player_id,
                name=name.strip(),
                seven_two_wins=0
            )
            
            db.session.add(new_player)
            db.session.commit()
            
            self.logger.info(f"Player '{name}' added with ID {player_id}")
            return new_player
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to add player '{name}': {str(e)}")
            return None
    
    def get_player_by_id(self, player_id: str) -> Optional[Player]:
        """
        Get player by ID.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            Player instance if found, None otherwise
        """
        return Player.query.filter_by(player_id=player_id).first()
    
    def get_player_by_name(self, name: str) -> Optional[Player]:
        """
        Get player by name (case-insensitive).
        
        Args:
            name: Player's name
            
        Returns:
            Player instance if found, None otherwise
        """
        return Player.query.filter(
            db.func.lower(Player.name) == name.lower()
        ).first()
    
    def get_all_players(self) -> List[Player]:
        """
        Get all players.
        
        Returns:
            List of Player instances
        """
        return Player.query.order_by(Player.name).all()
    
    def increment_seven_two_wins(self, player_id: str) -> bool:
        """
        Increment the counter for a player winning with a 7-2 hand.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            player = self.get_player_by_id(player_id)
            if not player:
                self.logger.error(f"Player {player_id} not found to update 7-2 wins.")
                return False
            
            player.seven_two_wins += 1
            db.session.commit()
            
            self.logger.info(f"Player {player.name} now has {player.seven_two_wins} wins with 7-2 hands.")
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to increment 7-2 wins for player {player_id}: {str(e)}")
            return False
    
    def decrement_seven_two_wins(self, player_id: str) -> bool:
        """
        Decrement the counter for a player winning with a 7-2 hand.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            player = self.get_player_by_id(player_id)
            if not player:
                self.logger.error(f"Player {player_id} not found to update 7-2 wins.")
                return False
            
            if player.seven_two_wins > 0:
                player.seven_two_wins -= 1
                db.session.commit()
                self.logger.info(f"Player {player.name} now has {player.seven_two_wins} wins with 7-2 hands.")
            else:
                self.logger.warning(f"Player {player.name} already has 0 wins with 7-2 hands, cannot decrement.")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to decrement 7-2 wins for player {player_id}: {str(e)}")
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
        try:
            # Validate date format
            from datetime import datetime
            datetime.strptime(date_str, "%Y-%m-%d")
            
            # Generate session ID
            session_count = Session.query.filter(Session.date == date_str).count()
            session_id = f"sid_{date_str.replace('-', '')}_{session_count + 1}"
            
            new_session = Session(
                session_id=session_id,
                date=date_str,
                default_buy_in_value=float(default_buy_in_value),
                is_active=True,
                status="ACTIVE"
            )
            
            db.session.add(new_session)
            db.session.commit()
            
            self.logger.info(f"Session created for {date_str} with ID {session_id}, Buy-in: ${default_buy_in_value:.2f}")
            return new_session
            
        except ValueError:
            self.logger.error("Invalid date format. Please use YYYY-MM-DD.")
            return None
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to create session: {str(e)}")
            return None
    
    def get_session_by_id(self, session_id: str) -> Optional[Session]:
        """
        Get session by ID.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            Session instance if found, None otherwise
        """
        return Session.query.filter_by(session_id=session_id).first()
    
    def get_active_sessions(self) -> List[Session]:
        """
        Get all active sessions.
        
        Returns:
            List of active Session instances
        """
        return Session.query.filter_by(is_active=True).order_by(desc(Session.date)).all()
    
    def get_all_sessions(self) -> List[Session]:
        """
        Get all sessions.
        
        Returns:
            List of all Session instances, sorted by date (newest first)
        """
        return Session.query.order_by(desc(Session.date)).all()
    
    def end_session(self, session_id: str) -> bool:
        """
        Mark a session as no longer active.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            session = self.get_session_by_id(session_id)
            if not session:
                self.logger.error(f"Session {session_id} not found to end.")
                return False
            
            session.is_active = False
            session.status = 'ENDED'
            db.session.commit()
            
            self.logger.info(f"Session {session_id} has been ended.")
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to end session {session_id}: {str(e)}")
            return False
    
    def reactivate_session(self, session_id: str) -> bool:
        """
        Reactivate a session that was previously ended.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            session = self.get_session_by_id(session_id)
            if not session:
                self.logger.error(f"Session {session_id} not found to reactivate.")
                return False
            
            session.is_active = True
            session.status = 'ACTIVE'
            db.session.commit()
            
            self.logger.info(f"Session {session_id} has been reactivated.")
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to reactivate session {session_id}: {str(e)}")
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
        try:
            session = self.get_session_by_id(session_id)
            if not session:
                self.logger.error(f"Session {session_id} not found to update.")
                return False
            
            # Update fields
            session.default_buy_in_value = updated_session.default_buy_in_value
            session.is_active = updated_session.is_active
            session.status = updated_session.status
            session.chip_distribution = updated_session.chip_distribution
            session.total_chips = updated_session.total_chips
            
            db.session.commit()
            
            self.logger.info(f"Session {session_id} has been updated with new data.")
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to update session {session_id}: {str(e)}")
            return False
    
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
        try:
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
            
            # Check if player is already in the session
            existing_entry = Entry.query.filter_by(
                session_id=session_id, 
                player_id=player_id
            ).first()
            
            cost_per_buy_in = session.default_buy_in_value
            total_buy_in_for_this_action = num_buy_ins * cost_per_buy_in
            
            if existing_entry:
                # Update existing entry
                existing_entry.buy_in_count += num_buy_ins
                existing_entry.total_buy_in_amount = existing_entry.buy_in_count * cost_per_buy_in
                existing_entry.calculate_profit()
                
                db.session.commit()
                
                self.logger.info(
                    f"{player.name} added {num_buy_ins} buy-in(s) to session {session_id}. "
                    f"New total buy-ins: {existing_entry.buy_in_count}"
                )
                return existing_entry
            else:
                # Create new entry - generate unique entry_id based on existing entry_ids
                existing_entry_ids = db.session.query(Entry.entry_id).all()
                existing_numbers = []
                for (entry_id,) in existing_entry_ids:
                    if entry_id.startswith('eid_'):
                        try:
                            num = int(entry_id.split('_')[1])
                            existing_numbers.append(num)
                        except (ValueError, IndexError):
                            pass
                
                max_num = max(existing_numbers) if existing_numbers else 0
                entry_id = f"eid_{max_num + 1:04d}"
                
                new_entry = Entry(
                    entry_id=entry_id,
                    session_id=session_id,
                    player_id=player_id,
                    buy_in_count=num_buy_ins,
                    total_buy_in_amount=total_buy_in_for_this_action,
                    payout=0.00,
                    profit=-total_buy_in_for_this_action,
                    session_seven_two_wins=0
                )
                
                db.session.add(new_entry)
                db.session.commit()
                
                self.logger.info(f"{player.name} joined session {session_id} with {num_buy_ins} buy-in(s).")
                return new_entry
                
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to record player entry: {str(e)}")
            return None
    
    def remove_buy_in(self, session_id: str, player_id: str) -> Optional[Entry]:
        """
        Remove one buy-in from a player in a session.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            
        Returns:
            Updated Entry instance if successful, None otherwise
        """
        try:
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
            
            # Find the player's entry
            entry = Entry.query.filter_by(
                session_id=session_id, 
                player_id=player_id
            ).first()
            
            if not entry:
                self.logger.warning(f"Player {player.name} not found in session {session_id}.")
                return None
            
            cost_per_buy_in = session.default_buy_in_value
            
            if entry.buy_in_count > 1:
                # Decrement buy-in count
                entry.buy_in_count -= 1
                entry.total_buy_in_amount = entry.buy_in_count * cost_per_buy_in
                entry.calculate_profit()
                
                db.session.commit()
                
                self.logger.info(
                    f"Removed one buy-in from {player.name} in session {session_id}. "
                    f"New total: {entry.buy_in_count}"
                )
                return entry
            else:
                # If only one buy-in, remove the player from the session entirely
                db.session.delete(entry)
                db.session.commit()
                
                self.logger.info(
                    f"Removed last buy-in for {player.name} from session {session_id}. "
                    f"Player removed from session."
                )
                return None
                
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to remove buy-in: {str(e)}")
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
        try:
            entry = Entry.query.filter_by(
                session_id=session_id, 
                player_id=player_id
            ).first()
            
            if not entry:
                self.logger.error(f"No entry found for player {player_id} in session {session_id} to record payout.")
                return False
            
            entry.payout = float(payout_amount)
            entry.calculate_profit()
            db.session.commit()
            
            player = self.get_player_by_id(player_id)
            player_name = player.name if player else player_id
            
            self.logger.info(
                f"Payout for {player_name} in session {session_id} recorded as "
                f"${payout_amount:.2f}. Profit: ${entry.profit:.2f}"
            )
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to record payout: {str(e)}")
            return False
    
    def get_entries_for_session(self, session_id: str) -> List[Entry]:
        """
        Get all entries for a specific session.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            List of Entry instances for the session
        """
        return Entry.query.filter_by(session_id=session_id).join(Player).all()
    
    def increment_session_seven_two_wins(self, session_id: str, player_id: str) -> bool:
        """
        Increment session-specific 7-2 wins for a player in a specific session.
        
        Args:
            session_id: Session's unique identifier
            player_id: Player's unique identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            entry = Entry.query.filter_by(
                session_id=session_id, 
                player_id=player_id
            ).first()
            
            if not entry:
                self.logger.error(f"Player {player_id} not found in session {session_id} to update session 7-2 wins.")
                return False
            
            entry.session_seven_two_wins += 1
            db.session.commit()
            
            self.logger.info(
                f"Player {entry.player.name} now has {entry.session_seven_two_wins} "
                f"7-2 wins in session {session_id}."
            )
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to increment session 7-2 wins: {str(e)}")
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
        try:
            entry = Entry.query.filter_by(
                session_id=session_id, 
                player_id=player_id
            ).first()
            
            if not entry:
                self.logger.error(f"Player {player_id} not found in session {session_id} to update session 7-2 wins.")
                return False
            
            if entry.session_seven_two_wins > 0:
                entry.session_seven_two_wins -= 1
                db.session.commit()
                
                self.logger.info(
                    f"Player {entry.player.name} now has {entry.session_seven_two_wins} "
                    f"7-2 wins in session {session_id}."
                )
            else:
                self.logger.warning(
                    f"Player {entry.player.name} already has 0 session 7-2 wins "
                    f"in session {session_id}, cannot decrement."
                )
            
            return True
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to decrement session 7-2 wins: {str(e)}")
            return False
    
    def get_player_session_history(self, player_id: str) -> List[PlayerSessionHistory]:
        """
        Get a player's session history.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            List of PlayerSessionHistory instances, sorted by date (newest first)
        """
        entries = Entry.query.filter_by(player_id=player_id).join(Session).order_by(desc(Session.date)).all()
        
        history = []
        for entry in entries:
            # Create PlayerSessionHistory using the original model structure
            history_data = entry.to_dict()
            history_data['session_date'] = entry.session.date
            history_data['session_buy_in_value'] = entry.session.default_buy_in_value
            
            # Convert to our original model format for compatibility
            from ..models.entry import PlayerSessionHistory
            history.append(PlayerSessionHistory.from_entry_dict(history_data))
        
        return history
    
    def get_player_overall_stats(self, player_id: str) -> PlayerStats:
        """
        Calculate and return a player's overall statistics.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            PlayerStats instance with calculated statistics
        """
        player = self.get_player_by_id(player_id)
        if not player:
            return PlayerStats(
                player_id=player_id,
                name="Unknown"
            )
        
        entries = Entry.query.filter_by(player_id=player_id).all()
        
        if not entries:
            return PlayerStats(
                player_id=player_id,
                name=player.name,
                seven_two_wins=player.seven_two_wins
            )
        
        # Calculate statistics
        total_buy_ins_value = sum(e.total_buy_in_amount for e in entries)
        total_payout = sum(e.payout for e in entries)
        net_profit = sum(e.profit for e in entries)
        games_played = len(entries)
        wins = sum(1 for e in entries if e.profit > 0)
        losses = sum(1 for e in entries if e.profit < 0)
        breakeven = sum(1 for e in entries if e.profit == 0)
        
        return PlayerStats(
            player_id=player_id,
            name=player.name,
            games_played=games_played,
            total_buy_ins_value=total_buy_ins_value,
            total_payout=total_payout,
            net_profit=net_profit,
            wins=wins,
            losses=losses,
            breakeven=breakeven,
            average_profit_per_game=net_profit / games_played if games_played > 0 else 0,
            win_percentage=(wins / games_played * 100) if games_played > 0 else 0,
            seven_two_wins=player.seven_two_wins
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