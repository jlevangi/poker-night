"""
Data validation utilities for Poker Night PWA.

This module provides utilities for validating data integrity and consistency.
"""

import logging
from typing import Dict, Any, List, Tuple
from datetime import datetime

from ..database.models import db, Player, Session, Entry

logger = logging.getLogger(__name__)


class DataValidator:
    """
    Utilities for validating data integrity and consistency.
    """
    
    def __init__(self):
        """Initialize DataValidator."""
        self.logger = logging.getLogger(__name__)
    
    def validate_all_data(self) -> Dict[str, Any]:
        """
        Perform comprehensive validation of all data in the database.
        
        Returns:
            Dictionary with validation results
        """
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'statistics': {},
            'checks_performed': []
        }
        
        try:
            # Collect basic statistics
            validation_results['statistics'] = {
                'players': Player.query.count(),
                'sessions': Session.query.count(),
                'entries': Entry.query.count(),
                'active_sessions': Session.query.filter_by(is_active=True).count()
            }
            
            # Perform various validation checks
            self._check_data_integrity(validation_results)
            self._check_financial_consistency(validation_results)
            self._check_player_data(validation_results)
            self._check_session_data(validation_results)
            self._check_entry_data(validation_results)
            self._check_cross_references(validation_results)
            
        except Exception as e:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Validation process failed: {str(e)}")
            self.logger.error(f"Data validation failed: {str(e)}")
        
        return validation_results
    
    def _check_data_integrity(self, results: Dict[str, Any]) -> None:
        """Check basic data integrity constraints."""
        results['checks_performed'].append('Data integrity constraints')
        
        # Check for null values in required fields
        null_player_ids = Player.query.filter(Player.player_id.is_(None)).count()
        if null_player_ids > 0:
            results['errors'].append(f"Found {null_player_ids} players with null player_id")
            results['valid'] = False
        
        null_session_ids = Session.query.filter(Session.session_id.is_(None)).count()
        if null_session_ids > 0:
            results['errors'].append(f"Found {null_session_ids} sessions with null session_id")
            results['valid'] = False
        
        null_entry_ids = Entry.query.filter(Entry.entry_id.is_(None)).count()
        if null_entry_ids > 0:
            results['errors'].append(f"Found {null_entry_ids} entries with null entry_id")
            results['valid'] = False
        
        # Check for duplicate IDs
        duplicate_players = db.session.query(Player.player_id, db.func.count(Player.player_id)).\
            group_by(Player.player_id).having(db.func.count(Player.player_id) > 1).all()
        
        if duplicate_players:
            results['errors'].append(f"Found duplicate player IDs: {[p[0] for p in duplicate_players]}")
            results['valid'] = False
        
        duplicate_sessions = db.session.query(Session.session_id, db.func.count(Session.session_id)).\
            group_by(Session.session_id).having(db.func.count(Session.session_id) > 1).all()
        
        if duplicate_sessions:
            results['errors'].append(f"Found duplicate session IDs: {[s[0] for s in duplicate_sessions]}")
            results['valid'] = False
        
        duplicate_entries = db.session.query(Entry.entry_id, db.func.count(Entry.entry_id)).\
            group_by(Entry.entry_id).having(db.func.count(Entry.entry_id) > 1).all()
        
        if duplicate_entries:
            results['errors'].append(f"Found duplicate entry IDs: {[e[0] for e in duplicate_entries]}")
            results['valid'] = False
    
    def _check_financial_consistency(self, results: Dict[str, Any]) -> None:
        """Check financial data consistency."""
        results['checks_performed'].append('Financial consistency')
        
        # Check for negative buy-ins or payouts
        negative_buy_ins = Entry.query.filter(Entry.total_buy_in_amount < 0).count()
        if negative_buy_ins > 0:
            results['errors'].append(f"Found {negative_buy_ins} entries with negative buy-in amounts")
            results['valid'] = False
        
        negative_payouts = Entry.query.filter(Entry.payout < 0).count()
        if negative_payouts > 0:
            results['warnings'].append(f"Found {negative_payouts} entries with negative payouts (may be intentional)")
        
        # Check profit calculations
        incorrect_profits = Entry.query.filter(
            Entry.profit != (Entry.payout - Entry.total_buy_in_amount)
        ).count()
        
        if incorrect_profits > 0:
            results['errors'].append(f"Found {incorrect_profits} entries with incorrect profit calculations")
            results['valid'] = False
        
        # Check buy-in count consistency
        zero_buy_ins = Entry.query.filter(Entry.buy_in_count <= 0).count()
        if zero_buy_ins > 0:
            results['errors'].append(f"Found {zero_buy_ins} entries with zero or negative buy-in counts")
            results['valid'] = False
        
        # Check for extremely high values that might indicate data corruption
        high_buy_ins = Entry.query.filter(Entry.total_buy_in_amount > 1000).count()
        if high_buy_ins > 0:
            results['warnings'].append(f"Found {high_buy_ins} entries with very high buy-in amounts (>$1,000)")
        
        high_payouts = Entry.query.filter(Entry.payout > 500).count()
        if high_payouts > 0:
            results['warnings'].append(f"Found {high_payouts} entries with very high payouts (>$50,000)")
    
    def _check_player_data(self, results: Dict[str, Any]) -> None:
        """Check player-specific data."""
        results['checks_performed'].append('Player data validation')
        
        # Check for empty player names
        empty_names = Player.query.filter(
            (Player.name == '') | (Player.name.is_(None))
        ).count()
        
        if empty_names > 0:
            results['errors'].append(f"Found {empty_names} players with empty names")
            results['valid'] = False
        
        # Check for negative seven-two wins
        negative_wins = Player.query.filter(Player.seven_two_wins < 0).count()
        if negative_wins > 0:
            results['errors'].append(f"Found {negative_wins} players with negative 7-2 wins")
            results['valid'] = False
        
        # Check for unusually high seven-two wins
        high_wins = Player.query.filter(Player.seven_two_wins > 100).count()
        if high_wins > 0:
            results['warnings'].append(f"Found {high_wins} players with very high 7-2 wins (>100)")
        
        # Check for players with no entries
        players_no_entries = db.session.query(Player).outerjoin(Entry).filter(
            Entry.player_id.is_(None)
        ).count()
        
        if players_no_entries > 0:
            results['warnings'].append(f"Found {players_no_entries} players with no game entries")
    
    def _check_session_data(self, results: Dict[str, Any]) -> None:
        """Check session-specific data."""
        results['checks_performed'].append('Session data validation')
        
        # Check date formats
        invalid_dates = []
        sessions = Session.query.all()
        
        for session in sessions:
            try:
                datetime.strptime(session.date, "%Y-%m-%d")
            except ValueError:
                invalid_dates.append(session.session_id)
        
        if invalid_dates:
            results['errors'].append(f"Found sessions with invalid date formats: {invalid_dates}")
            results['valid'] = False
        
        # Check for negative or zero buy-in values
        invalid_buy_ins = Session.query.filter(Session.default_buy_in_value <= 0).count()
        if invalid_buy_ins > 0:
            results['errors'].append(f"Found {invalid_buy_ins} sessions with invalid buy-in values")
            results['valid'] = False
        
        # Check status consistency
        inconsistent_status = Session.query.filter(
            ((Session.is_active == True) & (Session.status != 'ACTIVE')) |
            ((Session.is_active == False) & (Session.status == 'ACTIVE'))
        ).count()
        
        if inconsistent_status > 0:
            results['warnings'].append(f"Found {inconsistent_status} sessions with inconsistent active status")
        
        # Check for sessions with no entries
        sessions_no_entries = db.session.query(Session).outerjoin(Entry).filter(
            Entry.session_id.is_(None)
        ).count()
        
        if sessions_no_entries > 0:
            results['warnings'].append(f"Found {sessions_no_entries} sessions with no entries")
    
    def _check_entry_data(self, results: Dict[str, Any]) -> None:
        """Check entry-specific data."""
        results['checks_performed'].append('Entry data validation')
        
        # Check for negative session seven-two wins
        negative_session_wins = Entry.query.filter(Entry.session_seven_two_wins < 0).count()
        if negative_session_wins > 0:
            results['errors'].append(f"Found {negative_session_wins} entries with negative session 7-2 wins")
            results['valid'] = False
        
        # Check consistency between buy-in count and total amount
        inconsistent_amounts = db.session.query(Entry).join(Session).filter(
            Entry.total_buy_in_amount != (Entry.buy_in_count * Session.default_buy_in_value)
        ).count()
        
        if inconsistent_amounts > 0:
            results['warnings'].append(
                f"Found {inconsistent_amounts} entries where total buy-in amount doesn't match "
                f"buy-in count × session buy-in value"
            )
        
        # Check for entries with same player in same session (should only be one)
        duplicate_player_sessions = db.session.query(
            Entry.session_id, 
            Entry.player_id, 
            db.func.count(Entry.id)
        ).group_by(
            Entry.session_id, 
            Entry.player_id
        ).having(db.func.count(Entry.id) > 1).all()
        
        if duplicate_player_sessions:
            results['errors'].append(
                f"Found {len(duplicate_player_sessions)} cases where the same player "
                f"has multiple entries in the same session"
            )
            results['valid'] = False
    
    def _check_cross_references(self, results: Dict[str, Any]) -> None:
        """Check cross-references between tables."""
        results['checks_performed'].append('Cross-reference validation')
        
        # Check for orphaned entries (entries without valid player or session)
        orphaned_entries = db.session.query(Entry).outerjoin(Player).outerjoin(Session).filter(
            (Player.id.is_(None)) | (Session.id.is_(None))
        ).count()
        
        if orphaned_entries > 0:
            results['errors'].append(f"Found {orphaned_entries} entries with invalid player or session references")
            results['valid'] = False
        
        # Verify all foreign key relationships are valid
        invalid_player_refs = Entry.query.filter(
            ~Entry.player_id.in_(db.session.query(Player.player_id))
        ).count()
        
        if invalid_player_refs > 0:
            results['errors'].append(f"Found {invalid_player_refs} entries referencing non-existent players")
            results['valid'] = False
        
        invalid_session_refs = Entry.query.filter(
            ~Entry.session_id.in_(db.session.query(Session.session_id))
        ).count()
        
        if invalid_session_refs > 0:
            results['errors'].append(f"Found {invalid_session_refs} entries referencing non-existent sessions")
            results['valid'] = False
    
    def validate_player(self, player_id: str) -> Dict[str, Any]:
        """
        Validate a specific player's data.
        
        Args:
            player_id: Player's unique identifier
            
        Returns:
            Dictionary with validation results for the player
        """
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'player_info': None
        }
        
        try:
            player = Player.query.filter_by(player_id=player_id).first()
            if not player:
                validation_results['valid'] = False
                validation_results['errors'].append(f"Player {player_id} not found")
                return validation_results
            
            validation_results['player_info'] = player.to_dict()
            
            # Check player name
            if not player.name or player.name.strip() == '':
                validation_results['errors'].append("Player has empty name")
                validation_results['valid'] = False
            
            # Check seven-two wins
            if player.seven_two_wins < 0:
                validation_results['errors'].append("Player has negative 7-2 wins")
                validation_results['valid'] = False
            
            # Check entries consistency
            entries = Entry.query.filter_by(player_id=player_id).all()
            validation_results['entry_count'] = len(entries)
            
            # Validate each entry
            for entry in entries:
                if entry.profit != (entry.payout - entry.total_buy_in_amount):
                    validation_results['errors'].append(f"Entry {entry.entry_id} has incorrect profit calculation")
                    validation_results['valid'] = False
                
                if entry.buy_in_count <= 0:
                    validation_results['errors'].append(f"Entry {entry.entry_id} has invalid buy-in count")
                    validation_results['valid'] = False
            
        except Exception as e:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Player validation failed: {str(e)}")
        
        return validation_results
    
    def validate_session(self, session_id: str) -> Dict[str, Any]:
        """
        Validate a specific session's data.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            Dictionary with validation results for the session
        """
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'session_info': None
        }
        
        try:
            session = Session.query.filter_by(session_id=session_id).first()
            if not session:
                validation_results['valid'] = False
                validation_results['errors'].append(f"Session {session_id} not found")
                return validation_results
            
            validation_results['session_info'] = session.to_dict()
            
            # Validate date format
            try:
                datetime.strptime(session.date, "%Y-%m-%d")
            except ValueError:
                validation_results['errors'].append("Session has invalid date format")
                validation_results['valid'] = False
            
            # Check buy-in value
            if session.default_buy_in_value <= 0:
                validation_results['errors'].append("Session has invalid buy-in value")
                validation_results['valid'] = False
            
            # Check status consistency
            if session.is_active and session.status != 'ACTIVE':
                validation_results['warnings'].append("Session status inconsistent with is_active flag")
            elif not session.is_active and session.status == 'ACTIVE':
                validation_results['warnings'].append("Session status inconsistent with is_active flag")
            
            # Check entries
            entries = Entry.query.filter_by(session_id=session_id).all()
            validation_results['entry_count'] = len(entries)
            
            # Financial validation
            total_buy_ins = sum(e.total_buy_in_amount for e in entries)
            total_payouts = sum(e.payout for e in entries)
            validation_results['financial_summary'] = {
                'total_buy_ins': total_buy_ins,
                'total_payouts': total_payouts,
                'difference': total_payouts - total_buy_ins
            }
            
            # Check for unrealistic financial differences
            if abs(total_payouts - total_buy_ins) > total_buy_ins * 0.5:  # More than 50% difference
                validation_results['warnings'].append(
                    f"Large difference between buy-ins and payouts: {total_payouts - total_buy_ins:.2f}"
                )
            
        except Exception as e:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Session validation failed: {str(e)}")
        
        return validation_results