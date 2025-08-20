"""
Cache control utilities for Poker Night PWA.

This module provides utilities for setting appropriate cache headers
on API responses to ensure clients get fresh data when needed.
"""

from typing import Dict, Any, Optional
from flask import Response, jsonify
import hashlib
import json
import time


def set_no_cache_headers(response: Response) -> Response:
    """
    Set headers to prevent caching of dynamic content.
    
    Args:
        response: Flask response object
        
    Returns:
        Response with no-cache headers set
    """
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


def set_short_cache_headers(response: Response, max_age: int = 60) -> Response:
    """
    Set headers for short-term caching (1 minute default).
    
    Args:
        response: Flask response object
        max_age: Cache duration in seconds
        
    Returns:
        Response with short cache headers set
    """
    response.headers['Cache-Control'] = f'public, max-age={max_age}, must-revalidate'
    return response


def create_etag(data: Any) -> str:
    """
    Create an ETag hash from data for cache validation.
    
    Args:
        data: Data to hash (will be JSON serialized)
        
    Returns:
        ETag string
    """
    # Convert data to JSON string and hash it
    json_str = json.dumps(data, sort_keys=True, default=str)
    return hashlib.md5(json_str.encode('utf-8')).hexdigest()


def api_response_with_cache(data: Any, max_age: int = 0) -> Response:
    """
    Create a JSON API response with appropriate cache headers.
    
    Args:
        data: Data to return in response
        max_age: Cache duration in seconds (0 = no cache)
        
    Returns:
        JSON response with cache headers
    """
    response = jsonify(data)
    
    if max_age > 0:
        # Short-term cache with ETag for validation
        etag = create_etag(data)
        response.headers['ETag'] = f'"{etag}"'
        response.headers['Cache-Control'] = f'public, max-age={max_age}, must-revalidate'
    else:
        # No cache for dynamic data
        set_no_cache_headers(response)
    
    return response


def api_response_no_cache(data: Any) -> Response:
    """
    Create a JSON API response with no-cache headers.
    
    Args:
        data: Data to return in response
        
    Returns:
        JSON response with no-cache headers
    """
    return api_response_with_cache(data, max_age=0)