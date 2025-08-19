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
    
    def _calculate_paths(self) -> None:
        """Calculate application paths relative to backend directory."""
        self.SCRIPT_DIR = os.path.dirname(os.path.dirname(__file__))
        self.PROJECT_ROOT = os.path.abspath(os.path.join(self.SCRIPT_DIR, '..'))
        self.FRONTEND_DIR = os.path.join(self.PROJECT_ROOT, 'frontend')
        self.STATIC_DIR = os.path.join(self.FRONTEND_DIR, 'static')
        self.TEMPLATE_DIR = os.path.join(self.FRONTEND_DIR, 'templates')
        
    def _load_app_version(self) -> None:
        """Load APP_VERSION from frontend/.env file."""
        env_file_path = os.path.join(self.FRONTEND_DIR, '.env')
        self.APP_VERSION = '1.0.5'  # Default fallback version
        
        try:
            with open(env_file_path, 'r') as f:
                for line in f:
                    if line.strip() and not line.strip().startswith('#'):
                        if '=' in line:
                            key, value = line.strip().split('=', 1)
                            if key.strip() == 'APP_VERSION':
                                self.APP_VERSION = value.strip()
                                break
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error reading .env file: {e}")
    
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


class ProductionConfig(Config):
    """Production configuration."""
    
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    
    TESTING = True
    DEBUG = True