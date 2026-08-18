"""Tests for calendar event and RSVP routes.

Covers all endpoints in backend/app/routes/calendar.py:
  - GET  /api/events            (list, upcoming)
  - POST /api/events            (create with validation)
  - GET  /api/events/<id>       (retrieve)
  - PUT  /api/events/<id>       (update)
  - DELETE /api/events/<id>      (delete)
  - PUT  /api/events/<id>/cancel
  - PUT  /api/events/<id>/uncancel
  - POST /api/events/<id>/start-session
  - POST /api/events/<id>/rsvp   (create / update)
  - DELETE /api/events/<id>/rsvp/<player_id>
"""

import unittest

from app import create_app
from app.database.models import db, CalendarEvent, EventRSVP, Player, Session, Entry
from app.services.database_service import DatabaseService

from tests.test_config import TestConfig

# Field sets returned by the model ``to_dict()`` methods.
EVENT_FIELDS = {
    'event_id', 'title', 'date', 'time', 'location', 'description',
    'default_buy_in_value', 'max_players', 'session_id', 'is_cancelled',
    'rsvp_counts', 'rsvps', 'created_at', 'updated_at',
}

RSVP_FIELDS = {
    'event_id', 'player_id', 'player_name', 'status',
    'created_at', 'updated_at',
}

DATE = '2024-01-15'
FUTURE_DATE = '2099-12-31'


class TestCalendarAPI(unittest.TestCase):
    """End-to-end tests for the calendar blueprint via the Flask test client."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def setUp(self):
        """Wipe all data so every test starts from a clean slate."""
        with self.app.app_context():
            # Order respects FK constraints (children first).
            db.session.query(EventRSVP).delete()
            db.session.query(CalendarEvent).delete()
            db.session.query(Entry).delete()
            db.session.query(Session).delete()
            db.session.query(Player).delete()
            db.session.commit()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _create_event(self, date=DATE, **extra):
        """POST a minimal event and return the response object."""
        payload = {'date': date}
        payload.update(extra)
        return self.client.post('/api/events', json=payload)

    def _create_player(self, name='Alice'):
        """POST a player via the API and return the ``player_id`` string."""
        resp = self.client.post('/api/players', json={'name': name})
        self.assertEqual(resp.status_code, 201, f'player creation failed: {resp.get_json()}')
        return resp.get_json()['player_id']

    # ------------------------------------------------------------------
    # GET /api/events
    # ------------------------------------------------------------------

    def test_get_events_empty(self):
        """GET /api/events with no events returns 200 and an empty list."""
        resp = self.client.get('/api/events')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_events_after_create(self):
        """GET /api/events returns a created event with all expected fields."""
        self._create_event()
        resp = self.client.get('/api/events')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['event_id'], 'evt_20240115_1')
        self.assertEqual(data[0]['date'], DATE)
        self.assertTrue(EVENT_FIELDS.issubset(data[0].keys()))

    def test_get_upcoming_events_empty(self):
        """GET /api/events?upcoming=true returns [] when only past events exist."""
        self._create_event(date=DATE)  # past date
        resp = self.client.get('/api/events?upcoming=true')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_upcoming_events_returns_only_future(self):
        """GET /api/events?upcoming=true returns only future events."""
        self._create_event(date=DATE)            # past
        self._create_event(date=FUTURE_DATE)      # future
        resp = self.client.get('/api/events?upcoming=true')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['date'], FUTURE_DATE)

    # ------------------------------------------------------------------
    # POST /api/events
    # ------------------------------------------------------------------

    def test_create_event_success(self):
        """POST /api/events creates an event with default values."""
        resp = self._create_event()
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertEqual(data['event_id'], 'evt_20240115_1')
        self.assertEqual(data['date'], DATE)
        self.assertEqual(data['title'], 'Poker Night')  # default title
        self.assertAlmostEqual(data['default_buy_in_value'], 20.0)
        self.assertFalse(data['is_cancelled'])
        self.assertIsNone(data['session_id'])
        self.assertEqual(data['rsvp_counts'], {'yes': 0, 'no': 0, 'maybe': 0})
        self.assertEqual(data['rsvps'], [])
        self.assertTrue(EVENT_FIELDS.issubset(data.keys()))

    def test_create_event_no_body(self):
        """POST /api/events with no JSON returns 400."""
        resp = self.client.post('/api/events')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Request body is required'})

    def test_create_event_missing_date(self):
        """POST /api/events without a date returns 400."""
        resp = self._create_event()  # remove date
        resp = self.client.post('/api/events', json={})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Date is required (YYYY-MM-DD)'},
        )

    def test_create_event_date_not_string(self):
        """POST /api/events with a non-string date returns 400."""
        resp = self.client.post('/api/events', json={'date': 20240115})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Date is required (YYYY-MM-DD)'},
        )

    def test_create_event_invalid_date(self):
        """POST /api/events with a malformed date returns 400."""
        resp = self.client.post('/api/events', json={'date': '01/15/2024'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Invalid date format. Use YYYY-MM-DD'},
        )

    def test_create_event_custom_fields(self):
        """POST /api/events stores all custom fields."""
        resp = self._create_event(
            title='Game Night',
            time='19:30',
            location='Home',
            description='Weekly poker',
            default_buy_in_value=30.0,
            max_players=6,
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertEqual(data['title'], 'Game Night')
        self.assertEqual(data['time'], '19:30')
        self.assertEqual(data['location'], 'Home')
        self.assertEqual(data['description'], 'Weekly poker')
        self.assertAlmostEqual(data['default_buy_in_value'], 30.0)
        self.assertEqual(data['max_players'], 6)

    def test_create_event_invalid_buy_in(self):
        """POST /api/events with a non-numeric buy-in returns 400."""
        resp = self.client.post('/api/events', json={'date': DATE, 'default_buy_in_value': 'abc'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Invalid buy-in value'})

    def test_create_event_negative_buy_in(self):
        """POST /api/events with a negative buy-in returns 400."""
        resp = self.client.post('/api/events', json={'date': DATE, 'default_buy_in_value': -5.0})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Buy-in must be between 0 and 10000'})

    def test_create_event_buy_in_too_large(self):
        """POST /api/events with a buy-in over 10000 returns 400."""
        resp = self.client.post('/api/events', json={'date': DATE, 'default_buy_in_value': 10001})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Buy-in must be between 0 and 10000'})

    def test_create_event_max_players_too_low(self):
        """POST /api/events with max_players < 2 returns 400."""
        resp = self.client.post('/api/events', json={'date': DATE, 'max_players': 1})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Max players must be between 2 and 50'})

    # ------------------------------------------------------------------
    # GET /api/events/<event_id>
    # ------------------------------------------------------------------

    def test_get_event_not_found(self):
        """GET /api/events/<nonexistent> returns 404."""
        resp = self.client.get('/api/events/evt_00000000_0')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.get_json(), {'error': 'Event not found'})

    def test_get_event_success(self):
        """GET /api/events/<valid_id> returns the event with RSVPs."""
        self._create_event()
        resp = self.client.get('/api/events/evt_20240115_1')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['event_id'], 'evt_20240115_1')
        self.assertTrue(EVENT_FIELDS.issubset(data.keys()))
        self.assertEqual(data['rsvps'], [])

    # ------------------------------------------------------------------
    # PUT /api/events/<event_id>
    # ------------------------------------------------------------------

    def test_update_event_success(self):
        """PUT /api/events/<id> updates specified fields."""
        self._create_event()
        resp = self.client.put('/api/events/evt_20240115_1', json={'title': 'Updated Title'})
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['title'], 'Updated Title')
        self.assertTrue(EVENT_FIELDS.issubset(data.keys()))

    def test_update_event_not_found(self):
        """PUT /api/events/<nonexistent> returns 404."""
        resp = self.client.put('/api/events/evt_00000000_0', json={'title': 'X'})
        self.assertEqual(resp.status_code, 404)

    def test_update_event_no_body(self):
        """PUT /api/events/<id> with no body returns 400."""
        self._create_event()
        resp = self.client.put('/api/events/evt_20240115_1')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Request body is required'})

    def test_update_event_invalid_date(self):
        """PUT /api/events/<id> with an invalid date returns 400."""
        self._create_event()
        resp = self.client.put('/api/events/evt_20240115_1', json={'date': 'bad'})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.get_json(),
            {'error': 'Invalid date format. Use YYYY-MM-DD'},
        )

    # ------------------------------------------------------------------
    # DELETE /api/events/<event_id>
    # ------------------------------------------------------------------

    def test_delete_event_success(self):
        """DELETE /api/events/<id> removes the event."""
        self._create_event()
        resp = self.client.delete('/api/events/evt_20240115_1')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), {'message': 'Event deleted successfully'})
        # Verify it's gone
        resp = self.client.get('/api/events/evt_20240115_1')
        self.assertEqual(resp.status_code, 404)

    def test_delete_event_not_found(self):
        """DELETE /api/events/<nonexistent> returns 404."""
        resp = self.client.delete('/api/events/evt_00000000_0')
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # PUT /api/events/<event_id>/cancel
    # ------------------------------------------------------------------

    def test_cancel_event_success(self):
        """PUT /api/events/<id>/cancel sets is_cancelled to True."""
        self._create_event()
        resp = self.client.put('/api/events/evt_20240115_1/cancel')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['is_cancelled'])

    def test_cancel_event_not_found(self):
        """PUT /api/events/<nonexistent>/cancel returns 404."""
        resp = self.client.put('/api/events/evt_00000000_0/cancel')
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # PUT /api/events/<event_id>/uncancel
    # ------------------------------------------------------------------

    def test_uncancel_event_success(self):
        """PUT /api/events/<id>/uncancel restores a cancelled event."""
        self._create_event()
        self.client.put('/api/events/evt_20240115_1/cancel')
        resp = self.client.put('/api/events/evt_20240115_1/uncancel')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertFalse(data['is_cancelled'])

    def test_uncancel_event_not_found(self):
        """PUT /api/events/<nonexistent>/uncancel returns 404."""
        resp = self.client.put('/api/events/evt_00000000_0/uncancel')
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # POST /api/events/<event_id>/rsvp
    # ------------------------------------------------------------------

    def test_create_rsvp_success(self):
        """POST /api/events/<id>/rsvp creates an RSVP and updates counts."""
        self._create_event()
        pid = self._create_player('Alice')
        resp = self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid, 'status': 'YES'},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['rsvp_counts']['yes'], 1)
        self.assertEqual(len(data['rsvps']), 1)
        self.assertEqual(data['rsvps'][0]['player_id'], pid)
        self.assertEqual(data['rsvps'][0]['status'], 'YES')
        self.assertEqual(data['rsvps'][0]['player_name'], 'Alice')

    def test_create_rsvp_no_body(self):
        """POST /api/events/<id>/rsvp with no body returns 400."""
        self._create_event()
        resp = self.client.post('/api/events/evt_20240115_1/rsvp')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Request body is required'})

    def test_create_rsvp_missing_player_id(self):
        """POST /api/events/<id>/rsvp without player_id returns 400."""
        self._create_event()
        resp = self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'status': 'YES'},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'player_id is required'})

    def test_create_rsvp_missing_status(self):
        """POST /api/events/<id>/rsvp without status returns 400."""
        self._create_event()
        pid = self._create_player('Bob')
        resp = self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'status must be YES, NO, or MAYBE'})

    def test_create_rsvp_invalid_status(self):
        """POST /api/events/<id>/rsvp with an invalid status returns 400."""
        self._create_event()
        pid = self._create_player('Carol')
        resp = self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid, 'status': 'INTERESTED'},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'status must be YES, NO, or MAYBE'})

    def test_create_rsvp_event_not_found(self):
        """POST /api/events/<nonexistent>/rsvp returns 400."""
        pid = self._create_player('Dave')
        resp = self.client.post(
            '/api/events/evt_00000000_0/rsvp',
            json={'player_id': pid, 'status': 'YES'},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {'error': 'Failed to submit RSVP'})

    def test_update_rsvp_existing(self):
        """POST /api/events/<id>/rsvp with an existing RSVP updates the status."""
        self._create_event()
        pid = self._create_player('Eve')
        self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid, 'status': 'YES'},
        )
        resp = self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid, 'status': 'NO'},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['rsvp_counts']['yes'], 0)
        self.assertEqual(data['rsvp_counts']['no'], 1)
        self.assertEqual(data['rsvps'][0]['status'], 'NO')

    # ------------------------------------------------------------------
    # DELETE /api/events/<event_id>/rsvp/<player_id>
    # ------------------------------------------------------------------

    def test_delete_rsvp_success(self):
        """DELETE /api/events/<id>/rsvp/<pid> removes the RSVP."""
        self._create_event()
        pid = self._create_player('Frank')
        self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid, 'status': 'YES'},
        )
        resp = self.client.delete(f'/api/events/evt_20240115_1/rsvp/{pid}')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['rsvps'], [])

    def test_delete_rsvp_not_found(self):
        """DELETE /api/events/<id>/rsvp/<nonexistent> returns 404."""
        self._create_event()
        resp = self.client.delete('/api/events/evt_20240115_1/rsvp/pid_999')
        self.assertEqual(resp.status_code, 404)

    # ------------------------------------------------------------------
    # POST /api/events/<event_id>/start-session
    # ------------------------------------------------------------------

    def test_start_session_success(self):
        """POST /api/events/<id>/start-session creates a session and links it."""
        self._create_event()
        pid = self._create_player('Grace')
        self.client.post(
            '/api/events/evt_20240115_1/rsvp',
            json={'player_id': pid, 'status': 'YES'},
        )
        resp = self.client.post('/api/events/evt_20240115_1/start-session')
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertIn('session', data)
        self.assertIn('event', data)
        self.assertIn('added_players', data)
        self.assertEqual(len(data['added_players']), 1)
        self.assertEqual(data['added_players'][0], pid)
        # Event should now be linked to the session
        self.assertIsNotNone(data['event']['session_id'])

    def test_start_session_not_found(self):
        """POST /api/events/<nonexistent>/start-session returns 404."""
        resp = self.client.post('/api/events/evt_00000000_0/start-session')
        self.assertEqual(resp.status_code, 404)

    def test_start_session_cancelled(self):
        """POST /api/events/<id>/start-session on a cancelled event returns 400."""
        self._create_event()
        self.client.put('/api/events/evt_20240115_1/cancel')
        resp = self.client.post('/api/events/evt_20240115_1/start-session')
        self.assertEqual(resp.status_code, 400)

    def test_start_session_already_linked(self):
        """POST /api/events/<id>/start-session twice returns 409."""
        self._create_event()
        self.client.post('/api/events/evt_20240115_1/start-session')
        resp = self.client.post('/api/events/evt_20240115_1/start-session')
        self.assertEqual(resp.status_code, 409)


if __name__ == '__main__':
    unittest.main()
