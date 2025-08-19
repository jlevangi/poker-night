"""
Session model for Poker Night PWA.

This module defines the Session model and related data structures.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
from datetime import datetime


@dataclass
class Session:
    """
    Represents a poker session.
    
    Attributes:
        session_id: Unique identifier for the session
        date: Session date in YYYY-MM-DD format
        default_buy_in_value: Default buy-in amount for the session
        is_active: Whether the session is currently active
        status: Session status (ACTIVE or ENDED)
        chip_distribution: Optional chip distribution configuration
        total_chips: Optional total chip count
    """
    
    session_id: str
    date: str
    default_buy_in_value: float = 20.00
    is_active: bool = True
    status: str = "ACTIVE"
    chip_distribution: Optional[Dict[str, int]] = None
    total_chips: Optional[int] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Session':
        """
        Create Session instance from dictionary data.
        
        Args:
            data: Dictionary containing session data
            
        Returns:
            Session instance
        """
        return cls(
            session_id=data['session_id'],
            date=data['date'],
            default_buy_in_value=data.get('default_buy_in_value', 20.00),
            is_active=data.get('is_active', True),
            status=data.get('status', 'ACTIVE'),
            chip_distribution=data.get('chip_distribution'),
            total_chips=data.get('total_chips')
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Session instance to dictionary.
        
        Returns:
            Dictionary representation of session
        """
        result = {
            'session_id': self.session_id,
            'date': self.date,
            'default_buy_in_value': self.default_buy_in_value,
            'is_active': self.is_active,
            'status': self.status
        }
        
        if self.chip_distribution is not None:
            result['chip_distribution'] = self.chip_distribution
        
        if self.total_chips is not None:
            result['total_chips'] = self.total_chips
            
        return result
    
    def validate_date(self) -> bool:
        """
        Validate that the date string is in correct YYYY-MM-DD format.
        
        Returns:
            True if date is valid, False otherwise
        """
        try:
            datetime.strptime(self.date, "%Y-%m-%d")
            return True
        except ValueError:
            return False