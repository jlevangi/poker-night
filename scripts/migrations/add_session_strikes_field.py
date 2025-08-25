#!/usr/bin/env python3
"""
Database migration script to add session_strikes field to entries table.

This migration adds the new integer field 'session_strikes' to the entries table
to track strikes per player per session, similar to seven_two_wins.
"""

import sqlite3
import sys
import os
from pathlib import Path

def migrate_database(database_path):
    """
    Add session_strikes column to entries table.
    
    Args:
        database_path: Path to the SQLite database file
    """
    try:
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(entries)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'session_strikes' in columns:
            print(f"Column 'session_strikes' already exists in {database_path}")
            return
        
        print(f"Adding 'session_strikes' column to entries table in {database_path}...")
        
        # Add the new column with default value 0
        cursor.execute("""
            ALTER TABLE entries 
            ADD COLUMN session_strikes INTEGER NOT NULL DEFAULT 0
        """)
        
        conn.commit()
        print(f"Migration completed successfully!")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

def main():
    """Main migration function."""
    # Look for database files in common locations
    possible_db_paths = [
        "backend/poker_data/poker_night.db",
        "poker_data/poker_night.db",
        "../poker_data/poker_night.db",
        "poker_night.db"
    ]
    
    databases_found = []
    
    for db_path in possible_db_paths:
        if os.path.exists(db_path):
            databases_found.append(db_path)
    
    if not databases_found:
        print("No database files found. Checked locations:")
        for path in possible_db_paths:
            print(f"  - {path}")
        print("\nPlease run this script from the project root directory or specify the database path.")
        sys.exit(1)
    
    print(f"Found {len(databases_found)} database(s):")
    for db_path in databases_found:
        print(f"  - {db_path}")
    
    for db_path in databases_found:
        migrate_database(db_path)
    
    print("\nMigration completed for all databases!")
    print("\nAdded 'session_strikes' field to track strikes per player per session.")

if __name__ == "__main__":
    main()