"""
Player model for Poker Night PWA.

This module defines the Player model and related data structures.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class Player:
    """
    Represents a poker player.
    
    Attributes:
        player_id: Unique identifier for the player
        name: Player's name
        seven_two_wins: Count of wins with 7-2 hands
    """
    
    player_id: str
    name: str
    seven_two_wins: int = 0
    
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
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Player instance to dictionary.
        
        Returns:
            Dictionary representation of player
        """
        return {
            'player_id': self.player_id,
            'name': self.name,
            'seven_two_wins': self.seven_two_wins
        }


@dataclass
class PlayerStats:
    """
    Represents a player's overall statistics.
    
    Attributes:
        player_id: Unique identifier for the player
        name: Player's name
        games_played: Total number of games played
        total_buy_ins_value: Total amount spent on buy-ins
        total_payout: Total amount received as payouts
        net_profit: Net profit/loss across all games
        wins: Number of profitable games
        losses: Number of losing games
        breakeven: Number of breakeven games
        average_profit_per_game: Average profit per game
        win_percentage: Percentage of games won
        seven_two_wins: Count of wins with 7-2 hands
    """
    
    player_id: str
    name: str
    games_played: int = 0
    total_buy_ins_value: float = 0.0
    total_payout: float = 0.0
    net_profit: float = 0.0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    average_profit_per_game: float = 0.0
    win_percentage: float = 0.0
    seven_two_wins: int = 0
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PlayerStats':
        """
        Create PlayerStats instance from dictionary data.
        
        Args:
            data: Dictionary containing player stats data
            
        Returns:
            PlayerStats instance
        """
        return cls(
            player_id=data['player_id'],
            name=data['name'],
            games_played=data.get('games_played', 0),
            total_buy_ins_value=data.get('total_buy_ins_value', 0.0),
            total_payout=data.get('total_payout', 0.0),
            net_profit=data.get('net_profit', 0.0),
            wins=data.get('wins', 0),
            losses=data.get('losses', 0),
            breakeven=data.get('breakeven', 0),
            average_profit_per_game=data.get('average_profit_per_game', 0.0),
            win_percentage=data.get('win_percentage', 0.0),
            seven_two_wins=data.get('seven_two_wins', 0)
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert PlayerStats instance to dictionary.
        
        Returns:
            Dictionary representation of player stats
        """
        return {
            'player_id': self.player_id,
            'name': self.name,
            'games_played': self.games_played,
            'total_buy_ins_value': self.total_buy_ins_value,
            'total_payout': self.total_payout,
            'net_profit': self.net_profit,
            'wins': self.wins,
            'losses': self.losses,
            'breakeven': self.breakeven,
            'average_profit_per_game': self.average_profit_per_game,
            'win_percentage': self.win_percentage,
            'seven_two_wins': self.seven_two_wins
        }