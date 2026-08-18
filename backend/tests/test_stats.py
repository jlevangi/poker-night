"""Tests for the /api/stats/summary endpoint.

Covers the aggregate statistics summary route which iterates over every
session and its entries to compute totals, averages, and the house loss.
"""

import unittest

from app import create_app
from app.database.models import db, Player, Session, Entry

from tests.test_config import TestConfig


# All fields returned by GET /api/stats/summary.
SUMMARY_FIELDS = {
    'total_buy_ins',
    'total_payouts',
    'total_sessions',
    'total_players',
    'average_session_value',
    'house_loss',
}


class TestStatsSummary(unittest.TestCase):
    """Tests for GET /api/stats/summary."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def setUp(self):
        # Clean the shared temp database before every test for isolation.
        # Entries must be deleted before sessions (foreign-key relationship).
        with self.app.app_context():
            db.session.query(Entry).delete()
            db.session.query(Session).delete()
            db.session.query(Player).delete()
            db.session.commit()

    # -- Helpers --------------------------------------------------------------

    def _create_player(self, name):
        """Helper: POST a player via the API and return the response."""
        return self.client.post('/api/players', json={'name': name})

    def _create_session(self, date="2024-01-15", **extra):
        """Helper: POST a session via the API and return the response."""
        payload = {'date': date}
        payload.update(extra)
        return self.client.post('/api/sessions', json=payload)

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

    def _populate_two_entries(self):
        """Helper: two players + one session with two entries.

        Returns (session_id, player1_id, player2_id).
        """
        resp_p1 = self._create_player('Alice')
        resp_p2 = self._create_player('Bob')
        player1_id = resp_p1.get_json()['player_id']
        player2_id = resp_p2.get_json()['player_id']
        resp_s = self._create_session()
        session_id = resp_s.get_json()['session_id']
        self._add_entry(session_id, player1_id, 'eid_0001',
                        buy_in=20.0, payout=15.0)
        self._add_entry(session_id, player2_id, 'eid_0002',
                        buy_in=20.0, payout=25.0)
        return session_id, player1_id, player2_id

    # -- Empty database -------------------------------------------------------

    def test_summary_empty_returns_200(self):
        """GET /api/stats/summary returns HTTP 200 with no data."""
        resp = self.client.get('/api/stats/summary')
        self.assertEqual(resp.status_code, 200)

    def test_summary_empty_returns_json(self):
        """GET /api/stats/summary returns a JSON response."""
        resp = self.client.get('/api/stats/summary')
        self.assertIn('application/json', resp.content_type)

    def test_summary_empty_keys(self):
        """The response contains exactly the expected summary keys."""
        resp = self.client.get('/api/stats/summary')
        data = resp.get_json()
        self.assertEqual(set(data.keys()), SUMMARY_FIELDS)

    def test_summary_empty_all_zeros(self):
        """With no sessions or entries every value is zero."""
        resp = self.client.get('/api/stats/summary')
        data = resp.get_json()
        self.assertEqual(data['total_buy_ins'], 0)
        self.assertEqual(data['total_payouts'], 0)
        self.assertEqual(data['total_sessions'], 0)
        self.assertEqual(data['total_players'], 0)
        self.assertEqual(data['average_session_value'], 0)
        self.assertEqual(data['house_loss'], 0)

    # -- Populated database ---------------------------------------------------

    def test_summary_with_entries_returns_200(self):
        """GET /api/stats/summary returns 200 when entries exist."""
        self._populate_two_entries()
        resp = self.client.get('/api/stats/summary')
        self.assertEqual(resp.status_code, 200)

    def test_summary_total_buy_ins_and_payouts(self):
        """Buy-ins and payouts are summed across all entries."""
        self._populate_two_entries()
        data = self.client.get('/api/stats/summary').get_json()
        self.assertAlmostEqual(data['total_buy_ins'], 40.0)
        self.assertAlmostEqual(data['total_payouts'], 40.0)

    def test_summary_total_sessions(self):
        """total_sessions reflects the number of sessions in the DB."""
        self._populate_two_entries()
        data = self.client.get('/api/stats/summary').get_json()
        self.assertEqual(data['total_sessions'], 1)

    def test_summary_total_players_unique(self):
        """total_players counts unique player IDs across all entries."""
        self._populate_two_entries()
        data = self.client.get('/api/stats/summary').get_json()
        self.assertEqual(data['total_players'], 2)

    def test_summary_average_session_value(self):
        """average_session_value is total_buy_ins divided by session count."""
        self._populate_two_entries()
        data = self.client.get('/api/stats/summary').get_json()
        # total_buy_ins = 40.0, sessions = 1 -> 40.0
        self.assertAlmostEqual(data['average_session_value'], 40.0)

    def test_summary_house_loss_even(self):
        """When buy-ins equal payouts, house_loss is 0."""
        self._populate_two_entries()
        data = self.client.get('/api/stats/summary').get_json()
        self.assertAlmostEqual(data['house_loss'], 0.0)

    def test_summary_house_loss_house_wins(self):
        """When buy-ins exceed payouts, house_loss is negative (house wins)."""
        resp_p1 = self._create_player('Alice')
        session_id = self._create_session().get_json()['session_id']
        pid = resp_p1.get_json()['player_id']
        self._add_entry(session_id, pid, 'eid_0001', buy_in=20.0, payout=10.0)
        self._add_entry(session_id, pid, 'eid_0002', buy_in=20.0, payout=20.0)
        data = self.client.get('/api/stats/summary').get_json()
        # house_loss = payouts(30) - buy_ins(40) = -10
        self.assertAlmostEqual(data['house_loss'], -10.0)

    def test_summary_house_loss_no_buy_ins(self):
        """With zero total buy-ins, house_loss is 0 even when payouts exist."""
        resp_p1 = self._create_player('Alice')
        session_id = self._create_session().get_json()['session_id']
        pid = resp_p1.get_json()['player_id']
        self._add_entry(session_id, pid, 'eid_0001', buy_in=0.0, payout=10.0)
        data = self.client.get('/api/stats/summary').get_json()
        self.assertEqual(data['house_loss'], 0)

    def test_summary_multiple_sessions(self):
        """Totals span multiple sessions and averages use the session count."""
        resp_p1 = self._create_player('Alice')
        resp_p2 = self._create_player('Bob')
        p1 = resp_p1.get_json()['player_id']
        p2 = resp_p2.get_json()['player_id']
        s1 = self._create_session(date="2024-01-15").get_json()['session_id']
        s2 = self._create_session(date="2024-01-16").get_json()['session_id']
        self._add_entry(s1, p1, 'eid_0001', buy_in=20.0, payout=10.0)
        self._add_entry(s2, p2, 'eid_0002', buy_in=30.0, payout=15.0)
        data = self.client.get('/api/stats/summary').get_json()
        self.assertEqual(data['total_sessions'], 2)
        self.assertAlmostEqual(data['total_buy_ins'], 50.0)
        self.assertAlmostEqual(data['average_session_value'], 25.0)
        self.assertEqual(data['total_players'], 2)

    def test_summary_player_repeated_across_sessions(self):
        """A player appearing in multiple sessions is counted only once."""
        resp_p1 = self._create_player('Alice')
        pid = resp_p1.get_json()['player_id']
        s1 = self._create_session(date="2024-01-15").get_json()['session_id']
        s2 = self._create_session(date="2024-01-16").get_json()['session_id']
        self._add_entry(s1, pid, 'eid_0001', buy_in=20.0, payout=10.0)
        self._add_entry(s2, pid, 'eid_0002', buy_in=20.0, payout=10.0)
        data = self.client.get('/api/stats/summary').get_json()
        self.assertEqual(data['total_players'], 1)
        self.assertEqual(data['total_sessions'], 2)

    def test_summary_session_with_no_entries(self):
        """A session with no entries contributes to the count but not totals."""
        self._create_session()
        data = self.client.get('/api/stats/summary').get_json()
        self.assertEqual(data['total_sessions'], 1)
        self.assertEqual(data['total_buy_ins'], 0)
        self.assertEqual(data['total_payouts'], 0)
        self.assertEqual(data['total_players'], 0)
        self.assertEqual(data['house_loss'], 0)


if __name__ == '__main__':
    unittest.main()
