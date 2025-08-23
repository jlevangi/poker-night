"""
Configuration endpoint for frontend.

This module provides a secure endpoint that exposes only non-sensitive 
configuration values to the frontend.
"""

from flask import Blueprint, jsonify
from app.config import Config

config_bp = Blueprint('config', __name__)

@config_bp.route('/config', methods=['GET'])
def get_public_config():
    """
    Get public configuration values safe for frontend use.
    
    Only exposes non-sensitive configuration that the frontend needs.
    Never exposes secrets, passwords, or private keys.
    
    Returns:
        JSON response with public configuration values
    """
    config = Config()
    
    # Only expose safe, non-sensitive configuration values
    public_config = {
        'APP_VERSION': getattr(config, 'APP_VERSION', '1.0.0'),
        'API_BASE_URL': '/api',
        'CACHE_NAME_PREFIX': 'gamble-king-cache',
        'DEBUG_MODE': getattr(config, 'DEBUG', False),
        'CACHE_BUST_VALUE': 1
    }
    
    return jsonify(public_config)