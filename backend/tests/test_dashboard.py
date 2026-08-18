"""Tests for the dashboard aggregate /api/dashboard route."""

import unittest

from app import create_app
from app.database.models import db, Player, Session, Entry

from tests.test_config import TestConfig


class TestDashboardAPI(unittest.TestCase):
    """Tests for the /api/dashboard route."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def setUp(self):
        # Clean the shared temp database before every test for isolation.
        # Entries must be deleted before sessions and players (FK relationships).
        with self.app.app_context():
            db.session.query(Entry).delete()
            db.session.query(Session).delete()
            db.session.query(Player).delete()
            db.session.commit()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _create_session(self, date="2024-01-15", **extra):
        """Helper: POST a session via the API and return the response."""
        payload = {'date': date}
        payload.update(extra)
        return self.client.post('/api/sessions', json=payload)

    def _create_player(self, name="Alice"):
        """Helper: POST a player via the API and return the response."""
        return self.client.post('/api/players', json={'name': name})

    def _add_entry(self, session_id, player_id, entry_id,
                   buy_in=20.0, payout=0.0):
        """Helper: create an entry directly in the database."""
        with self.app.app_context():
            entry = Entry(
                entry_id=entry_id,
                session_id=session_id,
                player_id=player_id,
                buy_in_count=1,
                total_buy_in_amount=buy_in,
                payout=payout,
                profit=payout - buy_in,
            )
            db.session.add(entry)
            db.session.commit()

    # ------------------------------------------------------------------
    # Empty database
    # ------------------------------------------------------------------

    def test_get_dashboard_empty(self):
        """GET /api/dashboard returns zeros when the database is empty."""
        resp = self.client.get('/api/dashboard')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['total_players'], 0)
        self.assertEqual(data['total_sessions'], 0)
        self.assertEqual(data['active_sessions'], 0)
        self.assertEqual(data['total_entries'], 0)
        self.assertEqual(data['total_buy_ins'], 0.0)
        self.assertEqual(data['total_payouts'], 0.0)
        self.assertEqual(data['recent_sessions'], [])

    def test_get_dashboard_empty_keys_present(self):
        """GET /api/dashboard always returns every expected key."""
        resp = self.client.get('/api/dashboard')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        expected_keys = {
            'total_players', 'total_sessions', 'active_sessions',
            'total_entries', 'total_buy_ins', 'total_payouts',
            'recent_sessions',
        }
        self.assertEqual(set(data.keys()), expected_keys)

    # ------------------------------------------------------------------
    # Populated database
    # ------------------------------------------------------------------

    def test_get_dashboard_with_players_sessions_and_entries(self):
        """GET /api/dashboard reflects players, sessions, and entry totals."""
        # Create two players
        resp_p1 = self._create_player('Alice')
        resp_p2 = self._create_player('Bob')
        player1_id = resp_p1.get_json()['player_id']
        player2_id = resp_p2.get_json()['player_id']

        # Create one session
        resp_s = self._create_session()
        session_id = resp_s.get_json()['session_id']

        # Add two entries with buy-ins and payouts
        self._add_entry(session_id, player1_id, 'eid_0001',
                        buy_in=20.0, payout=15.0)
        self._add_entry(session_id, player2_id, 'eid_0002',
                        buy_in=20.0, payout=25.0)

        resp = self.client.get('/api/dashboard')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()

        self.assertEqual(data['total_players'], 2)
        self.assertEqual(data['total_sessions'], 1)
        self.assertEqual(data['active_sessions'], 1)
        self.assertEqual(data['total_entries'], 2)
        self.assertAlmostEqual(data['total_buy_ins'], 40.0)
        self.assertAlmostEqual(data['total_payouts'], 40.0)

        # recent_sessions contains the session dict
        self.assertEqual(len(data['recent_sessions']), 1)
        self.assertEqual(data['recent_sessions'][0]['session_id'], session_id)

    def test_get_dashboard_with_players_no_entries(self):
        """GET /api/dashboard shows sessions but zero entries when none exist."""
        self._create_player('Alice')
        self._create_session()

        resp = self.client.get('/api/dashboard')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['total_players'], 1)
        self.assertEqual(data['total_sessions'], 1)
        self.assertEqual(data['active_sessions'], 1)
        self.assertEqual(data['total_entries'], 0)
        self.assertEqual(data['total_buy_ins'], 0.0)
        self.assertEqual(data['total_payouts'], 0.0)
        self.assertEqual(len(data['recent_sessions']), 1)

    def test_get_dashboard_recent_sessions_limited_to_five(self):
        """GET /api/dashboard returns at most 5 recent sessions."""
        for i in range(1, 7):
            self._create_session(date=f"2024-01-{i:02d}")
        resp = self.client.get('/api/dashboard')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['total_sessions'], 6)
        self.assertEqual(len(data['recent_sessions']), 5)

    def test_get_dashboard_active_sessions_count(self):
        """GET /api/dashboard counts only active sessions."""
        resp_s1 = self._create_session(date="2024-01-15")
        resp_s2 = self._create_session(date="2024-01-16")
        session_id_2 = resp_s2.get_json()['session_id']

        # Mark one session as inactive
        with self.app.app_context():
            session = Session.query.filter_by(session_id=session_id_2).first()
            session.is_active = False
            db.session.commit()

        resp = self.client.get('/api/dashboard')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['total_sessions'], 2)
        self.assertEqual(data['active_sessions'], 1)


if __name__ == '__main__':
    unittest.main()
