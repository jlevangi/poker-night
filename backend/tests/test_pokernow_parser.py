"""Tests for the PokerNow log parser.

The fixtures here are hand-written miniature logs in PokerNow's own export
format (newest row first, ``order`` descending) so each test pins down one
piece of the grammar without needing a real four-hour game.
"""

import unittest

from app.services import pokernow_parser as pokernow


def build_log(entries):
    """Assemble a PokerNow-shaped CSV from oldest-to-newest entries.

    The real export is newest-first with a descending ``order`` column, so the
    list is reversed and numbered on the way out.
    """
    rows = ['entry,at,order']
    total = len(entries)
    for index, entry in enumerate(reversed(entries)):
        order = 100 + (total - index)
        escaped = entry.replace('"', '""')
        rows.append(f'"{escaped}",2026-08-21T0{index % 10}:00:00.000Z,{order}')
    return '\n'.join(rows) + '\n'


P1 = 'Alice @ aaa111'
P2 = 'Bob @ bbb222'
P3 = 'Cara @ ccc333'


class TestSeatParsing(unittest.TestCase):
    """Nicknames are freeform; the PokerNow id is what anchors the split."""

    def test_splits_name_and_id(self):
        self.assertEqual(pokernow.split_seat('Alice @ aaa111'), ('Alice', 'aaa111'))

    def test_nickname_containing_at_sign(self):
        self.assertEqual(
            pokernow.split_seat('e@il @ xyz789'), ('e@il', 'xyz789')
        )

    def test_nickname_with_spaces(self):
        self.assertEqual(
            pokernow.split_seat('Big Slick @ zz1'), ('Big Slick', 'zz1')
        )

    def test_seat_without_id(self):
        self.assertEqual(pokernow.split_seat('Anonymous'), ('Anonymous', ''))


class TestHandRanking(unittest.TestCase):
    """Showdown descriptions map onto a comparable rank."""

    def test_ranks_are_ordered(self):
        pairs = pokernow.rank_of_hand("Pair, 7's")[0]
        flush = pokernow.rank_of_hand('Flush, A High')[0]
        quads = pokernow.rank_of_hand('Four of a Kind, 3\'s')[0]
        self.assertLess(pairs, flush)
        self.assertLess(flush, quads)

    def test_two_pair_is_not_read_as_pair(self):
        self.assertEqual(pokernow.rank_of_hand('Two Pair, A\'s & 5\'s')[1], 'Two Pair')

    def test_unknown_description(self):
        self.assertEqual(pokernow.rank_of_hand('Something Else'), (0, ''))

    def test_seven_deuce_detection(self):
        self.assertTrue(pokernow.is_seven_deuce(['7♦', '2♠']))
        self.assertTrue(pokernow.is_seven_deuce(['2♣', '7♥']))
        self.assertFalse(pokernow.is_seven_deuce(['7♦', '3♠']))
        self.assertFalse(pokernow.is_seven_deuce(['7♦']))


class TestPotReconstruction(unittest.TestCase):
    """Action amounts are street totals, so the pot has to be rebuilt carefully."""

    def _one_hand(self, entries):
        game = pokernow.PokerNowLogParser().parse(build_log(entries))
        self.assertEqual(len(game.hands), 1)
        return game

    def test_blind_absorbed_into_later_call(self):
        """A big blind who calls has bet the call total, not blind + call."""
        game = self._one_hand([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" raises to 0.30',
            f'"{P2}" calls 0.30',
            'Flop:  [2♣, 7♦, K♠]',
            f'"{P1}" checks',
            f'"{P2}" checks',
            f'"{P1}" collected 0.60 from pot with Pair, K\'s',
            '-- ending hand #1 --',
        ])
        hand = game.hands[0]
        self.assertEqual(hand.pot, 0.60)
        self.assertEqual(hand.contributed[P2], 0.30)
        self.assertEqual(game.warnings, [])

    def test_uncalled_bet_is_returned(self):
        game = self._one_hand([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" raises to 5.00',
            f'"{P2}" folds',
            f'Uncalled bet of 4.90 returned to "{P1}"',
            f'"{P1}" collected 0.20 from pot',
            '-- ending hand #1 --',
        ])
        hand = game.hands[0]
        self.assertEqual(hand.contributed[P1], 0.10)
        self.assertEqual(hand.pot, 0.20)
        self.assertEqual(game.warnings, [])

    def test_missed_big_blind_is_live_and_missing_small_is_dead(self):
        """Returning from the blinds costs a live big blind plus a dead small one."""
        game = self._one_hand([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P3}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00) | #3 "{P3}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P3}" posts a missing small blind of 0.05',
            f'"{P3}" posts a missed big blind of 0.10',
            f'"{P3}" raises to 0.30',
            f'"{P1}" folds',
            f'"{P2}" folds',
            f'Uncalled bet of 0.20 returned to "{P3}"',
            f'"{P3}" collected 0.30 from pot',
            '-- ending hand #1 --',
        ])
        hand = game.hands[0]
        # 0.05 dead + 0.10 live (absorbed into the raise, then 0.20 returned).
        self.assertEqual(hand.contributed[P3], 0.15)
        self.assertEqual(hand.pot, 0.30)
        self.assertEqual(game.warnings, [])

    def test_split_pot_across_two_runs(self):
        game = self._one_hand([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" raises to 10.00 and go all in',
            f'"{P2}" calls 10.00 and go all in',
            'All players in hand choose to run it twice.',
            f'"{P1}" shows a A♠, K♠.',
            f'"{P2}" shows a Q♥, Q♦.',
            'Flop:  [2♣, 7♦, K♥]',
            'Turn: 2♣, 7♦, K♥ [3♠]',
            'River: 2♣, 7♦, K♥, 3♠ [9♣]',
            'Flop (second run):  [4♦, 5♦, 6♦]',
            'Turn (second run): 4♦, 5♦, 6♦ [8♥]',
            'River (second run): 4♦, 5♦, 6♦, 8♥ [J♣]',
            f'"{P1}" collected 10.00 from pot with Pair, K\'s',
            f'"{P2}" collected 10.00 from pot with Pair, Q\'s on the second run',
            '-- ending hand #1 --',
        ])
        hand = game.hands[0]
        self.assertEqual(hand.pot, 20.00)
        self.assertTrue(hand.run_it_twice)
        self.assertTrue(hand.went_to_showdown)
        # The second-run board must not be mistaken for extra streets.
        self.assertEqual(hand.board, ['2♣', '7♦', 'K♥', '3♠', '9♣'])
        self.assertEqual(game.warnings, [])

    def test_mismatched_pot_is_reported(self):
        game = self._one_hand([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" folds',
            f'"{P2}" collected 5.00 from pot',
            '-- ending hand #1 --',
        ])
        self.assertEqual(len(game.warnings), 1)
        self.assertIn('Hand #1', game.warnings[0])


class TestPlayerStatistics(unittest.TestCase):
    """VPIP, aggression, and showdown counting."""

    def setUp(self):
        self.game = pokernow.PokerNowLogParser().parse(build_log([
            # Hand 1: Alice raises and takes it down without a showdown.
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" raises to 0.30',
            f'"{P2}" folds',
            f'Uncalled bet of 0.20 returned to "{P1}"',
            f'"{P1}" collected 0.20 from pot',
            '-- ending hand #1 --',
            # Hand 2: Bob folds the small blind without putting a chip in.
            f'-- starting hand #2 (id: h2)  No Limit Texas Hold\'em (dealer: "{P2}") --',
            f'Player stacks: #1 "{P1}" (10.10) | #2 "{P2}" (9.90)',
            f'"{P2}" posts a small blind of 0.05',
            f'"{P1}" posts a big blind of 0.10',
            f'"{P2}" folds',
            f'Uncalled bet of 0.05 returned to "{P1}"',
            f'"{P1}" collected 0.10 from pot',
            '-- ending hand #2 --',
        ]))
        self.stats = {
            t.name: pokernow._player_stats(t) for t in self.game.players.values()
        }

    def test_forced_blind_is_not_vpip(self):
        """Posting a blind and folding is not voluntarily playing a hand."""
        self.assertEqual(self.stats['Bob']['vpip'], 0.0)

    def test_raising_counts_as_vpip_and_pfr(self):
        self.assertEqual(self.stats['Alice']['vpip'], 50.0)
        self.assertEqual(self.stats['Alice']['pfr'], 50.0)

    def test_wins_without_showdown(self):
        self.assertEqual(self.stats['Alice']['won_without_showdown'], 2)
        self.assertEqual(self.stats['Alice']['showdowns'], 0)

    def test_aggression_factor_without_calls(self):
        """No calls at all leaves the ratio undefined rather than infinite."""
        self.assertIsNone(self.stats['Alice']['aggression_factor'])


class TestHeroDetection(unittest.TestCase):
    """"Your hand is ..." identifies whoever exported the log."""

    def test_hero_is_identified_and_backfilled(self):
        game = pokernow.PokerNowLogParser().parse(build_log([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            'Your hand is A♠, K♠',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" calls 0.10',
            f'"{P2}" checks',
            'Flop:  [2♣, 7♦, K♥]',
            f'"{P1}" checks',
            f'"{P2}" checks',
            'Turn: 2♣, 7♦, K♥ [3♠]',
            f'"{P1}" checks',
            f'"{P2}" checks',
            'River: 2♣, 7♦, K♥, 3♠ [9♣]',
            f'"{P1}" checks',
            f'"{P2}" checks',
            f'"{P1}" shows a A♠, K♠.',
            f'"{P2}" shows a Q♥, Q♦.',
            f'"{P1}" collected 0.20 from pot with Pair, K\'s',
            '-- ending hand #1 --',
            # Hand 2: the hero wins with 7-2 and never shows it.
            f'-- starting hand #2 (id: h2)  No Limit Texas Hold\'em (dealer: "{P2}") --',
            f'Player stacks: #1 "{P1}" (10.10) | #2 "{P2}" (9.90)',
            'Your hand is 7♠, 2♦',
            f'"{P2}" posts a small blind of 0.05',
            f'"{P1}" posts a big blind of 0.10',
            f'"{P2}" folds',
            f'Uncalled bet of 0.05 returned to "{P1}"',
            f'"{P1}" collected 0.10 from pot',
            '-- ending hand #2 --',
        ]))
        self.assertEqual(game.hero_seat, P1)
        self.assertEqual(game.players[P1].seven_two_wins, 1)


class TestLedger(unittest.TestCase):
    """The ledger export is authoritative for money when it is supplied."""

    LEDGER = (
        'player_nickname,player_id,session_start_at,session_end_at,'
        'buy_in,buy_out,stack,net\n'
        'Alice,aaa111,2026-08-21T01:00:00Z,2026-08-21T05:00:00Z,20,0,45.50,25.50\n'
        'Bob,bbb222,2026-08-21T01:00:00Z,2026-08-21T05:00:00Z,20,20,0,0\n'
        'Bob,bbb222,2026-08-21T01:00:00Z,2026-08-21T05:00:00Z,20,14.50,0,-5.50\n'
    )

    def test_rebuy_rows_are_merged(self):
        parsed = pokernow.parse_ledger(self.LEDGER)
        self.assertEqual(parsed['bbb222']['buy_in'], 40.0)
        self.assertEqual(parsed['bbb222']['buy_out'], 34.5)

    def test_detect_kind(self):
        self.assertEqual(pokernow.detect_kind(self.LEDGER), 'ledger')
        self.assertEqual(pokernow.detect_kind(build_log(['-- ending hand #1 --'])), 'log')

    def test_ledger_overrides_log_amounts(self):
        log = build_log([
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (10.00) | #2 "{P2}" (10.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" folds',
            f'Uncalled bet of 0.05 returned to "{P2}"',
            f'"{P2}" collected 0.10 from pot',
            '-- ending hand #1 --',
        ])
        result = pokernow.analyze(log, self.LEDGER)
        alice = next(p for p in result['players'] if p['name'] == 'Alice')
        self.assertEqual(alice['buy_in'], 20.0)
        self.assertEqual(alice['cash_out'], 45.5)
        self.assertTrue(result['has_ledger'])
        self.assertEqual(result['reconciliation']['source'], 'ledger')


class TestAnalyze(unittest.TestCase):
    """The top-level payload the import screen consumes."""

    def _simple_result(self):
        return pokernow.analyze(build_log([
            f'The player "{P1}" requested a seat.',
            f'The admin approved the player "{P1}" participation with a stack of 20.00.',
            f'The player "{P2}" requested a seat.',
            f'The admin approved the player "{P2}" participation with a stack of 20.00.',
            "The game's small blind was changed from 0.10 to 0.05.",
            "The game's big blind was changed from 0.20 to 0.10.",
            f'-- starting hand #1 (id: h1)  No Limit Texas Hold\'em (dealer: "{P1}") --',
            f'Player stacks: #1 "{P1}" (20.00) | #2 "{P2}" (20.00)',
            f'"{P1}" posts a small blind of 0.05',
            f'"{P2}" posts a big blind of 0.10',
            f'"{P1}" raises to 5.00',
            f'"{P2}" calls 5.00',
            'Flop:  [2♣, 7♦, K♥]',
            f'"{P1}" bets 5.00',
            f'"{P2}" folds',
            f'Uncalled bet of 5.00 returned to "{P1}"',
            f'"{P1}" collected 10.00 from pot',
            '-- ending hand #1 --',
        ]))

    def test_summary_and_blinds(self):
        result = self._simple_result()
        self.assertEqual(result['summary']['hands_played'], 1)
        self.assertEqual(result['summary']['big_blind'], 0.10)
        self.assertEqual(result['summary']['biggest_pot'], 10.00)

    def test_buy_ins_come_from_approvals(self):
        result = self._simple_result()
        self.assertEqual(result['reconciliation']['total_buy_in'], 40.0)
        for player in result['players']:
            self.assertEqual(player['buy_in'], 20.0)

    def test_suggested_buy_in_is_the_common_amount(self):
        self.assertEqual(self._simple_result()['suggested_buy_in'], 20.0)

    def test_players_sorted_by_net(self):
        players = self._simple_result()['players']
        self.assertEqual(players[0]['name'], 'Alice')

    def test_empty_log_is_not_fatal(self):
        result = pokernow.analyze('entry,at,order\n')
        self.assertEqual(result['players'], [])
        self.assertEqual(result['awards'], [])

    def test_local_date_shifts_from_utc(self):
        """A late game stamped after UTC midnight belongs to the night before."""
        self.assertEqual(
            pokernow.local_date_for('2026-08-21T02:30:00.000Z', -5), '2026-08-20'
        )
        self.assertEqual(
            pokernow.local_date_for('2026-08-21T02:30:00.000Z', 0), '2026-08-21'
        )


class TestAwards(unittest.TestCase):
    """Superlatives are picked from the per-player statistics."""

    def _players(self, *rows):
        base = {
            'seat': '', 'name': '', 'pokernow_id': '', 'hands_dealt': 50,
            'hands_won': 0, 'vpip': 50.0, 'pfr': 10.0, 'aggression_factor': 1.0,
            'bets': 0, 'raises': 0, 'calls': 0, 'checks': 0, 'folds': 0,
            'all_ins': 0, 'showdowns': 0, 'showdowns_won': 0,
            'showdown_win_rate': 0.0, 'went_to_showdown_pct': 0.0,
            'won_without_showdown': 0, 'seven_two_wins': 0, 'biggest_pot': None,
            'best_showdown': None, 'worst_hand_loss': None,
        }
        return [{**base, **row, 'seat': f"{row['name']} @ x"} for row in rows]

    def test_most_aggressive_and_rock(self):
        awards = pokernow.build_awards(self._players(
            {'name': 'Alice', 'aggression_factor': 3.0, 'bets': 30, 'raises': 30,
             'calls': 20, 'vpip': 70.0},
            {'name': 'Bob', 'aggression_factor': 0.2, 'bets': 2, 'raises': 2,
             'calls': 20, 'vpip': 15.0, 'folds': 40},
        ), [])
        by_key = {a['key']: a for a in awards}
        self.assertEqual(by_key['most_aggressive']['name'], 'Alice')
        self.assertEqual(by_key['the_rock']['name'], 'Bob')
        self.assertEqual(by_key['loosest_cannon']['name'], 'Alice')

    def test_rate_awards_ignore_short_cameos(self):
        """A player who saw three hands cannot take a rate-based award."""
        awards = pokernow.build_awards(self._players(
            {'name': 'Regular', 'hands_dealt': 100, 'vpip': 40.0, 'calls': 10},
            {'name': 'Cameo', 'hands_dealt': 3, 'vpip': 0.0, 'calls': 1},
        ), [])
        rock = next(a for a in awards if a['key'] == 'the_rock')
        self.assertEqual(rock['name'], 'Regular')

    def test_calling_station_not_also_most_aggressive(self):
        """One player should not hold both ends of the same axis."""
        awards = pokernow.build_awards(self._players(
            {'name': 'Solo', 'aggression_factor': 2.0, 'bets': 10, 'raises': 10,
             'calls': 10},
        ), [])
        self.assertNotIn('calling_station', {a['key'] for a in awards})

    def test_no_players_no_awards(self):
        self.assertEqual(pokernow.build_awards([], []), [])


if __name__ == '__main__':
    unittest.main()
