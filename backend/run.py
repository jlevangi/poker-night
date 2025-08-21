"""
Main entry point for Poker Night PWA.

This module serves as the main entry point for running the Flask application.
It handles command-line arguments and starts the development server.
"""

import argparse
import logging
from typing import Type

from app import create_app
from app.config import Config, DevelopmentConfig, ProductionConfig


def parse_arguments() -> argparse.Namespace:
    """
    Parse command-line arguments.
    
    Returns:
        Parsed command-line arguments
    """
    parser = argparse.ArgumentParser(description="Run the Poker Night PWA Flask backend.")
    parser.add_argument(
        '--debug-paths',
        action='store_true',
        help="Enable verbose printing of calculated paths for debugging static/template folder setup."
    )
    parser.add_argument(
        '--port',
        type=int,
        default=5000,
        help="Port number to run the Flask server on (default: 5000)."
    )
    parser.add_argument(
        '--config',
        choices=['development', 'production'],
        default='development',
        help="Configuration to use (default: development)."
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help="Enable Flask debug mode."
    )
    
    return parser.parse_args()


def get_config_class(config_name: str) -> Type[Config]:
    """
    Get configuration class based on name.
    
    Args:
        config_name: Name of the configuration to use
        
    Returns:
        Configuration class
    """
    config_mapping = {
        'development': DevelopmentConfig,
        'production': ProductionConfig
    }
    
    return config_mapping.get(config_name, DevelopmentConfig)


def main() -> None:
    """Main function to run the application."""
    args = parse_arguments()
    
    # Get configuration class
    config_class = get_config_class(args.config)
    
    # Create Flask application
    app = create_app(config_class)
    
    # Configure Flask instance with calculated paths
    config = config_class()
    app.template_folder = config.TEMPLATE_DIR
    app.static_folder = config.STATIC_DIR
    
    # Enable debug path logging if requested
    if args.debug_paths:
        config.log_paths_if_debug(debug_paths=True)
    
    # Set up logging
    logger = logging.getLogger(__name__)
    
    # Determine debug mode
    flask_debug_mode = args.debug or (args.config == 'development')
    
    # Log startup information
    if args.debug_paths:
        logger.info(
            f"Flask app starting with debug_mode={flask_debug_mode} "
            f"and --debug-paths enabled."
        )
    else:
        logger.info(
            f"Flask app starting with debug_mode={flask_debug_mode}. "
            f"Use --debug-paths to see path calculations."
        )
    
    # Start the Flask development server
    app.run(
        debug=flask_debug_mode,
        host='0.0.0.0',
        port=args.port
    )


if __name__ == '__main__':
    main()