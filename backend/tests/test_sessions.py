"""Tests for session API routes."""

import unittest

from app import create_app
from app.database.models import db, Session, Entry

from tests.test_config import TestConfig

# Fields always present in Session.to_dict() (chip_distribution and
# total_chips are only included when the create route calculates them).
SESSION_FIELDS = {
    'session_id', 'date', 'default_buy_in_value', 'is_active', 'status',
    'wisdom_quote', 'wisdom_player_id', 'created_at', 'updated_at',
    'total_value',
}


class TestSessionsAPI(unittest.TestCase):
    """Tests for the /api/sessions routes."""

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
            db.session.commit()

    def _create_session(self, date="2024-01-15", **extra):
        """Helper: POST a session via the API and return the response."""
        payload = {'date': date}
        payload.update(extra)
        return self.client.post('/api/sessions', json=payload)

    # ------------------------------------------------------------------
    # GET /api/sessions  (all sessions)
    # ------------------------------------------------------------------

    def test_get_sessions_empty(self):
        """GET /api/sessions returns an empty list when no sessions exist."""
        resp = self.client.get('/api/sessions')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_sessions_after_create(self):
        """GET /api/sessions returns the created session."""
        self._create_session()
        resp = self.client.get('/api/sessions')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        session = data[0]
        self.assertTrue(SESSION_FIELDS.issubset(set(session.keys())))
        self.assertEqual(session['session_id'], 'sid_20240115_1')
        self.assertEqual(session['date'], '2024-01-15')
        self.assertTrue(session['is_active'])

    # ------------------------------------------------------------------
    # GET /api/sessions/active  (active sessions)
    # ------------------------------------------------------------------

    def test_get_active_sessions_empty(self):
        """GET /api/sessions/active returns an empty list when no sessions exist."""
        resp = self.client.get('/api/sessions/active')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_active_sessions_returns_created(self):
        """GET /api/sessions/active returns created sessions."""
        self._create_session()
        resp = self.client.get('/api/sessions/active')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertTrue(data[0]['is_active'])

    # ------------------------------------------------------------------
    # POST /api/sessions
    # ------------------------------------------------------------------

    def test_create_session_success(self):
        """POST /api/sessions with a valid date returns 201 and session data."""
        resp = self._create_session()
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        # Base fields must always be present.
        self.assertTrue(SESSION_FIELDS.issubset(set(data.keys())))
        self.assertEqual(data['session_id'], 'sid_20240115_1')
        self.assertEqual(data['date'], '2024-01-15')
        self.assertEqual(data['default_buy_in_value'], 20.00)
        self.assertTrue(data['is_active'])
        self.assertEqual(data['status'], 'ACTIVE')
        self.assertIsNone(data['wisdom_quote'])
        self.assertIsNone(data['wisdom_player_id'])
        self.assertEqual(data['total_value'], 0.0)

    def test_create_session_no_body(self):
        """POST /api/sessions with an empty JSON object returns 400."""
        resp = self.client.post('/api/sessions', json={})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Request body is required'},
        )

    def test_create_session_missing_date(self):
        """POST /api/sessions without a date key returns 400."""
        resp = self.client.post(
            '/api/sessions', json={'default_buy_in_value': 30.0}
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Date is required and must be a string'},
        )

    def test_create_session_date_not_string(self):
        """POST /api/sessions with a non-string date returns 400."""
        resp = self.client.post('/api/sessions', json={'date': 42})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Date is required and must be a string'},
        )

    def test_create_session_invalid_date_format(self):
        """POST /api/sessions with a non-YYYY-MM-DD date returns 400."""
        resp = self.client.post('/api/sessions', json={'date': '15-01-2024'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Invalid date format. Use YYYY-MM-DD'},
        )

    def test_create_session_default_buy_in(self):
        """POST /api/sessions without a buy-in value defaults to 20.00."""
        resp = self._create_session()
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertEqual(data['default_buy_in_value'], 20.00)

    def test_create_session_custom_buy_in(self):
        """POST /api/sessions with a custom buy-in value stores it correctly."""
        resp = self._create_session(default_buy_in_value=50.00)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertEqual(data['default_buy_in_value'], 50.00)

    def test_create_session_buy_in_zero(self):
        """POST /api/sessions with a buy-in of 0 returns 400."""
        resp = self._create_session(default_buy_in_value=0)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Buy-in value must be between 0.01 and 10000'},
        )

    def test_create_session_buy_in_too_large(self):
        """POST /api/sessions with a buy-in over 10000 returns 400."""
        resp = self._create_session(default_buy_in_value=10001)
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Buy-in value must be between 0.01 and 10000'},
        )

    def test_create_session_invalid_buy_in(self):
        """POST /api/sessions with a non-numeric buy-in returns 400."""
        resp = self._create_session(default_buy_in_value='not-a-number')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Invalid buy-in value'},
        )

    # ------------------------------------------------------------------
    # GET /api/sessions/<session_id>  (details)
    # ------------------------------------------------------------------

    def test_get_session_details_not_found(self):
        """GET /api/sessions/<invalid_id> returns 404."""
        resp = self.client.get('/api/sessions/nonexistent')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Session not found'},
        )

    def test_get_session_details_success(self):
        """GET /api/sessions/<session_id> returns session info and entries."""
        self._create_session()
        resp = self.client.get('/api/sessions/sid_20240115_1')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn('session_info', data)
        self.assertIn('entries', data)
        self.assertEqual(data['session_info']['session_id'], 'sid_20240115_1')
        self.assertEqual(data['session_info']['date'], '2024-01-15')
        self.assertTrue(data['session_info']['is_active'])
        self.assertEqual(data['entries'], [])


if __name__ == '__main__':
    unittest.main()
