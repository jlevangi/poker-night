"""
Database backup functionality for Poker Night PWA.

This module provides utilities for backing up and restoring database data.
"""

import os
import json
import shutil
import sqlite3
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class DatabaseBackup:
    """
    Handles database backup and restore operations.
    """
    
    def __init__(self, db_path: str, backup_dir: str):
        """
        Initialize DatabaseBackup.
        
        Args:
            db_path: Path to the SQLite database file
            backup_dir: Directory to store backups
        """
        self.db_path = db_path
        self.backup_dir = backup_dir
        self.ensure_backup_dir()
    
    def ensure_backup_dir(self) -> None:
        """Ensure the backup directory exists."""
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def backup_json_data(self, json_data_dir: str) -> str:
        """
        Backup existing JSON data files before migration.
        
        Args:
            json_data_dir: Directory containing JSON data files
            
        Returns:
            Path to the backup directory
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(self.backup_dir, f"json_backup_{timestamp}")
        
        try:
            # Copy entire JSON data directory
            shutil.copytree(json_data_dir, backup_path)
            logger.info(f"JSON data backed up to: {backup_path}")
            return backup_path
        except Exception as e:
            logger.error(f"Failed to backup JSON data: {str(e)}")
            raise
    
    def backup_database(self, description: str = "Manual backup") -> str:
        """
        Create a backup of the SQLite database.
        
        Args:
            description: Description of the backup
            
        Returns:
            Path to the backup file
        """
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database file not found: {self.db_path}")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"poker_db_backup_{timestamp}.db"
        backup_path = os.path.join(self.backup_dir, backup_filename)
        
        try:
            # Create a backup using SQLite's backup API
            source_conn = sqlite3.connect(self.db_path)
            backup_conn = sqlite3.connect(backup_path)
            
            source_conn.backup(backup_conn)
            
            source_conn.close()
            backup_conn.close()
            
            # Create metadata file
            metadata = {
                "backup_date": datetime.now().isoformat(),
                "description": description,
                "source_db": self.db_path,
                "backup_file": backup_filename
            }
            
            metadata_path = os.path.join(self.backup_dir, f"backup_metadata_{timestamp}.json")
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Database backed up to: {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Failed to backup database: {str(e)}")
            raise
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """
        List all available backups.
        
        Returns:
            List of backup information dictionaries
        """
        backups = []
        
        if not os.path.exists(self.backup_dir):
            return backups
        
        for filename in os.listdir(self.backup_dir):
            if filename.startswith("backup_metadata_") and filename.endswith(".json"):
                metadata_path = os.path.join(self.backup_dir, filename)
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                        
                    # Check if backup file still exists
                    backup_file_path = os.path.join(self.backup_dir, metadata['backup_file'])
                    if os.path.exists(backup_file_path):
                        metadata['backup_size'] = os.path.getsize(backup_file_path)
                        metadata['backup_exists'] = True
                    else:
                        metadata['backup_exists'] = False
                    
                    backups.append(metadata)
                    
                except Exception as e:
                    logger.warning(f"Could not read backup metadata from {filename}: {str(e)}")
        
        # Sort by backup date, newest first
        backups.sort(key=lambda x: x.get('backup_date', ''), reverse=True)
        return backups
    
    def restore_database(self, backup_filename: str) -> bool:
        """
        Restore database from a backup file.
        
        Args:
            backup_filename: Name of the backup file to restore from
            
        Returns:
            True if restore was successful, False otherwise
        """
        backup_path = os.path.join(self.backup_dir, backup_filename)
        
        if not os.path.exists(backup_path):
            logger.error(f"Backup file not found: {backup_path}")
            return False
        
        try:
            # Create a backup of current database before restoring
            if os.path.exists(self.db_path):
                current_backup = self.backup_database("Pre-restore backup")
                logger.info(f"Current database backed up to: {current_backup}")
            
            # Copy backup file to database location
            shutil.copy2(backup_path, self.db_path)
            
            logger.info(f"Database restored from: {backup_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to restore database: {str(e)}")
            return False
    
    def export_data_to_json(self, output_dir: str) -> Dict[str, str]:
        """
        Export all database data to JSON files.
        
        Args:
            output_dir: Directory to write JSON files
            
        Returns:
            Dictionary mapping table names to output file paths
        """
        os.makedirs(output_dir, exist_ok=True)
        
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Database file not found: {self.db_path}")
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        
        output_files = {}
        
        try:
            tables = ['players', 'sessions', 'entries']
            
            for table in tables:
                cursor = conn.execute(f"SELECT * FROM {table}")
                rows = cursor.fetchall()
                
                # Convert rows to dictionaries
                data = [dict(row) for row in rows]
                
                # Write to JSON file
                output_file = os.path.join(output_dir, f"{table}.json")
                with open(output_file, 'w') as f:
                    json.dump(data, f, indent=2, default=str)  # default=str handles datetime
                
                output_files[table] = output_file
                logger.info(f"Exported {len(data)} records from {table} to {output_file}")
            
            return output_files
            
        except Exception as e:
            logger.error(f"Failed to export data to JSON: {str(e)}")
            raise
        finally:
            conn.close()
    
    def cleanup_old_backups(self, keep_count: int = 10) -> int:
        """
        Remove old backup files, keeping only the most recent ones.
        
        Args:
            keep_count: Number of backups to keep
            
        Returns:
            Number of backups removed
        """
        backups = self.list_backups()
        
        if len(backups) <= keep_count:
            return 0
        
        backups_to_remove = backups[keep_count:]
        removed_count = 0
        
        for backup in backups_to_remove:
            try:
                # Remove backup file
                backup_file_path = os.path.join(self.backup_dir, backup['backup_file'])
                if os.path.exists(backup_file_path):
                    os.remove(backup_file_path)
                
                # Remove metadata file (extract timestamp from backup_file)
                timestamp = backup['backup_file'].replace('poker_db_backup_', '').replace('.db', '')
                metadata_file = os.path.join(self.backup_dir, f"backup_metadata_{timestamp}.json")
                if os.path.exists(metadata_file):
                    os.remove(metadata_file)
                
                removed_count += 1
                logger.info(f"Removed old backup: {backup['backup_file']}")
                
            except Exception as e:
                logger.warning(f"Failed to remove backup {backup['backup_file']}: {str(e)}")
        
        return removed_count