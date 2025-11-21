#!/usr/bin/env python3
"""
Database migration script to add wisdom quote fields to sessions table.

This migration adds 'wisdom_quote' and 'wisdom_player_id' fields to the sessions table
to store the "Words of Wisdom" feature data.
"""

import sqlite3
import sys
import os
from pathlib import Path

def migrate_database(database_path):
    """
    Add wisdom_quote and wisdom_player_id columns to sessions table.

    Args:
        database_path: Path to the SQLite database file
    """
    try:
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()

        # Check if columns already exist
        cursor.execute("PRAGMA table_info(sessions)")
        columns = [column[1] for column in cursor.fetchall()]

        migrations_needed = []

        if 'wisdom_quote' not in columns:
            migrations_needed.append(('wisdom_quote', 'TEXT'))
        else:
            print(f"Column 'wisdom_quote' already exists in {database_path}")

        if 'wisdom_player_id' not in columns:
            migrations_needed.append(('wisdom_player_id', 'VARCHAR(20)'))
        else:
            print(f"Column 'wisdom_player_id' already exists in {database_path}")

        if not migrations_needed:
            print(f"All wisdom columns already exist in {database_path}")
            return

        for column_name, column_type in migrations_needed:
            print(f"Adding '{column_name}' column to sessions table in {database_path}...")
            cursor.execute(f"""
                ALTER TABLE sessions
                ADD COLUMN {column_name} {column_type}
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
    print("\nAdded 'wisdom_quote' and 'wisdom_player_id' fields for Words of Wisdom feature.")

if __name__ == "__main__":
    main()
