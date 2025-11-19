#!/usr/bin/env python3
"""
Generate a password hash for the Poker Night admin interface.

This script generates a secure password hash that can be used in the .env file
for ADMIN_PASSWORD_HASH configuration.
"""

import sys
from werkzeug.security import generate_password_hash


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_password_hash.py <password>")
        print("\nExample:")
        print("  python scripts/generate_password_hash.py mySecurePassword123")
        sys.exit(1)
    
    password = sys.argv[1]
    
    if len(password) < 6:
        print("Error: Password must be at least 6 characters long.")
        sys.exit(1)
    
    # Generate the hash using werkzeug's default settings (scrypt)
    password_hash = generate_password_hash(password)
    
    print("\n" + "="*80)
    print("Generated Password Hash")
    print("="*80)
    print(f"\nPassword: {password}")
    print(f"\nHash: {password_hash}")
    print("\n" + "="*80)
    print("Instructions:")
    print("="*80)
    print("\n1. Copy the hash above (starting with 'scrypt:...')")
    print("2. Edit your .env file: nano /root/poker-night/.env")
    print("3. Replace the ADMIN_PASSWORD_HASH value with the new hash")
    print("4. Restart the service: systemctl restart poker-night.service")
    print("\n" + "="*80)


if __name__ == '__main__':
    main()
