"""
SQLAlchemy database models for Poker Night PWA.

This module defines the database schema using SQLAlchemy ORM.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

db = SQLAlchemy()


def round_to_cents(value: Optional[float]) -> Optional[float]:
    """
    Round a monetary value to the nearest cent (2 decimal places).
    
    Args:
        value: The value to round
        
    Returns:
        Rounded value or None if input is None
    """
    if value is None:
        return None
    
    # Convert to Decimal for precise arithmetic
    decimal_value = Decimal(str(value))
    # Round to 2 decimal places (cents)
    rounded = decimal_value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    # Convert back to float
    return float(rounded)


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
    wisdom_quote = Column(Text)  # Words of Wisdom quote
    wisdom_player_id = Column(String(20), ForeignKey('players.player_id'))  # Player who said the quote
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
            'default_buy_in_value': round_to_cents(self.default_buy_in_value),
            'is_active': self.is_active,
            'status': self.status,
            'wisdom_quote': self.wisdom_quote,
            'wisdom_player_id': self.wisdom_player_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Calculate total value from entries
        if self.entries:
            total_value = sum(entry.total_buy_in_amount or 0 for entry in self.entries)
            result['total_value'] = round_to_cents(total_value)
        else:
            result['total_value'] = 0.0
        
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
            default_buy_in_value=round_to_cents(data.get('default_buy_in_value', 20.00)),
            is_active=data.get('is_active', True),
            status=data.get('status', 'ACTIVE'),
            total_chips=data.get('total_chips'),
            wisdom_quote=data.get('wisdom_quote'),
            wisdom_player_id=data.get('wisdom_player_id')
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
        session_strikes: Count of strikes specific to this session
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
    is_cashed_out = Column(Boolean, default=False, nullable=False)
    session_seven_two_wins = Column(Integer, default=0, nullable=False)
    session_strikes = Column(Integer, default=0, nullable=False)
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
            'total_buy_in_amount': round_to_cents(self.total_buy_in_amount),
            'payout': round_to_cents(self.payout),
            'profit': round_to_cents(self.profit),
            'is_cashed_out': self.is_cashed_out,
            'session_seven_two_wins': self.session_seven_two_wins,
            'session_strikes': self.session_strikes,
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
            total_buy_in_amount=round_to_cents(data.get('total_buy_in_amount', 0.0)),
            payout=round_to_cents(data.get('payout', 0.0)),
            profit=round_to_cents(data.get('profit', 0.0)),
            is_cashed_out=data.get('is_cashed_out', False),
            session_seven_two_wins=data.get('session_seven_two_wins', 0),
            session_strikes=data.get('session_strikes', 0)
        )
    
    def calculate_profit(self) -> float:
        """
        Calculate and update profit based on payout and total buy-in amount.
        
        Returns:
            Calculated profit value rounded to nearest cent
        """
        calculated_profit = self.payout - self.total_buy_in_amount
        self.profit = round_to_cents(calculated_profit)
        return self.profit
    
    def set_total_buy_in_amount(self, amount: float) -> None:
        """
        Set the total buy-in amount with proper rounding.
        
        Args:
            amount: The amount to set
        """
        self.total_buy_in_amount = round_to_cents(amount)
    
    def set_payout(self, amount: float) -> None:
        """
        Set the payout amount with proper rounding.
        
        Args:
            amount: The amount to set
        """
        self.payout = round_to_cents(amount)


class PushSubscription(db.Model):
    """
    Push subscription model for storing user notification subscriptions.
    
    Attributes:
        id: Primary key
        player_id: Foreign key to player
        session_id: Foreign key to session they're subscribed to
        endpoint: Push service endpoint URL
        auth: Authentication key
        p256dh: Public key for encryption
        created_at: Timestamp when subscription was created
        is_active: Whether subscription is currently active
    """
    
    __tablename__ = 'push_subscriptions'
    
    id = Column(Integer, primary_key=True)
    player_id = Column(String(20), ForeignKey('players.player_id'), nullable=False, index=True)
    session_id = Column(String(30), ForeignKey('sessions.session_id'), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    auth = Column(String(255), nullable=False)
    p256dh = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    player = relationship("Player")
    session = relationship("Session")
    
    def __repr__(self) -> str:
        return f'<PushSubscription {self.id}: {self.player_id} -> {self.session_id}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert PushSubscription instance to dictionary.
        
        Returns:
            Dictionary representation of subscription
        """
        return {
            'id': self.id,
            'player_id': self.player_id,
            'session_id': self.session_id,
            'endpoint': self.endpoint,
            'auth': self.auth,
            'p256dh': self.p256dh,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active
        }


class CalendarEvent(db.Model):
    """Model representing a scheduled poker night event."""

    __tablename__ = 'calendar_events'

    id = Column(Integer, primary_key=True)
    event_id = Column(String(30), unique=True, nullable=False, index=True)
    title = Column(String(200), default='Poker Night', nullable=False)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    time = Column(String(5), nullable=True)  # HH:MM
    location = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    default_buy_in_value = Column(Float, default=20.00, nullable=False)
    max_players = Column(Integer, nullable=True)
    session_id = Column(String(30), ForeignKey('sessions.session_id'), nullable=True)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    rsvps = relationship("EventRSVP", back_populates="event", cascade="all, delete-orphan")
    session = relationship("Session")

    def __repr__(self) -> str:
        return f'<CalendarEvent {self.event_id}: {self.date}>'

    def to_dict(self) -> Dict[str, Any]:
        rsvp_counts = {'yes': 0, 'no': 0, 'maybe': 0}
        rsvp_list = []
        if self.rsvps:
            for rsvp in self.rsvps:
                status_lower = rsvp.status.lower()
                if status_lower in rsvp_counts:
                    rsvp_counts[status_lower] += 1
                rsvp_list.append(rsvp.to_dict())

        return {
            'event_id': self.event_id,
            'title': self.title,
            'date': self.date,
            'time': self.time,
            'location': self.location,
            'description': self.description,
            'default_buy_in_value': round_to_cents(self.default_buy_in_value),
            'max_players': self.max_players,
            'session_id': self.session_id,
            'is_cancelled': self.is_cancelled,
            'rsvp_counts': rsvp_counts,
            'rsvps': rsvp_list,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class EventRSVP(db.Model):
    """Model representing a player's RSVP to a calendar event."""

    __tablename__ = 'event_rsvps'
    __table_args__ = (
        UniqueConstraint('event_id', 'player_id', name='uq_event_player_rsvp'),
    )

    id = Column(Integer, primary_key=True)
    event_id = Column(String(30), ForeignKey('calendar_events.event_id'), nullable=False, index=True)
    player_id = Column(String(20), ForeignKey('players.player_id'), nullable=False, index=True)
    status = Column(String(10), nullable=False)  # YES, NO, MAYBE
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    event = relationship("CalendarEvent", back_populates="rsvps")
    player = relationship("Player")

    def __repr__(self) -> str:
        return f'<EventRSVP {self.event_id}: {self.player_id} -> {self.status}>'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_id': self.event_id,
            'player_id': self.player_id,
            'player_name': self.player.name if self.player else 'Unknown',
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }