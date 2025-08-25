"""
Frontend routes for Poker Night PWA.

This module contains routes for serving static frontend files.
"""

import os
import logging
from typing import Any
from flask import Blueprint, render_template, send_from_directory, Response, abort

from ..config import Config

logger = logging.getLogger(__name__)
frontend_bp = Blueprint('frontend', __name__)


@frontend_bp.route('/', methods=['GET', 'POST'])
def serve_index() -> str:
    """
    Serve the main index page.
    
    Returns:
        Rendered HTML template
    """
    return render_template('index.html')


@frontend_bp.route('/manifest.json')
def serve_manifest() -> Response:
    """
    Serve the PWA manifest file with no-cache headers.
    
    Returns:
        Manifest JSON file with cache-control headers
    """
    config = Config()
    response = send_from_directory(config.FRONTEND_DIR, 'manifest.json')
    
    # Set headers to prevent caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response


@frontend_bp.route('/sw.js')
def serve_sw() -> Response:
    """
    Serve the service worker file with no-cache headers.
    
    Returns:
        Service worker JavaScript file with cache-control headers
    """
    config = Config()
    # static_folder is STATIC_DIR, so sw.js should be in STATIC_DIR/js/
    response = send_from_directory(
        os.path.join(config.STATIC_DIR, 'js'), 
        'sw.js'
    )
    
    # Set headers to prevent caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    
    return response


@frontend_bp.route('/.env')
def block_env_file() -> None:
    """
    Explicitly block access to .env file.
    
    Raises:
        404 error for .env file access attempts
    """
    logger.warning("Blocked access attempt to .env file")
    abort(404)