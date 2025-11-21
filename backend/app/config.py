"""
Configuration management for Poker Night PWA.

This module handles application configuration including path calculations and environment variables.
"""

import os
from typing import Optional


class Config:
    """Base configuration class for the application."""
    
    def __init__(self):
        """Initialize configuration with calculated paths."""
        self._calculate_paths()
        self._load_app_version()
        self._setup_database_config()
        self._load_admin_config()
    
    def _calculate_paths(self) -> None:
        """Calculate application paths relative to backend directory."""
        self.SCRIPT_DIR = os.path.dirname(os.path.dirname(__file__))
        self.PROJECT_ROOT = os.path.abspath(os.path.join(self.SCRIPT_DIR, '..'))
        self.FRONTEND_DIR = os.path.join(self.PROJECT_ROOT, 'frontend')
        self.STATIC_DIR = os.path.join(self.FRONTEND_DIR, 'static')
        self.TEMPLATE_DIR = os.path.join(self.FRONTEND_DIR, 'templates')
    
    def _setup_database_config(self) -> None:
        """Set up database configuration."""
        # SQLite database path
        db_dir = os.path.join(self.PROJECT_ROOT, 'poker_data')
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, 'poker_night.db')
        
        self.SQLALCHEMY_DATABASE_URI = f'sqlite:///{db_path}'
        self.SQLALCHEMY_TRACK_MODIFICATIONS = False
        self.SQLALCHEMY_ECHO = False  # Set to True for SQL debugging
        
        # Session security
        self.SECRET_KEY = os.environ.get('SECRET_KEY', 'poker-night-admin-secret-key-change-in-production')
        
    def _load_app_version(self) -> None:
        """Load APP_VERSION from root version.txt file."""
        version_file_path = os.path.join(self.PROJECT_ROOT, 'version.txt')
        self.APP_VERSION = '1.0.0'  # Default fallback version

        try:
            with open(version_file_path, 'r') as f:
                version = f.read().strip()
                if version:
                    self.APP_VERSION = version
        except FileNotFoundError:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"version.txt file not found at {version_file_path}, using default version")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error reading version.txt file: {e}")
    
    def _load_admin_config(self) -> None:
        """Load admin configuration from environment variables and .env file."""
        # Try to load from root .env file first
        root_env_file = os.path.join(self.PROJECT_ROOT, '.env')
        admin_password_hash = None
        
        if os.path.exists(root_env_file):
            try:
                with open(root_env_file, 'r') as f:
                    for line in f:
                        if line.strip() and not line.strip().startswith('#'):
                            if '=' in line:
                                key, value = line.strip().split('=', 1)
                                if key.strip() == 'ADMIN_PASSWORD_HASH':
                                    admin_password_hash = value.strip()
                                    break
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Error reading root .env file: {e}")
        
        # Fall back to environment variable or default
        self.ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH', admin_password_hash)
        
        # If still no hash, generate one for 'admin123'
        if not self.ADMIN_PASSWORD_HASH:
            from werkzeug.security import generate_password_hash
            self.ADMIN_PASSWORD_HASH = generate_password_hash('admin123')
    
    def log_paths_if_debug(self, debug_paths: bool = False) -> None:
        """Log calculated paths if debug flag is enabled."""
        if debug_paths:
            import logging
            logger = logging.getLogger(__name__)
            logger.info("--- PATH DEBUGGING ENABLED ---")
            logger.info(f"DEBUG: SCRIPT_DIR (backend location): {self.SCRIPT_DIR}")
            logger.info(f"DEBUG: Calculated PROJECT_ROOT: {self.PROJECT_ROOT}")
            logger.info(f"DEBUG: Calculated FRONTEND_DIR: {self.FRONTEND_DIR}")
            logger.info(f"DEBUG: Calculated STATIC_DIR: {self.STATIC_DIR}")
            logger.info(f"DEBUG: Calculated TEMPLATE_DIR: {self.TEMPLATE_DIR}")
            
            image_path = os.path.join(self.STATIC_DIR, 'images', 'icon-192x192.png')
            logger.info(f"DEBUG: Expected image path: {image_path}")
            logger.info(f"DEBUG: Image file exists: {os.path.exists(image_path)}")
            logger.info("--- END PATH DEBUGGING ---")


class DevelopmentConfig(Config):
    """Development configuration."""
    
    DEBUG = True
    SQLALCHEMY_ECHO = True  # Enable SQL logging in development


class ProductionConfig(Config):
    """Production configuration."""
    
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    
    TESTING = True
    DEBUG = True