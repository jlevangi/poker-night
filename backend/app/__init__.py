"""
Flask application factory for Poker Night PWA.

This module creates and configures the Flask application using the application factory pattern.
"""

import os
import sys
import logging
from typing import Optional
from flask import Flask

from .config import Config
from .routes.players import players_bp
from .routes.sessions import sessions_bp
from .routes.chip_calculator import chip_calculator_bp
from .routes.frontend import frontend_bp
from .services.data_service import DataService


def create_app(config_class: type = Config) -> Flask:
    """
    Create and configure Flask application instance.
    
    Args:
        config_class: Configuration class to use for the application
        
    Returns:
        Configured Flask application instance
    """
    # Add scripts directory to Python path for importing chip_calculator
    scripts_dir = os.path.join(os.path.dirname(__file__), '..', 'scripts')
    if scripts_dir not in sys.path:
        sys.path.append(scripts_dir)
    
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Configure logging
    setup_logging(app)
    
    # Initialize data files
    data_service = DataService()
    data_service.initialize_data_files()
    
    # Register blueprints
    app.register_blueprint(players_bp, url_prefix='/api')
    app.register_blueprint(sessions_bp, url_prefix='/api')
    app.register_blueprint(chip_calculator_bp, url_prefix='/api')
    app.register_blueprint(frontend_bp)
    
    # Add context processor for versioned static URLs
    @app.context_processor
    def versioned_static():
        def versioned_url(filename):
            from flask import url_for
            return url_for('static', filename=filename, v=app.config['APP_VERSION'])
        return dict(versioned_url=versioned_url)
    
    return app


def setup_logging(app: Flask) -> None:
    """
    Configure application logging.
    
    Args:
        app: Flask application instance
    """
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('poker_app.log'),
            logging.StreamHandler()
        ]
    )
    
    logger = logging.getLogger(__name__)
    logger.info("Logging configured for Poker Night application")