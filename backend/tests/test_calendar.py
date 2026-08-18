"""Tests for calendar event and RSVP API routes."""

import unittest
from datetime import datetime, timedelta

from app import create_app
from app.database.models import db, Player, Entry, Session, CalendarEvent, EventRSVP
from app.services.database_service import DatabaseService

from tests.test_config import TestConfig

CALENDAR_EVENT_FIELDS = {
    'event_id', 'title', 'date', 'time', 'location', 'description',
    'default_buy_in_value', 'max_players', 'session_id', 'is_cancelled',
    'rsvp_counts', 'rsvps', 'created_at', 'updated_at',
}


class TestCalendarAPI(unittest.TestCase):
    """Tests for the /api/events routes."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            db.session.query(EventRSVP).delete()
            db.session.query(CalendarEvent).delete()
            db.session.query(Entry).delete()
            db.session.query(Session).delete()
            db.session.query(Player).delete()
            db.session.commit()

    def _today_str(self):
        return datetime.utcnow().strftime('%Y-%m-%d')

    def _tomorrow_str(self):
        return (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')

    def _past_str(self):
        return (datetime.utcnow() - timedelta(days=10)).strftime('%Y-%m-%d')

    def _create_event(self, date=None, **extra):
        payload = {'date': date or self._today_str()}
        payload.update(extra)
        return self.client.post('/api/events', json=payload)

    def _create_player(self, name='Test Player'):
        return self.client.post('/api/players', json={'name': name})

    def _add_rsvp(self, event_id, player_id, status='YES'):
        return self.client.post(
            f'/api/events/{event_id}/rsvp',
            json={'player_id': player_id, 'status': status},
        )

    def _assert_event_fields(self, data):
        for field in CALENDAR_EVENT_FIELDS:
            self.assertIn(field, data, f"Missing field: {field}")

    @staticmethod
    def _extract_player_id(resp):
        return resp.get_json()['player_id']

    @staticmethod
    def _extract_event_id(resp):
        return resp.get_json()['event_id']

    # -- GET /api/events

    def test_get_events_empty(self):
        resp = self.client.get('/api/events')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), [])

    def test_get_events_returns_list(self):
        self._create_event(date='2024-01-15', title='New Year Party')
        resp = self.client.get('/api/events')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self._assert_event_fields(data[0])

    def test_get_events_multiple(self):
        self._create_event(date='2024-01-15')
        self._create_event(date='2024-01-16')
        resp = self.client.get('/api/events')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.get_json()), 2)

    def test_get_events_upcoming_filter(self):
        self._create_event(date=self._past_str())
        self._create_event(date=self._tomorrow_str())
        resp = self.client.get('/api/events?upcoming=true')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['date'], self._tomorrow_str())

    def test_get_events_upcoming_excludes_past(self):
        self._create_event(date=self._past_str())
        resp = self.client.get('/api/events?upcoming=true')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.get_json()), 0)

    # -- POST /api/events

    def test_create_event_minimal(self):
        resp = self._create_event(date='2024-01-15')
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self._assert_event_fields(data)
        self.assertTrue(data['event_id'].startswith('evt_20240115_'))
        self.assertEqual(data['title'], 'Poker Night')
        self.assertEqual(data['date'], '2024-01-15')
        self.assertFalse(data['is_cancelled'])
        self.assertIsNone(data['session_id'])
        self.assertEqual(data['rsvp_counts'], {'yes': 0, 'no': 0, 'maybe': 0})

    def test_create_event_full(self):
        resp = self._create_event(
            date='2024-01-15', title='Game Night', time='19:30',
            location='Home', description='Weekly game night',
            default_buy_in_value=25.50, max_players=8,
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self._assert_event_fields(data)
        self.assertEqual(data['title'], 'Game Night')
        self.assertEqual(data['time'], '19:30')
        self.assertEqual(data['location'], 'Home')
        self.assertEqual(data['description'], 'Weekly game night')
        self.assertEqual(data['default_buy_in_value'], 25.50)
        self.assertEqual(data['max_players'], 8)

    def test_create_event_default_buy_in(self):
        resp = self._create_event(date='2024-01-15')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.get_json()['default_buy_in_value'], 20.00)

    def test_create_event_missing_date(self):
        resp = self.client.post('/api/events', json={'title': 'No Date'})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.get_json())

    def test_create_event_no_body(self):
        resp = self.client.post('/api/events', json={})
        self.assertEqual(resp.status_code, 400)

    def test_create_event_invalid_date_format(self):
        resp = self._create_event(date='01/15/2024')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.get_json())

    def test_create_event_negative_buy_in(self):
        resp = self._create_event(date='2024-01-15', default_buy_in_value=-5)
        self.assertEqual(resp.status_code, 400)

    def test_create_event_buy_in_too_large(self):
        resp = self._create_event(date='2024-01-15', default_buy_in_value=10001)
        self.assertEqual(resp.status_code, 400)

    def test_create_event_invalid_buy_in_type(self):
        resp = self._create_event(date='2024-01-15', default_buy_in_value='free')
        self.assertEqual(resp.status_code, 400)

    def test_create_event_max_players_too_small(self):
        resp = self._create_event(date='2024-01-15', max_players=1)
        self.assertEqual(resp.status_code, 400)

    def test_create_event_max_players_too_large(self):
        resp = self._create_event(date='2024-01-15', max_players=51)
        self.assertEqual(resp.status_code, 400)

    # -- GET /api/events/<id>

    def test_get_event_by_id_found(self):
        resp = self._create_event(date='2024-01-15', title='Test Event')
        event_id = self._extract_event_id(resp)
        resp = self.client.get(f'/api/events/{event_id}')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self._assert_event_fields(data)
        self.assertEqual(data['event_id'], event_id)
        self.assertEqual(data['title'], 'Test Event')

    def test_get_event_by_id_not_found(self):
        resp = self.client.get('/api/events/evt_99990101_1')
        self.assertEqual(resp.status_code, 404)
        self.assertIn('error', resp.get_json())

    # -- PUT /api/events/<id>

    def test_update_event_title(self):
        resp = self._create_event(date='2024-01-15', title='Old Title')
        event_id = self._extract_event_id(resp)
        resp = self.client.put(f'/api/events/{event_id}', json={'title': 'New Title'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['title'], 'New Title')

    def test_update_event_date(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.put(f'/api/events/{event_id}', json={'date': '2024-02-01'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['date'], '2024-02-01')

    def test_update_event_invalid_date(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.put(f'/api/events/{event_id}', json={'date': 'not-a-date'})
        self.assertEqual(resp.status_code, 400)

    def test_update_event_not_found(self):
        resp = self.client.put('/api/events/evt_99990101_1', json={'title': 'New'})
        self.assertEqual(resp.status_code, 404)

    def test_update_event_no_body(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.put(f'/api/events/{event_id}', json={})
        self.assertEqual(resp.status_code, 400)

    # -- PUT /api/events/<id>/cancel

    def test_cancel_event(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.put(f'/api/events/{event_id}/cancel')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.get_json()['is_cancelled'])

    def test_cancel_event_not_found(self):
        resp = self.client.put('/api/events/evt_99990101_1/cancel')
        self.assertEqual(resp.status_code, 404)

    # -- PUT /api/events/<id>/uncancel

    def test_uncancel_event(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        self.client.put(f'/api/events/{event_id}/cancel')
        resp = self.client.put(f'/api/events/{event_id}/uncancel')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.get_json()['is_cancelled'])

    def test_uncancel_event_not_found(self):
        resp = self.client.put('/api/events/evt_99990101_1/uncancel')
        self.assertEqual(resp.status_code, 404)

    # -- DELETE /api/events/<id>

    def test_delete_event(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.delete(f'/api/events/{event_id}')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('message', resp.get_json())
        resp = self.client.get(f'/api/events/{event_id}')
        self.assertEqual(resp.status_code, 404)

    def test_delete_event_not_found(self):
        resp = self.client.delete('/api/events/evt_99990101_1')
        self.assertEqual(resp.status_code, 404)

    # -- POST /api/events/<id>/start-session

    def test_start_session_from_event_with_yes_rsvps(self):
        player_resp = self._create_player('Alice')
        player_id = self._extract_player_id(player_resp)
        event_resp = self._create_event(date='2024-01-15', default_buy_in_value=20.00)
        event_id = self._extract_event_id(event_resp)
        self._add_rsvp(event_id, player_id, 'YES')
        resp = self.client.post(f'/api/events/{event_id}/start-session')
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertIn('session', data)
        self.assertIn('event', data)
        self.assertIn('added_players', data)
        self.assertIn(player_id, data['added_players'])
        self.assertEqual(data['event']['session_id'], data['session']['session_id'])

    def test_start_session_event_not_found(self):
        resp = self.client.post('/api/events/evt_99990101_1/start-session')
        self.assertEqual(resp.status_code, 404)

    def test_start_session_cancelled_event(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        self.client.put(f'/api/events/{event_id}/cancel')
        resp = self.client.post(f'/api/events/{event_id}/start-session')
        self.assertEqual(resp.status_code, 400)

    def test_start_session_already_has_session(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        with self.app.app_context():
            db_service = DatabaseService()
            session = db_service.create_session(date_str='2024-01-15', default_buy_in_value=20.00)
            db_service.update_event(event_id, session_id=session.session_id)
        resp = self.client.post(f'/api/events/{event_id}/start-session')
        self.assertEqual(resp.status_code, 409)
        self.assertIn('session_id', resp.get_json())

    # -- POST /api/events/<id>/rsvp

    def test_create_rsvp_yes(self):
        player_resp = self._create_player('Alice')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, player_id, 'YES')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['rsvp_counts']['yes'], 1)

    def test_create_rsvp_maybe(self):
        player_resp = self._create_player('Bob')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, player_id, 'MAYBE')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['rsvp_counts']['maybe'], 1)

    def test_create_rsvp_no(self):
        player_resp = self._create_player('Carol')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, player_id, 'NO')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['rsvp_counts']['no'], 1)

    def test_create_rsvp_lowercase_status(self):
        player_resp = self._create_player('Dave')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, player_id, 'yes')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['rsvp_counts']['yes'], 1)

    def test_create_rsvp_missing_player_id(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.post(f'/api/events/{event_id}/rsvp', json={'status': 'YES'})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.get_json())

    def test_create_rsvp_invalid_status(self):
        player_resp = self._create_player('Eve')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, player_id, 'MAYBE_LATER')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.get_json())

    def test_create_rsvp_no_body(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.post(f'/api/events/{event_id}/rsvp', json={})
        self.assertEqual(resp.status_code, 400)

    def test_create_rsvp_event_not_found(self):
        player_resp = self._create_player('Frank')
        player_id = self._extract_player_id(player_resp)
        resp = self.client.post('/api/events/evt_99990101_1/rsvp',
                                json={'player_id': player_id, 'status': 'YES'})
        self.assertEqual(resp.status_code, 400)

    def test_create_rsvp_nonexistent_player(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, 'pid_999', 'YES')
        self.assertEqual(resp.status_code, 400)

    def test_update_rsvp(self):
        player_resp = self._create_player('Grace')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        self._add_rsvp(event_id, player_id, 'YES')
        resp = self._add_rsvp(event_id, player_id, 'NO')
        self.assertEqual(resp.status_code, 200)
        counts = resp.get_json()['rsvp_counts']
        self.assertEqual(counts['yes'], 0)
        self.assertEqual(counts['no'], 1)

    def test_create_rsvp_includes_rsvps_list(self):
        player_resp = self._create_player('Henry')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self._add_rsvp(event_id, player_id, 'YES')
        self.assertEqual(resp.status_code, 200)
        rsvps = resp.get_json()['rsvps']
        self.assertIsInstance(rsvps, list)
        self.assertEqual(len(rsvps), 1)
        self.assertEqual(rsvps[0]['player_id'], player_id)
        self.assertEqual(rsvps[0]['status'], 'YES')

    # -- DELETE /api/events/<id>/rsvp/<player_id>

    def test_delete_rsvp(self):
        player_resp = self._create_player('Ivan')
        player_id = self._extract_player_id(player_resp)
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        self._add_rsvp(event_id, player_id, 'YES')
        resp = self.client.delete(f'/api/events/{event_id}/rsvp/{player_id}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['rsvp_counts']['yes'], 0)

    def test_delete_rsvp_not_found(self):
        resp = self._create_event(date='2024-01-15')
        event_id = self._extract_event_id(resp)
        resp = self.client.delete(f'/api/events/{event_id}/rsvp/pid_999')
        self.assertEqual(resp.status_code, 404)
        self.assertIn('error', resp.get_json())

    def test_delete_rsvp_event_not_found(self):
        resp = self.client.delete('/api/events/evt_99990101_1/rsvp/pid_999')
        self.assertEqual(resp.status_code, 404)


if __name__ == '__main__':
    unittest.main()
