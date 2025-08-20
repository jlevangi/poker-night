"""
Notification routes for Poker Night PWA.

This module contains all push notification-related API endpoints.
"""

import json
import logging
from typing import Dict, Any
from flask import Blueprint, jsonify, request

from ..services.database_service import DatabaseService
from ..database.models import db, PushSubscription

logger = logging.getLogger(__name__)

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('/subscribe', methods=['POST'])
def subscribe_to_notifications() -> Dict[str, Any]:
    """
    Subscribe a player to push notifications for a specific session.
    
    Expected JSON payload:
    {
        "player_id": "pid_001",
        "session_id": "sid_20250820_001",
        "subscription": {
            "endpoint": "https://fcm.googleapis.com/fcm/send/...",
            "keys": {
                "auth": "auth_key_here",
                "p256dh": "public_key_here"
            }
        }
    }
    
    Returns:
        JSON response with success message or error
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    player_id = data.get('player_id')
    session_id = data.get('session_id')
    subscription_data = data.get('subscription')
    
    # Validate required fields
    if not player_id or not isinstance(player_id, str):
        return jsonify({"error": "Player ID is required and must be a string"}), 400
    
    if not session_id or not isinstance(session_id, str):
        return jsonify({"error": "Session ID is required and must be a string"}), 400
    
    if not subscription_data or not isinstance(subscription_data, dict):
        return jsonify({"error": "Subscription data is required and must be an object"}), 400
    
    # Validate subscription structure
    endpoint = subscription_data.get('endpoint')
    keys = subscription_data.get('keys', {})
    auth = keys.get('auth')
    p256dh = keys.get('p256dh')
    
    if not endpoint:
        return jsonify({"error": "Subscription endpoint is required"}), 400
    
    if not auth or not p256dh:
        return jsonify({"error": "Subscription auth and p256dh keys are required"}), 400
    
    try:
        db_service = DatabaseService()
        
        # Verify player and session exist
        player = db_service.get_player_by_id(player_id)
        if not player:
            return jsonify({"error": "Player not found"}), 404
        
        session = db_service.get_session_by_id(session_id)
        if not session:
            return jsonify({"error": "Session not found"}), 404
        
        # Check if subscription already exists
        existing_subscription = PushSubscription.query.filter_by(
            player_id=player_id,
            session_id=session_id,
            is_active=True
        ).first()
        
        if existing_subscription:
            # Update existing subscription
            existing_subscription.endpoint = endpoint
            existing_subscription.auth = auth
            existing_subscription.p256dh = p256dh
            db.session.commit()
            logger.info(f"Updated push subscription for player {player_id} in session {session_id}")
        else:
            # Create new subscription
            new_subscription = PushSubscription(
                player_id=player_id,
                session_id=session_id,
                endpoint=endpoint,
                auth=auth,
                p256dh=p256dh,
                is_active=True
            )
            db.session.add(new_subscription)
            db.session.commit()
            logger.info(f"Created new push subscription for player {player_id} in session {session_id}")
        
        return jsonify({"message": "Successfully subscribed to notifications"}), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating push subscription: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@notifications_bp.route('/unsubscribe', methods=['POST'])
def unsubscribe_from_notifications() -> Dict[str, Any]:
    """
    Unsubscribe a player from push notifications for a specific session.
    
    Expected JSON payload:
    {
        "player_id": "pid_001",
        "session_id": "sid_20250820_001"
    }
    
    Returns:
        JSON response with success message or error
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    player_id = data.get('player_id')
    session_id = data.get('session_id')
    
    # Validate required fields
    if not player_id or not isinstance(player_id, str):
        return jsonify({"error": "Player ID is required and must be a string"}), 400
    
    if not session_id or not isinstance(session_id, str):
        return jsonify({"error": "Session ID is required and must be a string"}), 400
    
    try:
        # Find and deactivate subscription
        subscription = PushSubscription.query.filter_by(
            player_id=player_id,
            session_id=session_id,
            is_active=True
        ).first()
        
        if subscription:
            subscription.is_active = False
            db.session.commit()
            logger.info(f"Deactivated push subscription for player {player_id} in session {session_id}")
            return jsonify({"message": "Successfully unsubscribed from notifications"})
        else:
            return jsonify({"error": "No active subscription found"}), 404
            
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error unsubscribing from notifications: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@notifications_bp.route('/subscriptions/<string:player_id>', methods=['GET'])
def get_player_subscriptions(player_id: str) -> Dict[str, Any]:
    """
    Get all active subscriptions for a player.
    
    Args:
        player_id: Player's unique identifier
        
    Returns:
        JSON response with list of active subscriptions
    """
    if not player_id or not isinstance(player_id, str):
        return jsonify({"error": "Invalid player ID"}), 400
    
    try:
        subscriptions = PushSubscription.query.filter_by(
            player_id=player_id,
            is_active=True
        ).all()
        
        return jsonify([sub.to_dict() for sub in subscriptions])
        
    except Exception as e:
        logger.error(f"Error fetching subscriptions for player {player_id}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500