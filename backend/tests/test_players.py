"""Tests for player CRUD API routes."""

import unittest

from app import create_app
from app.database.models import db, Player, Entry

from tests.test_config import TestConfig


# Fields returned by PlayerStats.to_dict() (GET /api/players)
PLAYER_STATS_FIELDS = {
    'player_id', 'name', 'games_played', 'total_buy_ins_value',
    'total_payout', 'net_profit', 'wins', 'losses', 'breakeven',
    'average_profit_per_game', 'win_percentage', 'seven_two_wins',
}

# Fields returned by the SQLAlchemy Player.to_dict() (GET /api/players/details)
PLAYER_DETAIL_FIELDS = {
    'player_id', 'name', 'seven_two_wins', 'created_at', 'updated_at',
}


class TestPlayersAPI(unittest.TestCase):
    """Tests for the /api/players routes."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def setUp(self):
        # Clean the shared temp database before every test for isolation.
        with self.app.app_context():
            db.session.query(Entry).delete()
            db.session.query(Player).delete()
            db.session.commit()

    def _add_player(self, name):
        """Helper: POST a player via the API and return the response."""
        return self.client.post('/api/players', json={'name': name})

    # ------------------------------------------------------------------
    # GET /api/players  (summary statistics)
    # ------------------------------------------------------------------

    def test_get_players_empty(self):
        """GET /api/players returns an empty list when no players exist."""
        resp = self.client.get('/api/players')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_players_returns_summary_stats(self):
        """GET /api/players returns PlayerStats.to_dict() objects."""
        self._add_player('Alice')
        resp = self.client.get('/api/players')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        player = data[0]
        self.assertEqual(set(player.keys()), PLAYER_STATS_FIELDS)
        self.assertEqual(player['name'], 'Alice')
        self.assertEqual(player['player_id'], 'pid_001')
        self.assertEqual(player['games_played'], 0)
        self.assertEqual(player['net_profit'], 0)
        self.assertEqual(player['seven_two_wins'], 0)

    # ------------------------------------------------------------------
    # GET /api/players/details  (full player records)
    # ------------------------------------------------------------------

    def test_get_players_details_empty(self):
        """GET /api/players/details returns an empty list when no players exist."""
        resp = self.client.get('/api/players/details')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_players_details_returns_player_fields(self):
        """GET /api/players/details returns Player.to_dict() objects."""
        self._add_player('Alice')
        resp = self.client.get('/api/players/details')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        player = data[0]
        self.assertEqual(set(player.keys()), PLAYER_DETAIL_FIELDS)
        self.assertEqual(player['name'], 'Alice')
        self.assertEqual(player['player_id'], 'pid_001')
        self.assertEqual(player['seven_two_wins'], 0)

    # ------------------------------------------------------------------
    # POST /api/players
    # ------------------------------------------------------------------

    def test_add_player_success(self):
        """POST /api/players with a valid name returns 201 and player stats."""
        resp = self._add_player('Alice')
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertEqual(set(data.keys()), PLAYER_STATS_FIELDS)
        self.assertEqual(data['name'], 'Alice')
        self.assertEqual(data['player_id'], 'pid_001')
        self.assertTrue(data['player_id'].startswith('pid_'))
        self.assertEqual(data['games_played'], 0)

    def test_add_player_no_body(self):
        """POST /api/players with an empty JSON object returns 400."""
        resp = self.client.post('/api/players', json={})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Request body is required'},
        )

    def test_add_player_missing_name(self):
        """POST /api/players without a name key returns 400."""
        resp = self.client.post('/api/players', json={'other': 'value'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Name is required and must be a string'},
        )

    def test_add_player_invalid_name_not_string(self):
        """POST /api/players with a non-string name returns 400."""
        resp = self.client.post('/api/players', json={'name': 42})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Name is required and must be a string'},
        )

    def test_add_player_invalid_name_too_long(self):
        """POST /api/players with a name longer than 50 chars returns 400."""
        resp = self.client.post('/api/players', json={'name': 'a' * 51})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Name must be between 1 and 50 characters'},
        )

    def test_add_player_duplicate_name(self):
        """POST /api/players with an existing name returns 201 with the same player."""
        resp1 = self._add_player('Alice')
        resp2 = self._add_player('Alice')
        self.assertEqual(resp1.status_code, 201)
        self.assertEqual(resp2.status_code, 201)
        data1 = resp1.get_json()
        data2 = resp2.get_json()
        # Duplicate returns the *existing* player, same ID.
        self.assertEqual(data1['player_id'], data2['player_id'])
        self.assertEqual(data1['name'], data2['name'])

    def test_add_player_trims_whitespace(self):
        """POST /api/players stores the name trimmed of surrounding whitespace."""
        resp = self.client.post('/api/players', json={'name': '  Alice  '})
        self.assertEqual(resp.status_code, 201)
        resp = self.client.get('/api/players/details')
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Alice')


if __name__ == '__main__':
    unittest.main()
