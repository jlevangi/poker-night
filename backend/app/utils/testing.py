"""
Data testing utilities for Poker Night PWA.

This module provides utilities for testing the migration and database operations.
"""

import logging
import json
import random
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from ..database.models import db, Player, Session, Entry
from ..services.database_service import DatabaseService

logger = logging.getLogger(__name__)


class DataTester:
    """
    Utilities for testing database operations and data migration.
    """
    
    def __init__(self):
        """Initialize DataTester."""
        self.logger = logging.getLogger(__name__)
        self.db_service = DatabaseService()
    
    def test_migration_integrity(self, json_data_dir: str) -> Dict[str, Any]:
        """
        Test that migrated data matches original JSON data.
        
        Args:
            json_data_dir: Directory containing original JSON files
            
        Returns:
            Dictionary with test results
        """
        test_results = {
            'passed': True,
            'tests': [],
            'errors': [],
            'summary': {}
        }
        
        try:
            # Load original JSON data
            original_data = self._load_original_json_data(json_data_dir)
            
            # Test player data
            player_test = self._test_player_migration(original_data['players'])
            test_results['tests'].append(player_test)
            if not player_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(player_test['errors'])
            
            # Test session data
            session_test = self._test_session_migration(original_data['sessions'])
            test_results['tests'].append(session_test)
            if not session_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(session_test['errors'])
            
            # Test entry data
            entry_test = self._test_entry_migration(original_data['entries'])
            test_results['tests'].append(entry_test)
            if not entry_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(entry_test['errors'])
            
            # Test cross-references
            ref_test = self._test_cross_references(original_data)
            test_results['tests'].append(ref_test)
            if not ref_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(ref_test['errors'])
            
            # Generate summary
            test_results['summary'] = {
                'total_tests': len(test_results['tests']),
                'passed_tests': len([t for t in test_results['tests'] if t['passed']]),
                'failed_tests': len([t for t in test_results['tests'] if not t['passed']]),
                'total_errors': len(test_results['errors'])
            }
            
        except Exception as e:
            test_results['passed'] = False
            test_results['errors'].append(f"Migration integrity test failed: {str(e)}")
            self.logger.error(f"Migration integrity test failed: {str(e)}")
        
        return test_results
    
    def _load_original_json_data(self, json_data_dir: str) -> Dict[str, List[Dict[str, Any]]]:
        """Load original JSON data files."""
        import os
        
        data = {}
        
        for filename in ['players.json', 'sessions.json', 'entries.json']:
            file_path = os.path.join(json_data_dir, filename)
            table_name = filename.replace('.json', '')
            
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        data[table_name] = json.loads(content) if content.strip() else []
                except Exception as e:
                    self.logger.error(f"Error loading {filename}: {str(e)}")
                    data[table_name] = []
            else:
                data[table_name] = []
        
        return data
    
    def _test_player_migration(self, original_players: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Test player data migration."""
        test_result = {
            'test_name': 'Player Migration',
            'passed': True,
            'errors': [],
            'details': {}
        }
        
        try:
            db_players = {p.player_id: p for p in Player.query.all()}
            
            # Check counts
            if len(original_players) != len(db_players):
                test_result['passed'] = False
                test_result['errors'].append(
                    f"Player count mismatch: JSON={len(original_players)}, DB={len(db_players)}"
                )
            
            # Check individual players
            for orig_player in original_players:
                player_id = orig_player['player_id']
                
                if player_id not in db_players:
                    test_result['passed'] = False
                    test_result['errors'].append(f"Player {player_id} not found in database")
                    continue
                
                db_player = db_players[player_id]
                
                # Check name
                if orig_player['name'] != db_player.name:
                    test_result['passed'] = False
                    test_result['errors'].append(
                        f"Player {player_id} name mismatch: "
                        f"JSON='{orig_player['name']}', DB='{db_player.name}'"
                    )
                
                # Check seven-two wins
                orig_wins = orig_player.get('seven_two_wins', 0)
                if orig_wins != db_player.seven_two_wins:
                    test_result['passed'] = False
                    test_result['errors'].append(
                        f"Player {player_id} seven-two wins mismatch: "
                        f"JSON={orig_wins}, DB={db_player.seven_two_wins}"
                    )
            
            test_result['details'] = {
                'original_count': len(original_players),
                'database_count': len(db_players),
                'errors_found': len(test_result['errors'])
            }
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Player migration test failed: {str(e)}")
        
        return test_result
    
    def _test_session_migration(self, original_sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Test session data migration."""
        test_result = {
            'test_name': 'Session Migration',
            'passed': True,
            'errors': [],
            'details': {}
        }
        
        try:
            db_sessions = {s.session_id: s for s in Session.query.all()}
            
            # Check counts
            if len(original_sessions) != len(db_sessions):
                test_result['passed'] = False
                test_result['errors'].append(
                    f"Session count mismatch: JSON={len(original_sessions)}, DB={len(db_sessions)}"
                )
            
            # Check individual sessions
            for orig_session in original_sessions:
                session_id = orig_session['session_id']
                
                if session_id not in db_sessions:
                    test_result['passed'] = False
                    test_result['errors'].append(f"Session {session_id} not found in database")
                    continue
                
                db_session = db_sessions[session_id]
                
                # Check basic fields
                fields_to_check = ['date', 'default_buy_in_value', 'is_active', 'status']
                
                for field in fields_to_check:
                    if field in orig_session:
                        orig_value = orig_session[field]
                        db_value = getattr(db_session, field)
                        
                        if orig_value != db_value:
                            test_result['passed'] = False
                            test_result['errors'].append(
                                f"Session {session_id} {field} mismatch: "
                                f"JSON={orig_value}, DB={db_value}"
                            )
            
            test_result['details'] = {
                'original_count': len(original_sessions),
                'database_count': len(db_sessions),
                'errors_found': len(test_result['errors'])
            }
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Session migration test failed: {str(e)}")
        
        return test_result
    
    def _test_entry_migration(self, original_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Test entry data migration."""
        test_result = {
            'test_name': 'Entry Migration',
            'passed': True,
            'errors': [],
            'details': {}
        }
        
        try:
            db_entries = {e.entry_id: e for e in Entry.query.all()}
            
            # Check counts
            if len(original_entries) != len(db_entries):
                test_result['passed'] = False
                test_result['errors'].append(
                    f"Entry count mismatch: JSON={len(original_entries)}, DB={len(db_entries)}"
                )
            
            # Check individual entries
            for orig_entry in original_entries:
                entry_id = orig_entry['entry_id']
                
                if entry_id not in db_entries:
                    test_result['passed'] = False
                    test_result['errors'].append(f"Entry {entry_id} not found in database")
                    continue
                
                db_entry = db_entries[entry_id]
                
                # Check fields
                fields_to_check = [
                    'session_id', 'player_id', 'buy_in_count', 
                    'total_buy_in_amount', 'payout', 'profit', 
                    'session_seven_two_wins'
                ]
                
                for field in fields_to_check:
                    if field in orig_entry:
                        orig_value = orig_entry[field]
                        db_value = getattr(db_entry, field)
                        
                        # Handle float comparisons with tolerance
                        if isinstance(orig_value, (int, float)) and isinstance(db_value, (int, float)):
                            if abs(orig_value - db_value) > 0.01:  # 1 cent tolerance
                                test_result['passed'] = False
                                test_result['errors'].append(
                                    f"Entry {entry_id} {field} mismatch: "
                                    f"JSON={orig_value}, DB={db_value}"
                                )
                        elif orig_value != db_value:
                            test_result['passed'] = False
                            test_result['errors'].append(
                                f"Entry {entry_id} {field} mismatch: "
                                f"JSON={orig_value}, DB={db_value}"
                            )
            
            test_result['details'] = {
                'original_count': len(original_entries),
                'database_count': len(db_entries),
                'errors_found': len(test_result['errors'])
            }
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Entry migration test failed: {str(e)}")
        
        return test_result
    
    def _test_cross_references(self, original_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Test cross-references between tables."""
        test_result = {
            'test_name': 'Cross-Reference Integrity',
            'passed': True,
            'errors': [],
            'details': {}
        }
        
        try:
            # Get all IDs from original data
            original_player_ids = {p['player_id'] for p in original_data['players']}
            original_session_ids = {s['session_id'] for s in original_data['sessions']}
            
            # Check database references
            db_player_ids = {p.player_id for p in Player.query.all()}
            db_session_ids = {s.session_id for s in Session.query.all()}
            
            # Check that all entries reference valid players and sessions
            for entry in Entry.query.all():
                if entry.player_id not in db_player_ids:
                    test_result['passed'] = False
                    test_result['errors'].append(
                        f"Entry {entry.entry_id} references non-existent player {entry.player_id}"
                    )
                
                if entry.session_id not in db_session_ids:
                    test_result['passed'] = False
                    test_result['errors'].append(
                        f"Entry {entry.entry_id} references non-existent session {entry.session_id}"
                    )
            
            # Check that migrated references match original
            for orig_entry in original_data['entries']:
                entry_id = orig_entry['entry_id']
                
                if orig_entry['player_id'] not in original_player_ids:
                    test_result['passed'] = False
                    test_result['errors'].append(
                        f"Original entry {entry_id} references non-existent player {orig_entry['player_id']}"
                    )
                
                if orig_entry['session_id'] not in original_session_ids:
                    test_result['passed'] = False
                    test_result['errors'].append(
                        f"Original entry {entry_id} references non-existent session {orig_entry['session_id']}"
                    )
            
            test_result['details'] = {
                'player_references_checked': Entry.query.count(),
                'session_references_checked': Entry.query.count(),
                'errors_found': len(test_result['errors'])
            }
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Cross-reference test failed: {str(e)}")
        
        return test_result
    
    def test_database_operations(self) -> Dict[str, Any]:
        """
        Test basic database operations (CRUD).
        
        Returns:
            Dictionary with test results
        """
        test_results = {
            'passed': True,
            'tests': [],
            'errors': []
        }
        
        try:
            # Test player operations
            player_test = self._test_player_operations()
            test_results['tests'].append(player_test)
            if not player_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(player_test['errors'])
            
            # Test session operations
            session_test = self._test_session_operations()
            test_results['tests'].append(session_test)
            if not session_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(session_test['errors'])
            
            # Test entry operations
            entry_test = self._test_entry_operations()
            test_results['tests'].append(entry_test)
            if not entry_test['passed']:
                test_results['passed'] = False
                test_results['errors'].extend(entry_test['errors'])
            
        except Exception as e:
            test_results['passed'] = False
            test_results['errors'].append(f"Database operations test failed: {str(e)}")
        
        return test_results
    
    def _test_player_operations(self) -> Dict[str, Any]:
        """Test player CRUD operations."""
        test_result = {
            'test_name': 'Player Operations',
            'passed': True,
            'errors': []
        }
        
        test_player_name = f"Test Player {random.randint(1000, 9999)}"
        
        try:
            # Test create
            player = self.db_service.add_player(test_player_name)
            if not player:
                test_result['passed'] = False
                test_result['errors'].append("Failed to create test player")
                return test_result
            
            # Test read
            retrieved_player = self.db_service.get_player_by_id(player.player_id)
            if not retrieved_player or retrieved_player.name != test_player_name:
                test_result['passed'] = False
                test_result['errors'].append("Failed to retrieve created player")
            
            # Test update (seven-two wins)
            if not self.db_service.increment_seven_two_wins(player.player_id):
                test_result['passed'] = False
                test_result['errors'].append("Failed to increment seven-two wins")
            
            updated_player = self.db_service.get_player_by_id(player.player_id)
            if updated_player.seven_two_wins != 1:
                test_result['passed'] = False
                test_result['errors'].append("Seven-two wins not properly updated")
            
            # Test decrement
            if not self.db_service.decrement_seven_two_wins(player.player_id):
                test_result['passed'] = False
                test_result['errors'].append("Failed to decrement seven-two wins")
            
            # Clean up
            db.session.delete(player)
            db.session.commit()
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Player operations test failed: {str(e)}")
        
        return test_result
    
    def _test_session_operations(self) -> Dict[str, Any]:
        """Test session CRUD operations."""
        test_result = {
            'test_name': 'Session Operations',
            'passed': True,
            'errors': []
        }
        
        test_date = (datetime.now() + timedelta(days=random.randint(1, 100))).strftime("%Y-%m-%d")
        
        try:
            # Test create
            session = self.db_service.create_session(test_date, 25.00)
            if not session:
                test_result['passed'] = False
                test_result['errors'].append("Failed to create test session")
                return test_result
            
            # Test read
            retrieved_session = self.db_service.get_session_by_id(session.session_id)
            if not retrieved_session or retrieved_session.date != test_date:
                test_result['passed'] = False
                test_result['errors'].append("Failed to retrieve created session")
            
            # Test update (end session)
            if not self.db_service.end_session(session.session_id):
                test_result['passed'] = False
                test_result['errors'].append("Failed to end session")
            
            ended_session = self.db_service.get_session_by_id(session.session_id)
            if ended_session.is_active or ended_session.status != 'ENDED':
                test_result['passed'] = False
                test_result['errors'].append("Session not properly ended")
            
            # Test reactivate
            if not self.db_service.reactivate_session(session.session_id):
                test_result['passed'] = False
                test_result['errors'].append("Failed to reactivate session")
            
            # Clean up
            db.session.delete(session)
            db.session.commit()
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Session operations test failed: {str(e)}")
        
        return test_result
    
    def _test_entry_operations(self) -> Dict[str, Any]:
        """Test entry CRUD operations."""
        test_result = {
            'test_name': 'Entry Operations',
            'passed': True,
            'errors': []
        }
        
        # Create test data
        test_player_name = f"Test Entry Player {random.randint(1000, 9999)}"
        test_date = (datetime.now() + timedelta(days=random.randint(1, 100))).strftime("%Y-%m-%d")
        
        try:
            # Create test player and session
            player = self.db_service.add_player(test_player_name)
            session = self.db_service.create_session(test_date, 20.00)
            
            if not player or not session:
                test_result['passed'] = False
                test_result['errors'].append("Failed to create test data for entry operations")
                return test_result
            
            # Test create entry
            entry = self.db_service.record_player_entry(session.session_id, player.player_id, 2)
            if not entry:
                test_result['passed'] = False
                test_result['errors'].append("Failed to create test entry")
            elif entry.buy_in_count != 2 or entry.total_buy_in_amount != 40.00:
                test_result['passed'] = False
                test_result['errors'].append("Entry not created with correct values")
            
            # Test record payout
            if not self.db_service.record_payout(session.session_id, player.player_id, 50.00):
                test_result['passed'] = False
                test_result['errors'].append("Failed to record payout")
            
            # Check profit calculation
            updated_entry = Entry.query.filter_by(entry_id=entry.entry_id).first()
            if updated_entry.profit != 10.00:  # 50 - 40
                test_result['passed'] = False
                test_result['errors'].append(f"Incorrect profit calculation: {updated_entry.profit}")
            
            # Test remove buy-in
            result = self.db_service.remove_buy_in(session.session_id, player.player_id)
            if not result or result.buy_in_count != 1:
                test_result['passed'] = False
                test_result['errors'].append("Failed to remove buy-in")
            
            # Test session seven-two wins
            if not self.db_service.increment_session_seven_two_wins(session.session_id, player.player_id):
                test_result['passed'] = False
                test_result['errors'].append("Failed to increment session seven-two wins")
            
            # Clean up
            Entry.query.filter_by(player_id=player.player_id).delete()
            db.session.delete(player)
            db.session.delete(session)
            db.session.commit()
            
        except Exception as e:
            test_result['passed'] = False
            test_result['errors'].append(f"Entry operations test failed: {str(e)}")
            
            # Clean up on error
            try:
                if 'player' in locals():
                    Entry.query.filter_by(player_id=player.player_id).delete()
                    db.session.delete(player)
                if 'session' in locals():
                    db.session.delete(session)
                db.session.commit()
            except:
                pass
        
        return test_result
    
    def generate_sample_data(self, num_players: int = 5, num_sessions: int = 3) -> Dict[str, Any]:
        """
        Generate sample data for testing purposes.
        
        Args:
            num_players: Number of sample players to create
            num_sessions: Number of sample sessions to create
            
        Returns:
            Dictionary with information about created sample data
        """
        result = {
            'success': True,
            'created': {
                'players': [],
                'sessions': [],
                'entries': []
            },
            'errors': []
        }
        
        try:
            # Create sample players
            for i in range(num_players):
                player_name = f"Sample Player {i + 1}"
                player = self.db_service.add_player(player_name)
                if player:
                    result['created']['players'].append(player.player_id)
                else:
                    result['errors'].append(f"Failed to create {player_name}")
            
            # Create sample sessions
            for i in range(num_sessions):
                session_date = (datetime.now() - timedelta(days=i * 7)).strftime("%Y-%m-%d")
                buy_in = random.choice([15.00, 20.00, 25.00, 30.00])
                session = self.db_service.create_session(session_date, buy_in)
                if session:
                    result['created']['sessions'].append(session.session_id)
                    
                    # Add random players to each session
                    session_players = random.sample(
                        result['created']['players'], 
                        random.randint(2, min(num_players, 4))
                    )
                    
                    for player_id in session_players:
                        buy_ins = random.randint(1, 3)
                        entry = self.db_service.record_player_entry(session.session_id, player_id, buy_ins)
                        if entry:
                            result['created']['entries'].append(entry.entry_id)
                            
                            # Record random payout
                            min_payout = 0
                            max_payout = entry.total_buy_in_amount * 2.5
                            payout = random.uniform(min_payout, max_payout)
                            self.db_service.record_payout(session.session_id, player_id, payout)
                else:
                    result['errors'].append(f"Failed to create session for {session_date}")
            
            if result['errors']:
                result['success'] = False
            
        except Exception as e:
            result['success'] = False
            result['errors'].append(f"Failed to generate sample data: {str(e)}")
        
        return result