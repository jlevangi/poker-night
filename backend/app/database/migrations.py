"""
Auto-migration system for Poker Night PWA.

This module handles automatic database schema migrations by detecting
missing columns and applying necessary changes during application startup.
"""

import logging
import sqlite3
from typing import List, Dict, Any
from flask import Flask

from .models import db

logger = logging.getLogger(__name__)


class AutoMigration:
    """Handles automatic database migrations."""
    
    @staticmethod
    def get_table_columns(db_path: str, table_name: str) -> List[str]:
        """
        Get column names for a specific table.
        
        Args:
            db_path: Path to SQLite database
            table_name: Name of the table
            
        Returns:
            List of column names
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [column[1] for column in cursor.fetchall()]
            conn.close()
            return columns
        except sqlite3.Error as e:
            logger.error(f"Error reading table columns: {e}")
            return []
    
    @staticmethod
    def add_is_cashed_out_column(db_path: str) -> bool:
        """
        Add is_cashed_out column to entries table if missing.
        
        Args:
            db_path: Path to SQLite database
            
        Returns:
            True if migration was needed and successful, False if column already exists
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check if column already exists
            cursor.execute("PRAGMA table_info(entries)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'is_cashed_out' in columns:
                logger.info("Column 'is_cashed_out' already exists")
                conn.close()
                return False
            
            logger.info("Adding 'is_cashed_out' column to entries table...")
            
            # Add the new column with default value False
            cursor.execute("""
                ALTER TABLE entries 
                ADD COLUMN is_cashed_out BOOLEAN NOT NULL DEFAULT 0
            """)
            
            # Update existing entries: set is_cashed_out to True where payout > 0
            cursor.execute("""
                UPDATE entries 
                SET is_cashed_out = 1 
                WHERE payout > 0
            """)
            
            conn.commit()
            affected_rows = cursor.rowcount
            logger.info(f"Successfully added 'is_cashed_out' column. Updated {affected_rows} existing entries.")
            conn.close()
            return True
            
        except sqlite3.Error as e:
            logger.error(f"Error adding is_cashed_out column: {e}")
            if conn:
                conn.close()
            return False
    
    @staticmethod
    def add_session_strikes_column(db_path: str) -> bool:
        """
        Add session_strikes column to entries table if missing.
        
        Args:
            db_path: Path to SQLite database
            
        Returns:
            True if migration was needed and successful, False if column already exists
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check if column already exists
            cursor.execute("PRAGMA table_info(entries)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'session_strikes' in columns:
                logger.info("Column 'session_strikes' already exists")
                conn.close()
                return False
            
            logger.info("Adding 'session_strikes' column to entries table...")
            
            # Add the new column with default value 0
            cursor.execute("""
                ALTER TABLE entries 
                ADD COLUMN session_strikes INTEGER NOT NULL DEFAULT 0
            """)
            
            conn.commit()
            logger.info("Successfully added 'session_strikes' column.")
            conn.close()
            return True
            
        except sqlite3.Error as e:
            logger.error(f"Error adding session_strikes column: {e}")
            if conn:
                conn.close()
            return False
    
    @staticmethod
    def create_calendar_tables(db_path: str) -> bool:
        """
        Create calendar_events and event_rsvps tables if they don't exist.

        Args:
            db_path: Path to SQLite database

        Returns:
            True if migration was needed and successful, False if tables already exist
        """
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # Check if table already exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events'")
            if cursor.fetchone():
                logger.info("Table 'calendar_events' already exists")
                conn.close()
                return False

            logger.info("Creating calendar_events and event_rsvps tables...")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id VARCHAR(30) UNIQUE NOT NULL,
                    title VARCHAR(200) NOT NULL DEFAULT 'Poker Night',
                    date VARCHAR(10) NOT NULL,
                    time VARCHAR(5),
                    location VARCHAR(200),
                    description TEXT,
                    default_buy_in_value FLOAT NOT NULL DEFAULT 20.00,
                    max_players INTEGER,
                    session_id VARCHAR(30) REFERENCES sessions(session_id),
                    is_cancelled BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_rsvps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id VARCHAR(30) NOT NULL REFERENCES calendar_events(event_id),
                    player_id VARCHAR(20) NOT NULL REFERENCES players(player_id),
                    status VARCHAR(10) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(event_id, player_id)
                )
            """)

            conn.commit()
            logger.info("Successfully created calendar_events and event_rsvps tables.")
            conn.close()
            return True

        except sqlite3.Error as e:
            logger.error(f"Error creating calendar tables: {e}")
            if conn:
                conn.close()
            return False

    @staticmethod
    def run_auto_migrations(app: Flask) -> None:
        """
        Run all necessary auto-migrations during app startup.
        
        Args:
            app: Flask application instance
        """
        logger.info("Checking for required database migrations...")
        
        # Get database path from SQLAlchemy config
        database_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if not database_uri.startswith('sqlite:///'):
            logger.warning("Auto-migrations only supported for SQLite databases")
            return
        
        # Extract path from URI (remove 'sqlite:///' prefix)
        db_path = database_uri.replace('sqlite:///', '')
        
        migrations_applied = []
        
        # Run individual migrations
        if AutoMigration.add_is_cashed_out_column(db_path):
            migrations_applied.append("is_cashed_out column")
        
        if AutoMigration.add_session_strikes_column(db_path):
            migrations_applied.append("session_strikes column")

        if AutoMigration.create_calendar_tables(db_path):
            migrations_applied.append("calendar tables")

        if migrations_applied:
            logger.info(f"Auto-migrations completed: {', '.join(migrations_applied)}")
        else:
            logger.info("No migrations needed - database schema is up to date")