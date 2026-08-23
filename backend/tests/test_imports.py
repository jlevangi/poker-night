"""Tests for the PokerNow import API routes."""

import io
import unittest

from app import create_app
from app.database.models import db, Player, Entry, Session, SessionImport

from tests.test_config import TestConfig
from tests.test_pokernow_parser import build_log, P1, P2


LOG = build_log([
    f'The player "{P1}" requested a seat.',
    f'The admin approved the player "{P1}" participation with a stack of 20.00.',
    f'The player "{P2}" requested a seat.',
    f'The admin approved the player "{P2}" participation with a stack of 20.00.',
    f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
    f'Player stacks: #1 "{P1}" (20.00) | #2 "{P2}" (20.00)',
    f'"{P1}" posts a small blind of 0.05',
    f'"{P2}" posts a big blind of 0.10',
    f'"{P1}" raises to 5.00',
    f'"{P2}" calls 5.00',
    'Flop:  [2♣, 7♦, K♥]',
    f'"{P1}" bets 15.00 and go all in',
    f'"{P2}" calls 15.00 and go all in',
    f'"{P1}" shows a A♠, K♠.',
    f'"{P2}" shows a Q♥, Q♦.',
    'Turn: 2♣, 7♦, K♥ [3♠]',
    'River: 2♣, 7♦, K♥, 3♠ [9♣]',
    f'"{P1}" collected 40.00 from pot with Pair, K\'s (combination: A♠, K♠, K♥, 9♣, 7♦)',
    '-- ending hand #1 --',
])


class TestImportsAPI(unittest.TestCase):
    """Tests for the /api/imports/pokernow routes."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            db.session.query(SessionImport).delete()
            db.session.query(Entry).delete()
            db.session.query(Session).delete()
            db.session.query(Player).delete()
            db.session.commit()

    # -- helpers -------------------------------------------------------------

    def _analyze(self, text=LOG, filename='poker_now_log.csv', field='log', **extra):
        data = {field: (io.BytesIO(text.encode('utf-8')), filename)}
        data.update(extra)
        return self.client.post(
            '/api/imports/pokernow/analyze',
            data=data,
            content_type='multipart/form-data',
        )

    def _commit_payload(self, analysis, **overrides):
        payload = {
            'date': analysis['suggested_date'] or '2026-08-21',
            'default_buy_in_value': analysis['suggested_buy_in'],
            'filename': analysis['filename'],
            'stats': analysis,
            'players': [{
                'seat': player['seat'],
                'player_id': player['suggested_player_id'] or '',
                'new_player_name': '' if player['suggested_player_id'] else player['name'],
                'buy_in': player['buy_in'],
                'cash_out': player['cash_out'],
                'buy_in_count': max(len(player['buy_in_events']), 1),
                'seven_two_wins': player['seven_two_wins'],
            } for player in analysis['players']],
        }
        payload.update(overrides)
        return payload

    def _import(self, **overrides):
        analysis = self._analyze().get_json()
        response = self.client.post(
            '/api/imports/pokernow/commit',
            json=self._commit_payload(analysis, **overrides),
        )
        return analysis, response

    # -- renames -------------------------------------------------------------

    def test_renaming_a_player_updates_an_already_imported_session(self):
        """The stored stats blob freezes the name; the read path must not.

        A player renamed in /admin still read as their old name on the session
        they were imported into, because commit wrote player_name into the JSON
        and nothing refreshed it.
        """
        analysis, response = self._import()
        self.assertEqual(response.status_code, 201, response.get_json())
        session_id = response.get_json()['session_id']

        with self.app.app_context():
            player = Player.query.first()
            original = player.name
            player.name = 'Renamed Entirely'
            db.session.commit()

        body = self.client.get(f'/api/sessions/{session_id}/import').get_json()
        names = {row['player_name'] for row in body['players'] if row.get('player_id')}
        self.assertIn('Renamed Entirely', names)
        self.assertNotIn(original, names)

        # Awards carry the same mapping and must agree with the breakdown.
        for award in body['awards']:
            if award.get('player_id'):
                self.assertNotEqual(original, award['player_name'])

    def test_a_deleted_player_keeps_the_name_the_log_recorded(self):
        """Nothing else remembers who they were, so the snapshot stands."""
        analysis, response = self._import()
        session_id = response.get_json()['session_id']
        with self.app.app_context():
            stored = {p.player_id: p.name for p in Player.query.all()}
            Player.query.delete()
            db.session.commit()
        body = self.client.get(f'/api/sessions/{session_id}/import').get_json()
        for row in body['players']:
            if row.get('player_id') in stored:
                self.assertEqual(stored[row['player_id']], row['player_name'])

    # -- 7-2 wins ------------------------------------------------------------

    def test_import_carries_seven_two_wins_to_the_player_total(self):
        """An imported log should not still need the + button clicked.

        The parser counts 7-2 wins from the hand log, but only the entry was
        being written; player.seven_two_wins -- the number the dashboard shows
        -- stayed where it was.
        """
        analysis, response = self._import(players=[{
            'seat': 1, 'player_id': '', 'new_player_name': 'Seven Deuce',
            'buy_in': 20.0, 'cash_out': 40.0, 'buy_in_count': 1,
            'seven_two_wins': 3,
        }])
        self.assertEqual(response.status_code, 201, response.get_json())
        with self.app.app_context():
            player = Player.query.filter_by(name='Seven Deuce').first()
            self.assertIsNotNone(player)
            self.assertEqual(3, player.seven_two_wins)
            entry = Entry.query.filter_by(player_id=player.player_id).first()
            self.assertEqual(3, entry.session_seven_two_wins)

    def test_correcting_an_entry_moves_the_total_by_the_delta(self):
        """Re-committing the SAME session+player must not add the count twice.

        Re-importing a log creates a new session, and two sessions of three
        wins really is six -- that is correct.  What must not double is fixing
        an entry that already exists: the total tracks the corrected figure.
        """
        from app.services.database_service import DatabaseService

        with self.app.app_context():
            db_service = DatabaseService()
            player = db_service.add_player('Seven Deuce')
            session = db_service.create_session('2026-08-21', 20.0)

            def commit(wins):
                db_service.upsert_entry_with_amounts(
                    session_id=session.session_id, player_id=player.player_id,
                    buy_in_count=1, total_buy_in_amount=20.0, payout=40.0,
                    seven_two_wins=wins,
                )
                return Player.query.filter_by(
                    player_id=player.player_id).first().seven_two_wins

            self.assertEqual(3, commit(3), 'first import writes the full count')
            self.assertEqual(3, commit(3), 're-committing the same figure is a no-op')
            self.assertEqual(5, commit(5), 'a correction upward moves by +2')
            self.assertEqual(1, commit(1), 'a correction downward moves by -4')
            self.assertEqual(0, commit(0), 'clearing it removes what it added')

    # -- analyze -------------------------------------------------------------

    def test_analyze_returns_preview(self):
        response = self._analyze()
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body['summary']['hands_played'], 1)
        self.assertEqual(len(body['players']), 2)
        self.assertEqual(body['filename'], 'poker_now_log.csv')

    def test_analyze_writes_nothing(self):
        self._analyze()
        with self.app.app_context():
            self.assertEqual(db.session.query(Session).count(), 0)
            self.assertEqual(db.session.query(Player).count(), 0)

    def test_analyze_suggests_existing_players_by_name(self):
        self.client.post('/api/players', json={'name': 'alice'})
        body = self._analyze().get_json()
        alice = next(p for p in body['players'] if p['name'] == 'Alice')
        bob = next(p for p in body['players'] if p['name'] == 'Bob')
        self.assertEqual(alice['suggested_player_name'], 'alice')
        self.assertIsNone(bob['suggested_player_id'])

    def test_analyze_accepts_a_ledger_in_the_log_field(self):
        """Files are classified by their header, not by which field they arrived in."""
        from tests.test_pokernow_parser import TestLedger
        body = self._analyze(text=TestLedger.LEDGER, filename='ledger.csv').get_json()
        self.assertTrue(body['has_ledger'])

    def test_analyze_without_a_file(self):
        response = self.client.post(
            '/api/imports/pokernow/analyze', data={}, content_type='multipart/form-data'
        )
        self.assertEqual(response.status_code, 400)

    def test_analyze_rejects_a_file_with_no_players(self):
        response = self._analyze(text='entry,at,order\n')
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.get_json())

    def test_analyze_survives_a_non_poker_csv(self):
        response = self._analyze(text='a,b,c\n1,2,3\n')
        self.assertEqual(response.status_code, 400)

    # -- commit --------------------------------------------------------------

    def test_commit_creates_session_players_and_entries(self):
        analysis, response = self._import()
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(len(body['entries']), 2)
        self.assertCountEqual(body['created_players'], ['Alice', 'Bob'])

        detail = self.client.get(f"/api/sessions/{body['session_id']}").get_json()
        self.assertEqual(detail['session_info']['status'], 'ENDED')
        self.assertEqual(len(detail['entries']), 2)

    def test_commit_stores_exact_amounts_not_multiples_of_the_buy_in(self):
        analysis, response = self._import()
        payload = self._commit_payload(analysis)
        payload['players'][0]['buy_in'] = 45.37
        payload['players'][0]['cash_out'] = 12.13
        payload['date'] = '2026-08-22'
        second = self.client.post('/api/imports/pokernow/commit', json=payload)
        self.assertEqual(second.status_code, 201)
        entry = second.get_json()['entries'][0]
        self.assertEqual(entry['total_buy_in_amount'], 45.37)
        self.assertEqual(entry['payout'], 12.13)
        self.assertEqual(entry['profit'], -33.24)

    def test_commit_reuses_an_existing_player(self):
        created = self.client.post('/api/players', json={'name': 'Alice'}).get_json()
        _, response = self._import()
        self.assertEqual(response.get_json()['created_players'], ['Bob'])
        player_ids = {e['player_id'] for e in response.get_json()['entries']}
        self.assertIn(created['player_id'], player_ids)

    def test_commit_skips_players_with_no_mapping(self):
        analysis = self._analyze().get_json()
        payload = self._commit_payload(analysis)
        payload['players'][1]['new_player_name'] = ''
        payload['players'][1]['player_id'] = ''
        response = self.client.post('/api/imports/pokernow/commit', json=payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.get_json()['entries']), 1)

    def test_commit_rejects_duplicate_player_mapping(self):
        created = self.client.post('/api/players', json={'name': 'Zed'}).get_json()
        analysis = self._analyze().get_json()
        payload = self._commit_payload(analysis)
        for player in payload['players']:
            player['player_id'] = created['player_id']
            player['new_player_name'] = ''
        response = self.client.post('/api/imports/pokernow/commit', json=payload)
        self.assertEqual(response.status_code, 400)
        with self.app.app_context():
            self.assertEqual(db.session.query(Session).count(), 0)

    def test_commit_rejects_unknown_player_id(self):
        analysis = self._analyze().get_json()
        payload = self._commit_payload(analysis)
        payload['players'][0]['player_id'] = 'pid_999'
        response = self.client.post('/api/imports/pokernow/commit', json=payload)
        self.assertEqual(response.status_code, 400)
        with self.app.app_context():
            self.assertEqual(db.session.query(Session).count(), 0)

    def test_commit_rejects_bad_date(self):
        analysis = self._analyze().get_json()
        response = self.client.post(
            '/api/imports/pokernow/commit',
            json=self._commit_payload(analysis, date='not-a-date'),
        )
        self.assertEqual(response.status_code, 400)

    def test_commit_rejects_negative_amounts(self):
        analysis = self._analyze().get_json()
        payload = self._commit_payload(analysis)
        payload['players'][0]['buy_in'] = -5
        response = self.client.post('/api/imports/pokernow/commit', json=payload)
        self.assertEqual(response.status_code, 400)

    def test_commit_without_a_body(self):
        response = self.client.post('/api/imports/pokernow/commit', json=None)
        self.assertEqual(response.status_code, 400)

    def test_commit_can_leave_the_session_active(self):
        analysis = self._analyze().get_json()
        response = self.client.post(
            '/api/imports/pokernow/commit',
            json=self._commit_payload(analysis, end_session=False),
        )
        self.assertEqual(response.get_json()['session']['status'], 'ACTIVE')

    def test_seven_two_wins_carry_into_the_entry(self):
        analysis = self._analyze().get_json()
        payload = self._commit_payload(analysis)
        payload['players'][0]['seven_two_wins'] = 2
        response = self.client.post('/api/imports/pokernow/commit', json=payload)
        entry = response.get_json()['entries'][0]
        self.assertEqual(entry['session_seven_two_wins'], 2)

    # -- stored stats --------------------------------------------------------

    def test_stored_stats_are_readable_and_mapped_to_players(self):
        _, response = self._import()
        session_id = response.get_json()['session_id']
        stored = self.client.get(f'/api/sessions/{session_id}/import')
        self.assertEqual(stored.status_code, 200)
        body = stored.get_json()
        self.assertEqual(body['hands_played'], 1)
        self.assertEqual(body['source'], 'pokernow')
        # Every PokerNow seat should now carry the app player it became.
        for player in body['players']:
            self.assertTrue(player['player_id'].startswith('pid_'))
        for award in body['awards']:
            self.assertIn('player_id', award)

    def test_stats_missing_for_a_normal_session(self):
        created = self.client.post(
            '/api/sessions', json={'date': '2026-08-21', 'default_buy_in_value': 20}
        ).get_json()
        response = self.client.get(f"/api/sessions/{created['session_id']}/import")
        self.assertEqual(response.status_code, 404)

    def test_delete_stats_leaves_the_session_alone(self):
        _, response = self._import()
        session_id = response.get_json()['session_id']
        self.assertEqual(
            self.client.delete(f'/api/sessions/{session_id}/import').status_code, 200
        )
        self.assertEqual(
            self.client.delete(f'/api/sessions/{session_id}/import').status_code, 404
        )
        detail = self.client.get(f'/api/sessions/{session_id}')
        self.assertEqual(len(detail.get_json()['entries']), 2)


if __name__ == '__main__':
    unittest.main()
