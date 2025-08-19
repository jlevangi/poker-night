#!/usr/bin/env python3
"""
Migration script to convert JSON data to SQLite database.

This script performs the migration from JSON files to SQLite database,
with backup, validation, and testing capabilities.
"""

import os
import sys
import argparse
import logging
from flask import Flask
from werkzeug.security import generate_password_hash

# Add the backend directory to Python path
backend_dir = os.path.dirname(__file__)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from app.config import DevelopmentConfig
from app.database.migration import DataMigration
from app.database.backup import DatabaseBackup
from app.utils.validation import DataValidator
from app.utils.testing import DataTester

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_admin_password():
    """Set up admin password hash."""
    print("\n=== Admin Password Setup ===")
    password = input("Enter admin password (default: admin123): ").strip()
    if not password:
        password = "admin123"
    
    password_hash = generate_password_hash(password)
    print(f"\nGenerated password hash:")
    print(f"ADMIN_PASSWORD_HASH={password_hash}")
    print(f"\nSet this as an environment variable or update your config.py file.")
    print(f"Default password is 'admin123' - CHANGE THIS IN PRODUCTION!")
    
    return password_hash


def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(description="Migrate Poker Night data from JSON to SQLite")
    parser.add_argument(
        '--json-dir',
        default=None,
        help="Directory containing JSON files (default: ../poker_data)"
    )
    parser.add_argument(
        '--backup',
        action='store_true',
        default=True,
        help="Create backups before migration (default: True)"
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help="Skip backup creation"
    )
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help="Only validate JSON data, don't migrate"
    )
    parser.add_argument(
        '--test-only',
        action='store_true',
        help="Only test database operations, don't migrate"
    )
    parser.add_argument(
        '--setup-admin',
        action='store_true',
        help="Set up admin password hash"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help="Force migration even if validation fails (use with caution)"
    )
    
    args = parser.parse_args()
    
    # Handle admin password setup
    if args.setup_admin:
        setup_admin_password()
        return
    
    # Determine JSON data directory
    if args.json_dir:
        json_data_dir = args.json_dir
    else:
        # Default to poker_data directory in project root
        project_root = os.path.dirname(backend_dir)
        json_data_dir = os.path.join(project_root, 'poker_data')
    
    if not os.path.exists(json_data_dir):
        logger.error(f"JSON data directory not found: {json_data_dir}")
        return 1
    
    logger.info(f"Using JSON data directory: {json_data_dir}")
    
    # Create Flask app
    app = create_app(DevelopmentConfig)
    
    with app.app_context():
        # Initialize migration handler
        migration = DataMigration(app, json_data_dir)
        
        # Validate JSON data first
        print("\n=== Validating JSON Data ===")
        validation_results = migration.validate_json_data()
        
        if validation_results['valid']:
            print("✓ JSON data validation passed")
            print(f"Found: {validation_results['counts']}")
        else:
            print("✗ JSON data validation failed")
            for error in validation_results['errors']:
                print(f"  ERROR: {error}")
            
            if validation_results['warnings']:
                print("Warnings:")
                for warning in validation_results['warnings']:
                    print(f"  WARNING: {warning}")
            
            if not args.force:
                print("\nMigration aborted due to validation errors.")
                print("Use --force to proceed anyway (not recommended).")
                return 1
        
        # Handle validate-only mode
        if args.validate_only:
            print("\nValidation complete. No migration performed.")
            return 0 if validation_results['valid'] else 1
        
        # Handle test-only mode
        if args.test_only:
            print("\n=== Testing Database Operations ===")
            tester = DataTester()
            test_results = tester.test_database_operations()
            
            if test_results['passed']:
                print("✓ All database operation tests passed")
            else:
                print("✗ Some database operation tests failed")
                for error in test_results['errors']:
                    print(f"  ERROR: {error}")
            
            return 0 if test_results['passed'] else 1
        
        # Perform migration
        print("\n=== Performing Migration ===")
        backup_first = args.backup and not args.no_backup
        
        migration_results = migration.migrate_data(backup_first=backup_first)
        
        if migration_results['success']:
            print("✓ Migration completed successfully")
            print(f"Migrated: {migration_results['migrated_counts']}")
            
            if migration_results.get('backup_created'):
                print(f"Database backup created: {migration_results['backup_created']}")
            if migration_results.get('json_backup_created'):
                print(f"JSON backup created: {migration_results['json_backup_created']}")
        else:
            print("✗ Migration failed")
            for error in migration_results['errors']:
                print(f"  ERROR: {error}")
            return 1
        
        # Verify migration
        print("\n=== Verifying Migration ===")
        verification_results = migration.verify_migration()
        
        if verification_results['success']:
            print("✓ Migration verification passed")
            print(f"Counts - JSON: {verification_results['json_counts']}, "
                  f"DB: {verification_results['db_counts']}")
            
            for check in verification_results['data_integrity_checks']:
                print(f"  ✓ {check}")
        else:
            print("✗ Migration verification failed")
            for error in verification_results['errors']:
                print(f"  ERROR: {error}")
            return 1
        
        # Test migrated data
        print("\n=== Testing Migrated Data ===")
        tester = DataTester()
        test_results = tester.test_migration_integrity(json_data_dir)
        
        if test_results['passed']:
            print("✓ Migration integrity tests passed")
            print(f"Tests: {test_results['summary']['passed_tests']}/{test_results['summary']['total_tests']}")
        else:
            print("✗ Migration integrity tests failed")
            print(f"Tests: {test_results['summary']['passed_tests']}/{test_results['summary']['total_tests']}")
            for error in test_results['errors'][:5]:  # Show first 5 errors
                print(f"  ERROR: {error}")
            if len(test_results['errors']) > 5:
                print(f"  ... and {len(test_results['errors']) - 5} more errors")
            return 1
        
        # Final validation
        print("\n=== Final Database Validation ===")
        validator = DataValidator()
        final_validation = validator.validate_all_data()
        
        if final_validation['valid']:
            print("✓ Final database validation passed")
            print(f"Database statistics: {final_validation['statistics']}")
        else:
            print("✗ Final database validation failed")
            for error in final_validation['errors'][:5]:  # Show first 5 errors
                print(f"  ERROR: {error}")
            if len(final_validation['errors']) > 5:
                print(f"  ... and {len(final_validation['errors']) - 5} more errors")
        
        if final_validation['warnings']:
            print("Warnings:")
            for warning in final_validation['warnings'][:3]:  # Show first 3 warnings
                print(f"  WARNING: {warning}")
            if len(final_validation['warnings']) > 3:
                print(f"  ... and {len(final_validation['warnings']) - 3} more warnings")
        
        print("\n=== Migration Summary ===")
        print(f"✓ JSON data validated: {validation_results['valid']}")
        print(f"✓ Migration completed: {migration_results['success']}")
        print(f"✓ Migration verified: {verification_results['success']}")
        print(f"✓ Integrity tests passed: {test_results['passed']}")
        print(f"✓ Final validation passed: {final_validation['valid']}")
        
        if migration_results.get('json_backup_created'):
            print(f"\nJSON backup stored at: {migration_results['json_backup_created']}")
        if migration_results.get('backup_created'):
            print(f"Database backup stored at: {migration_results['backup_created']}")
        
        print(f"\nDatabase location: {app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')}")
        print("\nMigration completed successfully! 🎉")
        print("\nYou can now start the application with:")
        print("  python run.py")
        print("\nAdmin interface will be available at:")
        print("  http://localhost:5000/admin/")
        
        return 0


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)