"""
Chip calculator routes for Poker Night PWA.

This module contains chip calculation API endpoints.
"""

import logging
from typing import Dict, Any
from flask import Blueprint, jsonify

# Import chip calculator from scripts directory
try:
    from chip_calculator import calculate_chip_distribution
except ImportError:
    logger = logging.getLogger(__name__)
    logger.warning("Could not import chip_calculator. Chip distribution functionality may not work.")
    
    def calculate_chip_distribution(buy_in: float) -> Dict[str, int]:
        """Fallback function if chip_calculator is not available."""
        return {}

logger = logging.getLogger(__name__)
chip_calculator_bp = Blueprint('chip_calculator', __name__)


@chip_calculator_bp.route('/chip-calculator/<float:buy_in>', methods=['GET'])
def get_chip_distribution_api(buy_in: float) -> Dict[str, Any]:
    """
    Calculate chip distribution for a specific buy-in amount.
    
    Args:
        buy_in: Buy-in amount to calculate chip distribution for
        
    Returns:
        JSON response with chip distribution data or error message
    """
    try:
        # Validate buy-in amount
        if buy_in <= 0:
            return jsonify({"error": "Buy-in amount must be positive"}), 400
        
        # Calculate chip distribution
        chip_distribution = calculate_chip_distribution(buy_in)
        
        if not chip_distribution:
            return jsonify({"error": "Failed to calculate chip distribution"}), 500
        
        # Calculate total chip count
        total_chips = sum(chip_distribution.values())
        
        # Return the distribution data
        return jsonify({
            "buy_in": buy_in,
            "chip_distribution": chip_distribution,
            "total_chips": total_chips
        })
    
    except Exception as e:
        logger.error(f"Error calculating chip distribution: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500