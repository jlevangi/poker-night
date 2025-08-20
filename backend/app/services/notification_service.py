"""
Notification service for sending push notifications.

This module handles sending push notifications to subscribed users.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pywebpush import webpush, WebPushException

from ..database.models import db, PushSubscription, Session, Entry, Player

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service class for handling push notification operations.
    """
    
    def __init__(self):
        """Initialize NotificationService."""
        import os
        from dotenv import load_dotenv
        
        self.logger = logging.getLogger(__name__)
        
        # Load environment variables from .env file in project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
        env_path = os.path.join(project_root, '.env')
        load_dotenv(env_path)
        
        # VAPID keys from environment variables (DER format, base64 encoded)
        vapid_private_b64 = os.getenv('VAPID_PRIVATE_KEY')
        vapid_public_b64 = os.getenv('VAPID_PUBLIC_KEY')
        
        if not vapid_private_b64 or not vapid_public_b64:
            raise ValueError("VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY environment variables must be set")
        
        # Create Vapid instance using py-vapid library directly
        # This avoids key format issues with pywebpush
        import base64
        from py_vapid import Vapid
        import tempfile
        import os
        
        # Decode the stored PEM
        private_pem = base64.b64decode(vapid_private_b64).decode('utf-8')
        
        # Create a temporary file to load the key
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
            f.write(private_pem)
            temp_key_file = f.name
        
        # Use a singleton pattern to ensure same keys for entire app session
        if not hasattr(NotificationService, '_shared_vapid_instance'):
            self.logger.info("Generating VAPID keys for this application session...")
            
            NotificationService._shared_vapid_instance = Vapid()
            NotificationService._shared_vapid_instance.generate_keys()
            
            # Log the keys once for reference
            try:
                new_private_pem = NotificationService._shared_vapid_instance.private_pem().decode()
                new_public_pem = NotificationService._shared_vapid_instance.public_pem().decode()
                new_private_b64 = base64.b64encode(new_private_pem.encode()).decode()
                new_public_b64 = base64.b64encode(new_public_pem.encode()).decode()
                
                self.logger.info("Generated application VAPID keys:")
                self.logger.info(f"VAPID_PRIVATE_KEY={new_private_b64}")
                self.logger.info(f"VAPID_PUBLIC_KEY={new_public_b64}")
                
                # Get browser key for frontend
                from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
                public_key_bytes = NotificationService._shared_vapid_instance.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
                browser_key = base64.urlsafe_b64encode(public_key_bytes).decode().rstrip('=')
                self.logger.info(f"Frontend applicationServerKey: {browser_key}")
                self.logger.info("Update notification-manager.js with the above applicationServerKey")
                
            except Exception as log_error:
                self.logger.error(f"Failed to log new keys: {log_error}")
        else:
            self.logger.info("Using existing VAPID keys for this session")
        
        # Use the shared instance
        self.vapid_private_key = NotificationService._shared_vapid_instance
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_key_file):
                os.unlink(temp_key_file)
        
        # Contact information for VAPID
        vapid_email = os.getenv('VAPID_EMAIL', 'admin@yourpokerapp.com')
        self.vapid_claims = {
            "sub": f"mailto:{vapid_email}"
        }

    def calculate_session_summary(self, session_id: str) -> Dict[str, Any]:
        """
        Calculate session summary including winner and runners-up.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            Dictionary with session summary data
        """
        try:
            # Get session and entries
            session = Session.query.filter_by(session_id=session_id).first()
            if not session:
                return {"error": "Session not found"}
            
            entries = Entry.query.filter_by(session_id=session_id).all()
            if not entries:
                return {
                    "session_id": session_id,
                    "session_date": session.date,
                    "winner": None,
                    "runners_up": [],
                    "total_players": 0,
                    "total_buy_ins": 0,
                    "total_payouts": 0
                }
            
            # Calculate profits for all players
            player_results = []
            for entry in entries:
                profit = entry.payout - entry.total_buy_in_amount
                player_results.append({
                    "player_id": entry.player_id,
                    "player_name": entry.player.name if entry.player else "Unknown",
                    "profit": profit,
                    "buy_ins": entry.buy_in_count,
                    "total_buy_in_amount": entry.total_buy_in_amount,
                    "payout": entry.payout,
                    "seven_two_wins": entry.session_seven_two_wins or 0
                })
            
            # Sort by profit (highest first)
            player_results.sort(key=lambda x: x["profit"], reverse=True)
            
            # Get winner (highest profit) and runners-up
            winner = player_results[0] if player_results else None
            runners_up = player_results[1:3]  # Next 2 players
            
            # Calculate totals
            total_buy_ins = sum(entry.total_buy_in_amount for entry in entries)
            total_payouts = sum(entry.payout for entry in entries)
            
            return {
                "session_id": session_id,
                "session_date": session.date,
                "winner": winner,
                "runners_up": runners_up,
                "total_players": len(entries),
                "total_buy_ins": total_buy_ins,
                "total_payouts": total_payouts,
                "all_results": player_results
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating session summary for {session_id}: {str(e)}")
            return {"error": f"Failed to calculate session summary: {str(e)}"}

    def create_notification_content(self, session_summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create notification content based on session summary.
        
        Args:
            session_summary: Session summary data
            
        Returns:
            Dictionary with notification content
        """
        if session_summary.get("error"):
            return {
                "title": "Poker Session Ended",
                "body": "A poker session has ended. Check the app for details.",
                "icon": "/static/images/icon-192x192.png",
                "tag": "poker-session",
                "data": {
                    "sessionId": session_summary.get("session_id")
                }
            }
        
        winner = session_summary.get("winner")
        runners_up = session_summary.get("runners_up", [])
        total_players = session_summary.get("total_players", 0)
        
        # Create notification body
        if winner:
            body = f"🏆 {winner['player_name']} won with ${winner['profit']:.2f} profit!"
            if runners_up:
                runner_names = [r['player_name'] for r in runners_up]
                if len(runner_names) == 1:
                    body += f" Runner-up: {runner_names[0]}"
                else:
                    body += f" Runners-up: {', '.join(runner_names)}"
        else:
            body = f"Session ended with {total_players} players."
        
        return {
            "title": "🃏 Poker Session Results",
            "body": body,
            "icon": "/static/images/icon-192x192.png",
            "tag": f"poker-session-{session_summary['session_id']}",
            "data": {
                "sessionId": session_summary["session_id"],
                "summary": session_summary
            },
            "actions": [
                {
                    "action": "view_results",
                    "title": "View Results"
                },
                {
                    "action": "dismiss",
                    "title": "Dismiss"
                }
            ]
        }

    def send_notification_to_subscription(
        self, 
        subscription: PushSubscription, 
        notification_data: Dict[str, Any]
    ) -> bool:
        """
        Send a push notification to a single subscription.
        
        Args:
            subscription: Push subscription object
            notification_data: Notification content
            
        Returns:
            True if successful, False otherwise
        """
        try:
            subscription_info = {
                "endpoint": subscription.endpoint,
                "keys": {
                    "auth": subscription.auth,
                    "p256dh": subscription.p256dh
                }
            }
            
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(notification_data),
                vapid_private_key=self.vapid_private_key,
                vapid_claims=self.vapid_claims
            )
            
            self.logger.info(f"Successfully sent notification to subscription {subscription.id}")
            return True
            
        except WebPushException as e:
            self.logger.error(f"WebPush error sending to subscription {subscription.id}: {str(e)}")
            if e.response and e.response.status_code == 410:
                # Subscription is no longer valid, deactivate it
                subscription.is_active = False
                db.session.commit()
                self.logger.info(f"Deactivated invalid subscription {subscription.id}")
            return False
            
        except Exception as e:
            self.logger.error(f"Error sending notification to subscription {subscription.id}: {str(e)}")
            return False

    def send_session_end_notifications(self, session_id: str) -> Dict[str, Any]:
        """
        Send notifications to all subscribers when a session ends.
        
        Args:
            session_id: Session's unique identifier
            
        Returns:
            Dictionary with notification sending results
        """
        try:
            # Calculate session summary
            session_summary = self.calculate_session_summary(session_id)
            if session_summary.get("error"):
                return {
                    "success": False,
                    "error": session_summary["error"],
                    "sent": 0,
                    "failed": 0
                }
            
            # Create notification content
            notification_data = self.create_notification_content(session_summary)
            
            # Get all active subscriptions for this session
            subscriptions = PushSubscription.query.filter_by(
                session_id=session_id,
                is_active=True
            ).all()
            
            if not subscriptions:
                self.logger.info(f"No active subscriptions found for session {session_id}")
                return {
                    "success": True,
                    "message": "No subscribers to notify",
                    "sent": 0,
                    "failed": 0
                }
            
            # Send notifications
            sent_count = 0
            failed_count = 0
            
            for subscription in subscriptions:
                if self.send_notification_to_subscription(subscription, notification_data):
                    sent_count += 1
                else:
                    failed_count += 1
            
            self.logger.info(
                f"Sent session end notifications for {session_id}: "
                f"{sent_count} sent, {failed_count} failed"
            )
            
            return {
                "success": True,
                "message": f"Notifications sent to {sent_count} subscribers",
                "sent": sent_count,
                "failed": failed_count,
                "session_summary": session_summary
            }
            
        except Exception as e:
            self.logger.error(f"Error sending session end notifications for {session_id}: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to send notifications: {str(e)}",
                "sent": 0,
                "failed": 0
            }

    def test_notification(self, subscription_id: int, message: str = "Test notification") -> bool:
        """
        Send a test notification to a specific subscription.
        
        Args:
            subscription_id: Subscription ID to test
            message: Test message content
            
        Returns:
            True if successful, False otherwise
        """
        try:
            subscription = PushSubscription.query.get(subscription_id)
            if not subscription or not subscription.is_active:
                self.logger.error(f"Subscription {subscription_id} not found or inactive")
                return False
            
            test_notification = {
                "title": "Test Notification",
                "body": message,
                "icon": "/static/images/icon-192x192.png",
                "tag": "test-notification"
            }
            
            return self.send_notification_to_subscription(subscription, test_notification)
            
        except Exception as e:
            self.logger.error(f"Error sending test notification to {subscription_id}: {str(e)}")
            return False