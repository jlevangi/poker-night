"""
SQLAlchemy database models for Poker Night PWA.

This module defines the database schema using SQLAlchemy ORM.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

db = SQLAlchemy()


class Player(db.Model):
    """
    Player model representing a poker player.
    
    Attributes:
        id: Primary key
        player_id: Unique string identifier (original format: pid_001)
        name: Player's name
        seven_two_wins: Count of wins with 7-2 hands
        created_at: Timestamp when player was created
        updated_at: Timestamp when player was last updated
    """
    
    __tablename__ = 'players'
    
    id = Column(Integer, primary_key=True)
    player_id = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    seven_two_wins = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    entries = relationship("Entry", back_populates="player", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f'<Player {self.player_id}: {self.name}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Player instance to dictionary.
        
        Returns:
            Dictionary representation of player
        """
        return {
            'player_id': self.player_id,
            'name': self.name,
            'seven_two_wins': self.seven_two_wins,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Player':
        """
        Create Player instance from dictionary data.
        
        Args:
            data: Dictionary containing player data
            
        Returns:
            Player instance
        """
        return cls(
            player_id=data['player_id'],
            name=data['name'],
            seven_two_wins=data.get('seven_two_wins', 0)
        )


class Session(db.Model):
    """
    Session model representing a poker session.
    
    Attributes:
        id: Primary key
        session_id: Unique string identifier (original format: sid_20231201_1)
        date: Session date in YYYY-MM-DD format
        default_buy_in_value: Default buy-in amount for the session
        is_active: Whether the session is currently active
        status: Session status (ACTIVE or ENDED)
        chip_distribution: JSON string of chip distribution configuration
        total_chips: Total chip count
        created_at: Timestamp when session was created
        updated_at: Timestamp when session was last updated
    """
    
    __tablename__ = 'sessions'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(String(30), unique=True, nullable=False, index=True)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD format
    default_buy_in_value = Column(Float, default=20.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String(10), default='ACTIVE', nullable=False)
    chip_distribution = Column(Text)  # JSON string
    total_chips = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    entries = relationship("Entry", back_populates="session", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f'<Session {self.session_id}: {self.date}>'
    
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
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Parse chip distribution if it exists
        if self.chip_distribution:
            import json
            try:
                result['chip_distribution'] = json.loads(self.chip_distribution)
            except json.JSONDecodeError:
                result['chip_distribution'] = {}
        
        if self.total_chips is not None:
            result['total_chips'] = self.total_chips
            
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Session':
        """
        Create Session instance from dictionary data.
        
        Args:
            data: Dictionary containing session data
            
        Returns:
            Session instance
        """
        import json
        
        session = cls(
            session_id=data['session_id'],
            date=data['date'],
            default_buy_in_value=data.get('default_buy_in_value', 20.00),
            is_active=data.get('is_active', True),
            status=data.get('status', 'ACTIVE'),
            total_chips=data.get('total_chips')
        )
        
        # Handle chip distribution
        chip_dist = data.get('chip_distribution')
        if chip_dist:
            if isinstance(chip_dist, dict):
                session.chip_distribution = json.dumps(chip_dist)
            elif isinstance(chip_dist, str):
                session.chip_distribution = chip_dist
        
        return session


class Entry(db.Model):
    """
    Entry model representing a player's entry in a poker session.
    
    Attributes:
        id: Primary key
        entry_id: Unique string identifier (original format: eid_0001)
        session_id: Foreign key to session
        player_id: Foreign key to player
        buy_in_count: Number of buy-ins purchased
        total_buy_in_amount: Total amount spent on buy-ins
        payout: Amount received as payout
        profit: Calculated profit/loss (payout - total_buy_in_amount)
        session_seven_two_wins: Count of 7-2 wins specific to this session
        created_at: Timestamp when entry was created
        updated_at: Timestamp when entry was last updated
    """
    
    __tablename__ = 'entries'
    
    id = Column(Integer, primary_key=True)
    entry_id = Column(String(20), unique=True, nullable=False, index=True)
    session_id = Column(String(30), ForeignKey('sessions.session_id'), nullable=False, index=True)
    player_id = Column(String(20), ForeignKey('players.player_id'), nullable=False, index=True)
    buy_in_count = Column(Integer, default=1, nullable=False)
    total_buy_in_amount = Column(Float, default=0.0, nullable=False)
    payout = Column(Float, default=0.0, nullable=False)
    profit = Column(Float, default=0.0, nullable=False)
    session_seven_two_wins = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    player = relationship("Player", back_populates="entries")
    session = relationship("Session", back_populates="entries")
    
    def __repr__(self) -> str:
        return f'<Entry {self.entry_id}: {self.player_id} in {self.session_id}>'
    
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
            'player_name': self.player.name if self.player else 'Unknown Player',
            'buy_in_count': self.buy_in_count,
            'total_buy_in_amount': self.total_buy_in_amount,
            'payout': self.payout,
            'profit': self.profit,
            'session_seven_two_wins': self.session_seven_two_wins,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
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
            buy_in_count=data.get('buy_in_count', 1),
            total_buy_in_amount=data.get('total_buy_in_amount', 0.0),
            payout=data.get('payout', 0.0),
            profit=data.get('profit', 0.0),
            session_seven_two_wins=data.get('session_seven_two_wins', 0)
        )
    
    def calculate_profit(self) -> float:
        """
        Calculate and update profit based on payout and total buy-in amount.
        
        Returns:
            Calculated profit value
        """
        self.profit = self.payout - self.total_buy_in_amount
        return self.profit