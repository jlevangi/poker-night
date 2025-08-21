"""
Entry model for Poker Night PWA.

This module defines the Entry model and related data structures.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class Entry:
    """
    Represents a player's entry in a poker session.
    
    Attributes:
        entry_id: Unique identifier for the entry
        session_id: ID of the session this entry belongs to
        player_id: ID of the player
        player_name: Name of the player (cached for display)
        buy_in_count: Number of buy-ins purchased
        total_buy_in_amount: Total amount spent on buy-ins
        payout: Amount received as payout
        profit: Calculated profit/loss (payout - total_buy_in_amount)
        session_seven_two_wins: Count of 7-2 wins specific to this session
    """
    
    entry_id: str
    session_id: str
    player_id: str
    player_name: str
    buy_in_count: int = 1
    total_buy_in_amount: float = 0.0
    payout: float = 0.0
    profit: float = 0.0
    session_seven_two_wins: int = 0
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Entry':
        """
        Create Entry instance from dictionary data.
        
        Args:
            data: Dictionary containing entry data
            
        Returns:
            Entry instance
        """
        return cls(
            entry_id=data['entry_id'],
            session_id=data['session_id'],
            player_id=data['player_id'],
            player_name=data['player_name'],
            buy_in_count=data.get('buy_in_count', 1),
            total_buy_in_amount=data.get('total_buy_in_amount', 0.0),
            payout=data.get('payout', 0.0),
            profit=data.get('profit', 0.0),
            session_seven_two_wins=data.get('session_seven_two_wins', 0)
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Entry instance to dictionary.
        
        Returns:
            Dictionary representation of entry
        """
        return {
            'entry_id': self.entry_id,
            'session_id': self.session_id,
            'player_id': self.player_id,
            'player_name': self.player_name,
            'buy_in_count': self.buy_in_count,
            'total_buy_in_amount': self.total_buy_in_amount,
            'payout': self.payout,
            'profit': self.profit,
            'session_seven_two_wins': self.session_seven_two_wins
        }
    
    def calculate_profit(self) -> float:
        """
        Calculate and update profit based on payout and total buy-in amount.
        
        Returns:
            Calculated profit value
        """
        self.profit = self.payout - self.total_buy_in_amount
        return self.profit


@dataclass
class PlayerSessionHistory:
    """
    Represents a player's historical entry with session context.
    
    Attributes:
        entry: The entry data
        session_date: Date of the session
        session_buy_in_value: Default buy-in value for the session
    """
    
    entry: Entry
    session_date: str
    session_buy_in_value: float
    
    @classmethod
    def from_entry_dict(cls, data: Dict[str, Any]) -> 'PlayerSessionHistory':
        """
        Create PlayerSessionHistory from entry dictionary with session context.
        
        Args:
            data: Dictionary containing entry data with session context
            
        Returns:
            PlayerSessionHistory instance
        """
        # Create entry from the base data
        entry_data = {k: v for k, v in data.items() if k not in ['session_date', 'session_buy_in_value']}
        entry = Entry.from_dict(entry_data)
        
        return cls(
            entry=entry,
            session_date=data.get('session_date', 'N/A'),
            session_buy_in_value=data.get('session_buy_in_value', 0.0)
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert PlayerSessionHistory to dictionary.
        
        Returns:
            Dictionary representation including entry and session context
        """
        result = self.entry.to_dict()
        result['session_date'] = self.session_date
        result['session_buy_in_value'] = self.session_buy_in_value
        return result