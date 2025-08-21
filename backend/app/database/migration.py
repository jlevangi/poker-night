"""
Data migration utilities for Poker Night PWA.

This module handles migration from JSON files to SQLite database.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from flask import Flask
from sqlalchemy.exc import IntegrityError

from .models import db, Player, Session, Entry
from .backup import DatabaseBackup

logger = logging.getLogger(__name__)


class DataMigration:
    """
    Handles migration of data from JSON files to SQLite database.
    """
    
    def __init__(self, app: Flask, json_data_dir: str):
        """
        Initialize DataMigration.
        
        Args:
            app: Flask application instance
            json_data_dir: Directory containing JSON data files
        """
        self.app = app
        self.json_data_dir = json_data_dir
        self.backup_handler = None
        
        # Set up backup handler if database exists
        db_path = app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')
        if db_path:
            backup_dir = os.path.join(os.path.dirname(json_data_dir), 'backups')
            self.backup_handler = DatabaseBackup(db_path, backup_dir)
    
    def _load_json_file(self, filename: str) -> List[Dict[str, Any]]:
        """
        Load data from a JSON file.
        
        Args:
            filename: Name of the JSON file to load
            
        Returns:
            List of dictionaries containing the data
        """
        file_path = os.path.join(self.json_data_dir, filename)
        
        if not os.path.exists(file_path):
            logger.warning(f"JSON file not found: {file_path}")
            return []
        
        try:
            with open(file_path, 'r') as f:
                content = f.read()
                if not content.strip():
                    return []
                return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"Could not decode JSON from {file_path}: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error reading {file_path}: {str(e)}")
            return []
    
    def validate_json_data(self) -> Dict[str, Any]:
        """
        Validate JSON data before migration.
        
        Returns:
            Dictionary with validation results
        """
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'counts': {}
        }
        
        # Load and validate each file
        files_to_check = ['players.json', 'sessions.json', 'entries.json']
        
        for filename in files_to_check:
            table_name = filename.replace('.json', '')
            data = self._load_json_file(filename)
            validation_results['counts'][table_name] = len(data)
            
            if filename == 'players.json':
                self._validate_players_data(data, validation_results)
            elif filename == 'sessions.json':
                self._validate_sessions_data(data, validation_results)
            elif filename == 'entries.json':
                self._validate_entries_data(data, validation_results)
        
        # Cross-reference validation
        self._validate_cross_references(validation_results)
        
        return validation_results
    
    def _validate_players_data(self, players_data: List[Dict[str, Any]], results: Dict[str, Any]) -> None:
        """Validate players data structure."""
        player_ids = set()
        
        for i, player in enumerate(players_data):
            if not isinstance(player, dict):
                results['errors'].append(f"Player at index {i} is not a dictionary")
                results['valid'] = False
                continue
            
            # Check required fields
            required_fields = ['player_id', 'name']
            for field in required_fields:
                if field not in player:
                    results['errors'].append(f"Player at index {i} missing required field: {field}")
                    results['valid'] = False
            
            # Check for duplicate player_ids
            player_id = player.get('player_id')
            if player_id in player_ids:
                results['errors'].append(f"Duplicate player_id found: {player_id}")
                results['valid'] = False
            player_ids.add(player_id)
            
            # Validate data types
            if 'seven_two_wins' in player and not isinstance(player['seven_two_wins'], int):
                results['warnings'].append(f"Player {player_id} has non-integer seven_two_wins")
    
    def _validate_sessions_data(self, sessions_data: List[Dict[str, Any]], results: Dict[str, Any]) -> None:
        """Validate sessions data structure."""
        session_ids = set()
        
        for i, session in enumerate(sessions_data):
            if not isinstance(session, dict):
                results['errors'].append(f"Session at index {i} is not a dictionary")
                results['valid'] = False
                continue
            
            # Check required fields
            required_fields = ['session_id', 'date']
            for field in required_fields:
                if field not in session:
                    results['errors'].append(f"Session at index {i} missing required field: {field}")
                    results['valid'] = False
            
            # Check for duplicate session_ids
            session_id = session.get('session_id')
            if session_id in session_ids:
                results['errors'].append(f"Duplicate session_id found: {session_id}")
                results['valid'] = False
            session_ids.add(session_id)
            
            # Validate date format
            date_str = session.get('date')
            if date_str:
                try:
                    from datetime import datetime
                    datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    results['errors'].append(f"Session {session_id} has invalid date format: {date_str}")
                    results['valid'] = False
    
    def _validate_entries_data(self, entries_data: List[Dict[str, Any]], results: Dict[str, Any]) -> None:
        """Validate entries data structure."""
        entry_ids = set()
        
        for i, entry in enumerate(entries_data):
            if not isinstance(entry, dict):
                results['errors'].append(f"Entry at index {i} is not a dictionary")
                results['valid'] = False
                continue
            
            # Check required fields
            required_fields = ['entry_id', 'session_id', 'player_id']
            for field in required_fields:
                if field not in entry:
                    results['errors'].append(f"Entry at index {i} missing required field: {field}")
                    results['valid'] = False
            
            # Check for duplicate entry_ids
            entry_id = entry.get('entry_id')
            if entry_id in entry_ids:
                results['errors'].append(f"Duplicate entry_id found: {entry_id}")
                results['valid'] = False
            entry_ids.add(entry_id)
    
    def _validate_cross_references(self, results: Dict[str, Any]) -> None:
        """Validate cross-references between tables."""
        # Load all data for cross-validation
        players_data = self._load_json_file('players.json')
        sessions_data = self._load_json_file('sessions.json')
        entries_data = self._load_json_file('entries.json')
        
        # Create sets of existing IDs
        player_ids = {p['player_id'] for p in players_data if 'player_id' in p}
        session_ids = {s['session_id'] for s in sessions_data if 'session_id' in s}
        
        # Check if entries reference valid players and sessions
        for entry in entries_data:
            if 'player_id' in entry and entry['player_id'] not in player_ids:
                results['errors'].append(f"Entry {entry.get('entry_id')} references non-existent player: {entry['player_id']}")
                results['valid'] = False
            
            if 'session_id' in entry and entry['session_id'] not in session_ids:
                results['errors'].append(f"Entry {entry.get('entry_id')} references non-existent session: {entry['session_id']}")
                results['valid'] = False
    
    def migrate_data(self, backup_first: bool = True) -> Dict[str, Any]:
        """
        Migrate data from JSON files to SQLite database.
        
        Args:
            backup_first: Whether to create a backup before migration
            
        Returns:
            Dictionary with migration results
        """
        migration_results = {
            'success': False,
            'backup_created': None,
            'json_backup_created': None,
            'migrated_counts': {},
            'errors': [],
            'warnings': []
        }
        
        with self.app.app_context():
            try:
                # Validate JSON data first
                validation_results = self.validate_json_data()
                if not validation_results['valid']:
                    migration_results['errors'].extend(validation_results['errors'])
                    return migration_results
                
                if validation_results['warnings']:
                    migration_results['warnings'].extend(validation_results['warnings'])
                
                # Create backups if requested
                if backup_first and self.backup_handler:
                    try:
                        # Backup JSON data
                        json_backup_path = self.backup_handler.backup_json_data(self.json_data_dir)
                        migration_results['json_backup_created'] = json_backup_path
                        
                        # Backup existing database if it exists
                        db_path = self.app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')
                        if os.path.exists(db_path):
                            db_backup_path = self.backup_handler.backup_database("Pre-migration backup")
                            migration_results['backup_created'] = db_backup_path
                    except Exception as e:
                        migration_results['warnings'].append(f"Backup creation failed: {str(e)}")
                
                # Create database tables
                db.create_all()
                
                # Migrate players first (no foreign key dependencies)
                players_count = self._migrate_players()
                migration_results['migrated_counts']['players'] = players_count
                
                # Migrate sessions (no foreign key dependencies)
                sessions_count = self._migrate_sessions()
                migration_results['migrated_counts']['sessions'] = sessions_count
                
                # Migrate entries (depends on players and sessions)
                entries_count = self._migrate_entries()
                migration_results['migrated_counts']['entries'] = entries_count
                
                migration_results['success'] = True
                logger.info(f"Migration completed successfully: {migration_results['migrated_counts']}")
                
            except Exception as e:
                migration_results['errors'].append(f"Migration failed: {str(e)}")
                logger.error(f"Migration failed: {str(e)}")
                
                # Rollback if possible
                try:
                    db.session.rollback()
                except:
                    pass
        
        return migration_results
    
    def _migrate_players(self) -> int:
        """
        Migrate players data.
        
        Returns:
            Number of players migrated
        """
        players_data = self._load_json_file('players.json')
        migrated_count = 0
        
        for player_data in players_data:
            try:
                # Check if player already exists
                existing_player = Player.query.filter_by(player_id=player_data['player_id']).first()
                if existing_player:
                    logger.warning(f"Player {player_data['player_id']} already exists, skipping")
                    continue
                
                player = Player.from_dict(player_data)
                db.session.add(player)
                migrated_count += 1
                
            except Exception as e:
                logger.error(f"Failed to migrate player {player_data.get('player_id', 'unknown')}: {str(e)}")
                raise
        
        db.session.commit()
        logger.info(f"Migrated {migrated_count} players")
        return migrated_count
    
    def _migrate_sessions(self) -> int:
        """
        Migrate sessions data.
        
        Returns:
            Number of sessions migrated
        """
        sessions_data = self._load_json_file('sessions.json')
        migrated_count = 0
        
        for session_data in sessions_data:
            try:
                # Check if session already exists
                existing_session = Session.query.filter_by(session_id=session_data['session_id']).first()
                if existing_session:
                    logger.warning(f"Session {session_data['session_id']} already exists, skipping")
                    continue
                
                session = Session.from_dict(session_data)
                db.session.add(session)
                migrated_count += 1
                
            except Exception as e:
                logger.error(f"Failed to migrate session {session_data.get('session_id', 'unknown')}: {str(e)}")
                raise
        
        db.session.commit()
        logger.info(f"Migrated {migrated_count} sessions")
        return migrated_count
    
    def _migrate_entries(self) -> int:
        """
        Migrate entries data.
        
        Returns:
            Number of entries migrated
        """
        entries_data = self._load_json_file('entries.json')
        migrated_count = 0
        
        for entry_data in entries_data:
            try:
                # Check if entry already exists
                existing_entry = Entry.query.filter_by(entry_id=entry_data['entry_id']).first()
                if existing_entry:
                    logger.warning(f"Entry {entry_data['entry_id']} already exists, skipping")
                    continue
                
                # Verify that referenced player and session exist
                player = Player.query.filter_by(player_id=entry_data['player_id']).first()
                session = Session.query.filter_by(session_id=entry_data['session_id']).first()
                
                if not player:
                    logger.error(f"Cannot migrate entry {entry_data['entry_id']}: player {entry_data['player_id']} not found")
                    continue
                
                if not session:
                    logger.error(f"Cannot migrate entry {entry_data['entry_id']}: session {entry_data['session_id']} not found")
                    continue
                
                entry = Entry.from_dict(entry_data)
                db.session.add(entry)
                migrated_count += 1
                
            except Exception as e:
                logger.error(f"Failed to migrate entry {entry_data.get('entry_id', 'unknown')}: {str(e)}")
                raise
        
        db.session.commit()
        logger.info(f"Migrated {migrated_count} entries")
        return migrated_count
    
    def verify_migration(self) -> Dict[str, Any]:
        """
        Verify that migration was successful by comparing counts and data integrity.
        
        Returns:
            Dictionary with verification results
        """
        verification_results = {
            'success': True,
            'json_counts': {},
            'db_counts': {},
            'data_integrity_checks': [],
            'errors': []
        }
        
        with self.app.app_context():
            try:
                # Get JSON counts
                verification_results['json_counts']['players'] = len(self._load_json_file('players.json'))
                verification_results['json_counts']['sessions'] = len(self._load_json_file('sessions.json'))
                verification_results['json_counts']['entries'] = len(self._load_json_file('entries.json'))
                
                # Get database counts
                verification_results['db_counts']['players'] = Player.query.count()
                verification_results['db_counts']['sessions'] = Session.query.count()
                verification_results['db_counts']['entries'] = Entry.query.count()
                
                # Compare counts
                for table in ['players', 'sessions', 'entries']:
                    json_count = verification_results['json_counts'][table]
                    db_count = verification_results['db_counts'][table]
                    
                    if json_count != db_count:
                        error_msg = f"{table.capitalize()} count mismatch: JSON={json_count}, DB={db_count}"
                        verification_results['errors'].append(error_msg)
                        verification_results['success'] = False
                
                # Data integrity checks
                self._verify_data_integrity(verification_results)
                
            except Exception as e:
                verification_results['errors'].append(f"Verification failed: {str(e)}")
                verification_results['success'] = False
        
        return verification_results
    
    def _verify_data_integrity(self, results: Dict[str, Any]) -> None:
        """Perform data integrity checks."""
        checks = []
        
        # Check that all entries have valid player and session references
        orphaned_entries = db.session.query(Entry).outerjoin(Player).outerjoin(Session).filter(
            (Player.id.is_(None)) | (Session.id.is_(None))
        ).count()
        
        if orphaned_entries > 0:
            results['errors'].append(f"Found {orphaned_entries} entries with invalid references")
            results['success'] = False
        else:
            checks.append("All entries have valid player and session references")
        
        # Check for duplicate player_ids
        duplicate_players = db.session.query(Player.player_id).group_by(Player.player_id).having(
            db.func.count(Player.player_id) > 1
        ).count()
        
        if duplicate_players > 0:
            results['errors'].append(f"Found {duplicate_players} duplicate player IDs")
            results['success'] = False
        else:
            checks.append("No duplicate player IDs found")
        
        # Check for duplicate session_ids
        duplicate_sessions = db.session.query(Session.session_id).group_by(Session.session_id).having(
            db.func.count(Session.session_id) > 1
        ).count()
        
        if duplicate_sessions > 0:
            results['errors'].append(f"Found {duplicate_sessions} duplicate session IDs")
            results['success'] = False
        else:
            checks.append("No duplicate session IDs found")
        
        results['data_integrity_checks'] = checks