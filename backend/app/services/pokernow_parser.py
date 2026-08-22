"""
Parser for PokerNow (pokernow.club) exported game logs.

PokerNow hands out two CSV exports per game:

* the **log** — one row per event (``entry``, ``at``, ``order``), newest first.
  Everything that happened at the table is in here as English prose, so the
  money has to be reconstructed from the action.
* the **ledger** — one row per player (``player_nickname``, ``player_id``,
  ``buy_in``, ``buy_out``, ``stack``, ``net``). Authoritative for money, but
  says nothing about how the chips moved.

This module parses either one. The log gives us the hand-by-hand detail the
awards are built from; when a ledger is supplied too, its numbers win for
buy-in/cash-out because they are the site's own accounting.

Nothing here touches the database or Flask — :mod:`backend.app.routes.imports`
turns a :class:`ParsedGame` into sessions, entries, and stored stats.

Action amounts in a PokerNow log are *street totals*, not increments: a big
blind who posts ``0.10`` and then ``calls 0.22`` has put ``0.22`` into that
street, not ``0.32``. Contributions are therefore tracked as a running max per
street rather than a sum.
"""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# --- Log grammar -------------------------------------------------------------
# Players appear as `"nickname @ pokernowId"`. The nickname may contain spaces
# and even '@', so the id (which never does) anchors the split.
_SEAT = r'"(?P<who>[^"]+)"'
_NUM = r'(?P<amt>-?[\d,]+(?:\.\d+)?)'

RE_HAND_START = re.compile(
    r'^-- starting hand #(?P<num>\d+)\s*(?:\(id: (?P<hid>[^)]*)\))?\s*(?P<game>.*?)'
    r'(?:\(dealer: "(?P<dealer>[^"]*)"\))?\s*--\s*$'
)
RE_HAND_END = re.compile(r'^-- ending hand #(?P<num>\d+) --')
RE_STACKS = re.compile(r'^Player stacks: (?P<rest>.+)$')
RE_STACK_ENTRY = re.compile(r'#(?P<seat>\d+) "(?P<who>[^"]+)" \((?P<amt>[\d,]+(?:\.\d+)?)\)')

RE_POST_BLIND = re.compile(rf'^{_SEAT} posts a (?P<kind>small|big) blind of {_NUM}')
# A player returning from the blinds posts a *live* big blind plus a *dead*
# small blind: the big one counts toward the street total, the small one is
# pure dead money on top of it.
RE_POST_MISSED = re.compile(
    rf'^{_SEAT} posts a (?:missing|missed) (?P<kind>small|big) blind of {_NUM}'
)
RE_POST_STRADDLE = re.compile(rf'^{_SEAT} posts a straddle of {_NUM}')
RE_ANTE = re.compile(rf'^{_SEAT} posts an ante of {_NUM}')
RE_BET = re.compile(rf'^{_SEAT} bets {_NUM}(?P<allin> and go all in)?')
RE_RAISE = re.compile(rf'^{_SEAT} raises to {_NUM}(?P<allin> and go all in)?')
RE_CALL = re.compile(rf'^{_SEAT} calls {_NUM}(?P<allin> and go all in)?')
RE_CHECK = re.compile(rf'^{_SEAT} checks')
RE_FOLD = re.compile(rf'^{_SEAT} folds')
RE_UNCALLED = re.compile(rf'^Uncalled bet of {_NUM} returned to {_SEAT}')
RE_COLLECT = re.compile(
    rf'^{_SEAT} collected {_NUM} from pot'
    r'(?: with (?P<desc>.+?)(?:\s*\(combination: (?P<combo>[^)]*)\))?)?\s*$'
)
RE_SHOWS = re.compile(rf'^{_SEAT} shows a (?P<cards>[^.]+)\.')
RE_HERO_CARDS = re.compile(r'^Your hand is (?P<cards>.+)$')

# "Flop:  [K♦, Q♠, A♠]", "Turn: K♦, Q♠, A♠ [8♠]", and their
# "(second run)" twins when the table runs it twice.
RE_STREET = re.compile(
    r'^(?P<street>Flop|Turn|River)(?P<run>\s*\((?:second|third) run\))?:'
    r'\s*[^\[]*\[(?P<cards>[^\]]*)\]'
)

RE_JOINED = re.compile(rf'^The player {_SEAT} joined the game with a stack of {_NUM}\.')
RE_QUIT = re.compile(rf'^The player {_SEAT} quits the game with a stack of {_NUM}\.')
RE_STAND_UP = re.compile(rf'^The player {_SEAT} stand up with the stack of {_NUM}\.')
RE_SIT_BACK = re.compile(rf'^The player {_SEAT} sit back with the stack of {_NUM}\.')
RE_APPROVED = re.compile(
    rf'^The admin approved the player {_SEAT} participation with a stack of {_NUM}\.'
)
RE_ADMIN_STACK = re.compile(
    rf'^The admin updated the player {_SEAT} stack from (?P<old>[\d,]+(?:\.\d+)?)'
    rf' to (?P<new>[\d,]+(?:\.\d+)?)\.'
)

RE_BLIND_CHANGE = re.compile(
    r"^The game's (?P<kind>small|big) blind was changed from [\d.]+ to {0}".format(_NUM)
)

# Showdown descriptions, weakest to strongest. Matched as a prefix of the
# "collected ... with <desc>" text so "Pair, 7's" and "Pair, K's" both land on
# "Pair". Order matters: check longer names before the ones they contain.
_HAND_RANKS: Tuple[Tuple[str, int], ...] = (
    ('Royal Flush', 10),
    ('Straight Flush', 9),
    ('Four of a Kind', 8),
    ('Full House', 7),
    ('Flush', 6),
    ('Straight', 5),
    ('Three of a Kind', 4),
    ('Two Pair', 3),
    ('Pair', 2),
    ('High Card', 1),
)

_STREETS = ('preflop', 'flop', 'turn', 'river')


def _money(text: Optional[str]) -> float:
    """Parse a PokerNow amount ("1,234.56") into a float; 0.0 when absent."""
    if not text:
        return 0.0
    try:
        return float(str(text).replace(',', ''))
    except ValueError:
        return 0.0


def _round(value: float) -> float:
    """Round to cents, killing the float noise that accumulates over 200 hands."""
    return round(value + 0.0, 2)


def split_seat(seat: str) -> Tuple[str, str]:
    """
    Split a PokerNow seat label into (nickname, pokernow_id).

    Nicknames may contain spaces and '@'; the id never does, so the last '@'
    is the separator. Labels without an id fall back to (label, '').
    """
    if ' @ ' in seat:
        name, _, pid = seat.rpartition(' @ ')
        return name.strip(), pid.strip()
    return seat.strip(), ''


def rank_of_hand(description: Optional[str]) -> Tuple[int, str]:
    """Map a showdown description to (rank, canonical name); (0, '') if unknown."""
    if not description:
        return 0, ''
    text = description.strip()
    for name, rank in _HAND_RANKS:
        if text.startswith(name):
            return rank, name
    return 0, ''


def _cards_to_list(text: str) -> List[str]:
    """Split "7♦, 2♠" into ['7♦', '2♠']."""
    return [c.strip() for c in re.split(r'[,\s]+', text or '') if c.strip()]


def is_seven_deuce(cards: List[str]) -> bool:
    """True when a two-card holding is 7-2 (the classic worst starting hand)."""
    if len(cards) != 2:
        return False
    ranks = {re.sub(r'[^0-9AKQJT]', '', c.upper()) for c in cards}
    return ranks == {'7', '2'}


@dataclass
class Action:
    """One voluntary or forced action inside a hand."""
    player: str          # seat label, "nick @ id"
    street: str
    kind: str            # post_blind | post_dead | straddle | ante | bet | raise | call | check | fold
    amount: float = 0.0
    all_in: bool = False


@dataclass
class Hand:
    """One hand of poker reconstructed from its log entries."""
    number: int
    hand_id: str = ''
    dealer: str = ''
    started_at: Optional[str] = None
    seats: Dict[str, float] = field(default_factory=dict)      # seat -> starting stack
    actions: List[Action] = field(default_factory=list)
    contributed: Dict[str, float] = field(default_factory=dict)
    collected: Dict[str, float] = field(default_factory=dict)
    shown: Dict[str, List[str]] = field(default_factory=dict)  # seat -> hole cards
    hero_cards: List[str] = field(default_factory=list)
    board: List[str] = field(default_factory=list)
    winners: List[Dict[str, Any]] = field(default_factory=list)
    run_it_twice: bool = False
    street_reached: str = 'preflop'
    went_to_showdown: bool = False
    complete: bool = True

    @property
    def pot(self) -> float:
        return _round(sum(self.contributed.values()))

    def net_for(self, seat: str) -> float:
        return _round(self.collected.get(seat, 0.0) - self.contributed.get(seat, 0.0))


@dataclass
class PlayerTally:
    """Running per-player counters; converted to a stats dict at the end."""
    seat: str
    name: str
    pokernow_id: str = ''

    hands_dealt: int = 0
    vpip: int = 0
    pfr: int = 0
    bets: int = 0
    raises: int = 0
    calls: int = 0
    checks: int = 0
    folds: int = 0
    all_ins: int = 0

    invested: float = 0.0
    collected: float = 0.0
    admin_adjustment: float = 0.0

    pots_won: int = 0
    showdowns: int = 0
    showdowns_won: int = 0
    won_without_showdown: int = 0
    seven_two_wins: int = 0

    biggest_pot: Optional[Dict[str, Any]] = None
    worst_hand_loss: Optional[Dict[str, Any]] = None
    best_showdown: Optional[Dict[str, Any]] = None

    buy_ins: List[float] = field(default_factory=list)
    final_stack: float = 0.0
    stack_known: bool = False
    ledger_buy_in: Optional[float] = None
    ledger_buy_out: Optional[float] = None


@dataclass
class ParsedGame:
    """Everything the importer needs from one PokerNow export."""
    hands: List[Hand] = field(default_factory=list)
    hero_seat: Optional[str] = None
    players: Dict[str, PlayerTally] = field(default_factory=dict)
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    small_blind: Optional[float] = None
    big_blind: Optional[float] = None
    warnings: List[str] = field(default_factory=list)
    has_ledger: bool = False


class PokerNowLogParser:
    """
    Walks a PokerNow log in chronological order and rebuilds each hand.

    The log ships newest-event-first; the ``order`` column is a monotonic
    sequence number, so sorting on it (not on ``at``, which repeats within a
    hand) is what puts events back in the order they happened.
    """

    def __init__(self) -> None:
        self.game = ParsedGame()
        self._hand: Optional[Hand] = None
        self._street = 'preflop'
        self._street_max: Dict[str, float] = {}
        self._acted_voluntarily: Dict[str, bool] = {}
        self._folded: set = set()

    # -- public -------------------------------------------------------------

    def parse(self, text: str) -> ParsedGame:
        rows = _read_rows(text)
        if not rows:
            self.game.warnings.append('The log file contained no readable rows.')
            return self.game

        timestamps = [r['at'] for r in rows if r.get('at')]
        if timestamps:
            self.game.started_at = timestamps[0]
            self.game.ended_at = timestamps[-1]

        for row in rows:
            self._handle(row['entry'], row.get('at'))

        # A log can be exported mid-hand; close whatever is still open.
        self._close_hand()
        self._finalize()
        return self.game

    # -- event dispatch -----------------------------------------------------

    def _handle(self, entry: str, at: Optional[str]) -> None:
        # Multi-line entries (the "Game Config Changes" block) only ever carry
        # meaning on their first line.
        line = entry.split('\n', 1)[0].strip()

        start = RE_HAND_START.match(line)
        if start:
            self._close_hand()
            self._open_hand(start, at)
            return

        if RE_HAND_END.match(line):
            self._close_hand()
            return

        # Table-level bookkeeping happens between hands as well as inside them.
        if self._handle_table_event(line):
            return

        if self._hand is None:
            return

        self._handle_hand_event(line)

    def _open_hand(self, match: 're.Match[str]', at: Optional[str]) -> None:
        self._hand = Hand(
            number=int(match.group('num')),
            hand_id=(match.group('hid') or '').strip(),
            dealer=(match.group('dealer') or '').strip(),
            started_at=at,
        )
        self._street = 'preflop'
        self._street_max = {}
        self._acted_voluntarily = {}
        self._folded = set()

    def _handle_table_event(self, line: str) -> bool:
        """Seat, stack, and blind changes. Returns True when the line was consumed."""
        blind = RE_BLIND_CHANGE.match(line)
        if blind:
            amount = _money(blind.group('amt'))
            if blind.group('kind') == 'small':
                self.game.small_blind = amount
            else:
                self.game.big_blind = amount
            return True

        approved = RE_APPROVED.match(line)
        if approved:
            # Approving a seat request is where chips enter the table: this is
            # the one event that reliably marks a buy-in or rebuy.
            tally = self._tally(approved.group('who'))
            tally.buy_ins.append(_money(approved.group('amt')))
            return True

        admin = RE_ADMIN_STACK.match(line)
        if admin:
            tally = self._tally(admin.group('who'))
            delta = _money(admin.group('new')) - _money(admin.group('old'))
            tally.admin_adjustment = _round(tally.admin_adjustment + delta)
            self._set_stack(tally, _money(admin.group('new')))
            return True

        for pattern in (RE_JOINED, RE_STAND_UP, RE_SIT_BACK):
            seen = pattern.match(line)
            if seen:
                self._set_stack(self._tally(seen.group('who')), _money(seen.group('amt')))
                return True

        quit_match = RE_QUIT.match(line)
        if quit_match:
            amount = _money(quit_match.group('amt'))
            tally = self._tally(quit_match.group('who'))
            # A player who stands up before leaving quits "with a stack of
            # 0.00" — their chips already left the seat, so that zero would
            # wipe out a stack we already know about.
            if amount > 0 or not tally.stack_known:
                self._set_stack(tally, amount)
            return True

        return False

    @staticmethod
    def _set_stack(tally: PlayerTally, amount: float) -> None:
        tally.final_stack = _round(amount)
        tally.stack_known = True

    def _handle_hand_event(self, line: str) -> None:
        hand = self._hand
        assert hand is not None

        stacks = RE_STACKS.match(line)
        if stacks:
            for seat_match in RE_STACK_ENTRY.finditer(stacks.group('rest')):
                seat = seat_match.group('who')
                amount = _money(seat_match.group('amt'))
                hand.seats[seat] = amount
                self._set_stack(self._tally(seat), amount)
            return

        street = RE_STREET.match(line)
        if street:
            if street.group('run'):
                hand.run_it_twice = True
                return  # second-run board does not advance the street
            self._flush_street()
            self._street = street.group('street').lower()
            hand.street_reached = self._street
            hand.board.extend(_cards_to_list(street.group('cards')))
            return

        if self._handle_wager(line):
            return

        if RE_CHECK.match(line):
            seat = RE_CHECK.match(line).group('who')
            hand.actions.append(Action(seat, self._street, 'check'))
            return

        fold = RE_FOLD.match(line)
        if fold:
            hand.actions.append(Action(fold.group('who'), self._street, 'fold'))
            self._folded.add(fold.group('who'))
            return

        uncalled = RE_UNCALLED.match(line)
        if uncalled:
            seat, amount = uncalled.group('who'), _money(uncalled.group('amt'))
            if seat in self._street_max:
                self._street_max[seat] = _round(self._street_max[seat] - amount)
            else:
                hand.contributed[seat] = _round(hand.contributed.get(seat, 0.0) - amount)
            return

        collected = RE_COLLECT.match(line)
        if collected:
            seat = collected.group('who')
            amount = _money(collected.group('amt'))
            hand.collected[seat] = _round(hand.collected.get(seat, 0.0) + amount)
            hand.winners.append({
                'seat': seat,
                'amount': amount,
                'description': (collected.group('desc') or '').strip(),
                'combination': (collected.group('combo') or '').strip(),
            })
            return

        hero = RE_HERO_CARDS.match(line)
        if hero:
            hand.hero_cards = _cards_to_list(hero.group('cards'))
            return

        shows = RE_SHOWS.match(line)
        if shows:
            hand.shown[shows.group('who')] = _cards_to_list(shows.group('cards'))
            hand.went_to_showdown = True
            return

        if 'run it twice' in line:
            hand.run_it_twice = True

    def _handle_wager(self, line: str) -> bool:
        """Money-in-the-pot actions. Returns True when the line was consumed."""
        hand = self._hand
        assert hand is not None

        for pattern, kind, voluntary in (
            (RE_RAISE, 'raise', True),
            (RE_BET, 'bet', True),
            (RE_CALL, 'call', True),
            (RE_POST_BLIND, 'post_blind', False),
            (RE_POST_STRADDLE, 'straddle', True),
        ):
            match = pattern.match(line)
            if not match:
                continue
            seat = match.group('who')
            amount = _money(match.group('amt'))
            all_in = bool(match.groupdict().get('allin'))
            # Street totals, not increments — see the module docstring.
            self._street_max[seat] = max(self._street_max.get(seat, 0.0), amount)
            hand.actions.append(Action(seat, self._street, kind, amount, all_in))
            if voluntary and self._street == 'preflop':
                self._acted_voluntarily[seat] = True
            return True

        missed = RE_POST_MISSED.match(line)
        if missed and missed.group('kind') == 'big':
            seat = missed.group('who')
            amount = _money(missed.group('amt'))
            self._street_max[seat] = max(self._street_max.get(seat, 0.0), amount)
            hand.actions.append(Action(seat, self._street, 'post_blind', amount))
            return True

        for pattern, kind in ((RE_POST_MISSED, 'post_dead'), (RE_ANTE, 'ante')):
            match = pattern.match(line)
            if not match:
                continue
            seat = match.group('who')
            amount = _money(match.group('amt'))
            # Dead money sits outside the street total and is purely additive.
            hand.contributed[seat] = _round(hand.contributed.get(seat, 0.0) + amount)
            hand.actions.append(Action(seat, self._street, kind, amount))
            return True

        return False

    # -- hand lifecycle -----------------------------------------------------

    def _flush_street(self) -> None:
        """Fold the current street's per-player totals into the hand total."""
        if not self._hand:
            return
        for seat, amount in self._street_max.items():
            self._hand.contributed[seat] = _round(
                self._hand.contributed.get(seat, 0.0) + amount
            )
        self._street_max = {}

    def _close_hand(self) -> None:
        if self._hand is None:
            return
        self._flush_street()
        hand = self._hand
        self._hand = None

        # A lone player showing off after everyone folded is not a showdown;
        # it takes two hands face-up.
        hand.went_to_showdown = len(hand.shown) >= 2

        pot = hand.pot
        paid = _round(sum(hand.collected.values()))
        # A log exported mid-hand ends with a hand nobody ever won.
        hand.complete = bool(hand.collected)
        if hand.complete and hand.seats and abs(pot - paid) > 0.02:
            self.game.warnings.append(
                f'Hand #{hand.number}: pot {pot:.2f} does not match '
                f'{paid:.2f} collected — its numbers may be off.'
            )

        self.game.hands.append(hand)
        self._accumulate(hand)

    def _accumulate(self, hand: Hand) -> None:
        voluntary = self._acted_voluntarily
        raised_preflop = {
            a.player for a in hand.actions
            if a.street == 'preflop' and a.kind in ('raise', 'straddle')
        }
        winners = set(hand.collected)

        for seat in hand.seats:
            tally = self._tally(seat)
            tally.hands_dealt += 1
            if voluntary.get(seat):
                tally.vpip += 1
            if seat in raised_preflop:
                tally.pfr += 1

        for action in hand.actions:
            tally = self._tally(action.player)
            if action.kind == 'bet':
                tally.bets += 1
            elif action.kind == 'raise':
                tally.raises += 1
            elif action.kind == 'call':
                tally.calls += 1
            elif action.kind == 'check':
                tally.checks += 1
            elif action.kind == 'fold':
                tally.folds += 1
            if action.all_in:
                tally.all_ins += 1

        for seat, amount in hand.contributed.items():
            tally = self._tally(seat)
            tally.invested = _round(tally.invested + amount)

        for seat, amount in hand.collected.items():
            tally = self._tally(seat)
            tally.collected = _round(tally.collected + amount)
            tally.pots_won += 1

        for seat in hand.seats:
            tally = self._tally(seat)
            self._set_stack(tally, tally.final_stack + hand.net_for(seat))

        if hand.went_to_showdown:
            for seat in hand.shown:
                tally = self._tally(seat)
                tally.showdowns += 1
                if seat in winners:
                    tally.showdowns_won += 1
        else:
            for seat in winners:
                # Everyone folded — chips won without ever showing a card.
                if len(hand.shown) < 2:
                    self._tally(seat).won_without_showdown += 1

        for winner in hand.winners:
            tally = self._tally(winner['seat'])
            net = hand.net_for(winner['seat'])
            if tally.biggest_pot is None or winner['amount'] > tally.biggest_pot['amount']:
                tally.biggest_pot = {
                    'amount': winner['amount'],
                    'net': net,
                    'hand_number': hand.number,
                    'description': winner['description'],
                    'combination': winner['combination'],
                    'hole_cards': hand.shown.get(winner['seat'], []),
                    'board': list(hand.board),
                    'pot': hand.pot,
                }
            rank, rank_name = rank_of_hand(winner['description'])
            if rank and (tally.best_showdown is None or rank > tally.best_showdown['rank']):
                tally.best_showdown = {
                    'rank': rank,
                    'rank_name': rank_name,
                    'description': winner['description'],
                    'combination': winner['combination'],
                    'hand_number': hand.number,
                    'amount': winner['amount'],
                }
            if is_seven_deuce(hand.shown.get(winner['seat'], [])):
                tally.seven_two_wins += 1

        for seat in hand.seats:
            net = hand.net_for(seat)
            tally = self._tally(seat)
            if net < 0 and (
                tally.worst_hand_loss is None or net < tally.worst_hand_loss['net']
            ):
                tally.worst_hand_loss = {
                    'net': net,
                    'hand_number': hand.number,
                    'pot': hand.pot,
                    'hole_cards': hand.shown.get(seat, []),
                }

    def _tally(self, seat: str) -> PlayerTally:
        tally = self.game.players.get(seat)
        if tally is None:
            name, pokernow_id = split_seat(seat)
            tally = PlayerTally(seat=seat, name=name, pokernow_id=pokernow_id)
            self.game.players[seat] = tally
        return tally

    def _identify_hero(self) -> None:
        """
        Work out which seat exported the log.

        Every hand carries "Your hand is ..." for whoever downloaded it. The
        hero is the seat whose showdowns always match those cards; any seat
        that ever shows something different is ruled out.
        """
        matches: Dict[str, int] = defaultdict(int)
        ruled_out: set = set()
        for hand in self.game.hands:
            if not hand.hero_cards:
                continue
            for seat, cards in hand.shown.items():
                if sorted(cards) == sorted(hand.hero_cards):
                    matches[seat] += 1
                else:
                    ruled_out.add(seat)

        candidates = {s: n for s, n in matches.items() if s not in ruled_out}
        if len(candidates) == 1:
            self.game.hero_seat = next(iter(candidates))
        elif candidates:
            self.game.hero_seat = max(candidates.items(), key=lambda kv: kv[1])[0]

        if not self.game.hero_seat:
            return

        # Backfill the hero's hole cards everywhere so their 7-2 wins and
        # bluffs count even on the hands they mucked.
        hero = self.game.hero_seat
        extra_seven_two = 0
        for hand in self.game.hands:
            if hand.hero_cards and hero not in hand.shown:
                hand.shown.setdefault(hero, list(hand.hero_cards))
                if hero in hand.collected and is_seven_deuce(hand.hero_cards):
                    extra_seven_two += 1
        tally = self.game.players.get(hero)
        if tally is not None:
            tally.seven_two_wins += extra_seven_two

    def _finalize(self) -> None:
        """Fill in blinds from the last hand when the log never logged a change."""
        self._identify_hero()
        if self.game.big_blind is None:
            for hand in self.game.hands:
                for action in hand.actions:
                    if action.kind == 'post_blind':
                        self.game.big_blind = max(
                            self.game.big_blind or 0.0, action.amount
                        )
        if self.game.small_blind is None and self.game.big_blind:
            self.game.small_blind = _round(self.game.big_blind / 2)


def _read_rows(text: str) -> List[Dict[str, str]]:
    """
    Read a PokerNow log CSV into chronological order.

    The export is newest-first and the ``at`` timestamps repeat within a hand,
    so the monotonic ``order`` column is what we sort on. Logs missing that
    column fall back to reversing the file.
    """
    reader = csv.DictReader(io.StringIO(text.lstrip('﻿')))
    rows = [r for r in reader if r.get('entry')]
    if not rows:
        return []

    if all(str(r.get('order') or '').strip().isdigit() for r in rows):
        rows.sort(key=lambda r: int(r['order']))
    else:
        rows.reverse()
    return rows


def _looks_like_ledger(text: str) -> bool:
    header = text.lstrip('﻿').split('\n', 1)[0].lower()
    return 'player_nickname' in header or ('buy_in' in header and 'net' in header)


def parse_ledger(text: str) -> Dict[str, Dict[str, Any]]:
    """
    Parse a PokerNow ledger CSV into ``{pokernow_id: {...}}``.

    A player who rebuys gets several ledger rows, so rows are merged by id
    (falling back to the nickname when the export omits ids). Buy-ins add up;
    the final stack is the one from the last row.
    """
    reader = csv.DictReader(io.StringIO(text.lstrip('﻿')))
    merged: Dict[str, Dict[str, Any]] = {}

    for row in reader:
        name = (row.get('player_nickname') or '').strip()
        pokernow_id = (row.get('player_id') or '').strip()
        if not name and not pokernow_id:
            continue
        key = pokernow_id or name
        record = merged.setdefault(key, {
            'name': name,
            'pokernow_id': pokernow_id,
            'buy_in': 0.0,
            'buy_out': 0.0,
            'stack': 0.0,
            'net': 0.0,
        })
        record['name'] = name or record['name']
        record['buy_in'] = _round(record['buy_in'] + _money(row.get('buy_in')))
        record['buy_out'] = _round(record['buy_out'] + _money(row.get('buy_out')))
        record['stack'] = _money(row.get('stack'))
        record['net'] = _round(record['net'] + _money(row.get('net')))

    return merged


def _aggression_factor(tally: PlayerTally) -> Optional[float]:
    """(bets + raises) / calls — poker's standard aggression measure."""
    if tally.calls == 0:
        return None if (tally.bets + tally.raises) == 0 else float('inf')
    return round((tally.bets + tally.raises) / tally.calls, 2)


def _pct(part: int, whole: int) -> float:
    return round(100.0 * part / whole, 1) if whole else 0.0


def _player_stats(tally: PlayerTally) -> Dict[str, Any]:
    """Flatten one player's tally into the JSON the API and UI consume."""
    aggression = _aggression_factor(tally)
    hands_won = tally.pots_won
    return {
        'seat': tally.seat,
        'name': tally.name,
        'pokernow_id': tally.pokernow_id,
        'hands_dealt': tally.hands_dealt,
        'hands_won': hands_won,
        'win_rate': _pct(hands_won, tally.hands_dealt),
        'vpip': _pct(tally.vpip, tally.hands_dealt),
        'pfr': _pct(tally.pfr, tally.hands_dealt),
        'aggression_factor': None if aggression == float('inf') else aggression,
        'bets': tally.bets,
        'raises': tally.raises,
        'calls': tally.calls,
        'checks': tally.checks,
        'folds': tally.folds,
        'all_ins': tally.all_ins,
        'showdowns': tally.showdowns,
        'showdowns_won': tally.showdowns_won,
        'showdown_win_rate': _pct(tally.showdowns_won, tally.showdowns),
        'went_to_showdown_pct': _pct(tally.showdowns, tally.hands_dealt),
        'won_without_showdown': tally.won_without_showdown,
        'seven_two_wins': tally.seven_two_wins,
        'total_invested': _round(tally.invested),
        'total_collected': _round(tally.collected),
        'net_from_hands': _round(tally.collected - tally.invested),
        'admin_adjustment': _round(tally.admin_adjustment),
        'biggest_pot': tally.biggest_pot,
        'best_showdown': tally.best_showdown,
        'worst_hand_loss': tally.worst_hand_loss,
        'buy_in': _round(tally.ledger_buy_in if tally.ledger_buy_in is not None
                         else sum(tally.buy_ins)),
        'cash_out': _round(tally.ledger_buy_out if tally.ledger_buy_out is not None
                           else tally.final_stack),
        'final_stack': _round(tally.final_stack),
        'buy_in_events': [_round(v) for v in tally.buy_ins],
    }


def _award(key: str, icon: str, title: str, stats: Dict[str, Any], detail: str,
           value: Any) -> Dict[str, Any]:
    return {
        'key': key,
        'icon': icon,
        'title': title,
        'seat': stats['seat'],
        'name': stats['name'],
        'pokernow_id': stats['pokernow_id'],
        'value': value,
        'detail': detail,
    }


def _best(candidates: List[Dict[str, Any]], key, reverse: bool = True
          ) -> Optional[Dict[str, Any]]:
    """Pick the single leader, or None when nobody qualifies."""
    ranked = [c for c in candidates if key(c) is not None]
    if not ranked:
        return None
    return sorted(ranked, key=key, reverse=reverse)[0]


def build_awards(players: List[Dict[str, Any]], hands: List[Hand],
                 min_hands: int = 10) -> List[Dict[str, Any]]:
    """
    Pick the fun superlatives.

    Rate-based awards (VPIP, aggression) only consider players who saw at
    least ``min_hands`` hands, so a three-hand cameo cannot take "The Rock".
    Counting awards have no such floor — a big pot is a big pot. When nobody
    clears the floor the pool falls back to everyone, which keeps short games
    from rendering an empty awards shelf.
    """
    if not players:
        return []

    rated = [p for p in players if p['hands_dealt'] >= min_hands] or players
    awards: List[Dict[str, Any]] = []

    aggressive = _best(rated, lambda p: p['aggression_factor'])
    if aggressive and (aggressive['aggression_factor'] or 0) > 0:
        awards.append(_award(
            'most_aggressive', '🔪', 'Most Aggressive', aggressive,
            f"{aggressive['bets'] + aggressive['raises']} bets & raises "
            f"against {aggressive['calls']} calls",
            aggressive['aggression_factor'],
        ))

    station = _best(rated, lambda p: p['calls'])
    if station and station['calls'] > 0 and (
        not aggressive or station['seat'] != aggressive['seat']
    ):
        awards.append(_award(
            'calling_station', '🎣', 'Calling Station', station,
            f"called {station['calls']} times across {station['hands_dealt']} hands",
            station['calls'],
        ))

    rock = _best(rated, lambda p: p['vpip'], reverse=False)
    if rock:
        awards.append(_award(
            'the_rock', '🪨', 'The Rock', rock,
            f"played only {rock['vpip']}% of hands — folded {rock['folds']} times",
            rock['vpip'],
        ))

    loose = _best(rated, lambda p: p['vpip'])
    if loose and rock and loose['seat'] != rock['seat']:
        awards.append(_award(
            'loosest_cannon', '🌊', 'Loosest Cannon', loose,
            f"put money in on {loose['vpip']}% of hands",
            loose['vpip'],
        ))

    bluffer = _best(players, lambda p: p['won_without_showdown'])
    if bluffer and bluffer['won_without_showdown'] > 0:
        awards.append(_award(
            'bluff_merchant', '🎭', 'Bluff Merchant', bluffer,
            f"took down {bluffer['won_without_showdown']} pots without showing a card",
            bluffer['won_without_showdown'],
        ))

    biggest = _best(players, lambda p: (p['biggest_pot'] or {}).get('amount'))
    if biggest and biggest['biggest_pot']:
        pot = biggest['biggest_pot']
        detail = f"${pot['amount']:,.2f} on hand #{pot['hand_number']}"
        if pot.get('description'):
            detail += f" with {pot['description']}"
        awards.append(_award(
            'biggest_pot', '💰', 'Biggest Pot Won', biggest, detail, pot['amount'],
        ))

    hand_maker = _best(players, lambda p: (p['best_showdown'] or {}).get('rank'))
    if hand_maker and hand_maker['best_showdown']:
        best = hand_maker['best_showdown']
        awards.append(_award(
            'best_hand', '🏆', 'Best Hand Made', hand_maker,
            f"{best['description']} on hand #{best['hand_number']}",
            best['rank_name'],
        ))

    shark = _best(
        [p for p in players if p['showdowns'] >= 3],
        lambda p: p['showdown_win_rate'],
    )
    if shark:
        awards.append(_award(
            'showdown_shark', '🦈', 'Showdown Shark', shark,
            f"won {shark['showdowns_won']} of {shark['showdowns']} showdowns",
            shark['showdown_win_rate'],
        ))

    maniac = _best(players, lambda p: p['all_ins'])
    if maniac and maniac['all_ins'] > 1:
        awards.append(_award(
            'all_in_maniac', '💥', 'All-In Maniac', maniac,
            f"shoved {maniac['all_ins']} times",
            maniac['all_ins'],
        ))

    seven_two = _best(players, lambda p: p['seven_two_wins'])
    if seven_two and seven_two['seven_two_wins'] > 0:
        awards.append(_award(
            'seven_two_club', '🃏', '7-2 Club', seven_two,
            f"won {seven_two['seven_two_wins']} hand"
            f"{'s' if seven_two['seven_two_wins'] != 1 else ''} holding 7-2",
            seven_two['seven_two_wins'],
        ))

    cooler = _best(players, lambda p: -(p['worst_hand_loss'] or {}).get('net', 0))
    if cooler and cooler['worst_hand_loss'] and cooler['worst_hand_loss']['net'] < 0:
        loss = cooler['worst_hand_loss']
        awards.append(_award(
            'worst_beat', '🩹', 'Worst Single Hand', cooler,
            f"dropped ${abs(loss['net']):,.2f} on hand #{loss['hand_number']}",
            loss['net'],
        ))

    return awards


def _game_summary(game: ParsedGame, players: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Table-level headline numbers."""
    played = [h for h in game.hands if h.complete]
    pots = [h.pot for h in played if h.pot > 0]
    biggest_hand = max(played, key=lambda h: h.pot, default=None)
    duration_minutes = None

    start, end = _parse_iso(game.started_at), _parse_iso(game.ended_at)
    if start and end and end > start:
        duration_minutes = int((end - start).total_seconds() // 60)

    summary: Dict[str, Any] = {
        'hands_played': len(played),
        'players': len(players),
        'total_pot': _round(sum(pots)),
        'average_pot': _round(sum(pots) / len(pots)) if pots else 0.0,
        'biggest_pot': _round(biggest_hand.pot) if biggest_hand else 0.0,
        'biggest_pot_hand': biggest_hand.number if biggest_hand else None,
        'showdowns': sum(1 for h in played if h.went_to_showdown),
        'run_it_twice_hands': sum(1 for h in played if h.run_it_twice),
        'small_blind': game.small_blind,
        'big_blind': game.big_blind,
        'started_at': game.started_at,
        'ended_at': game.ended_at,
        'duration_minutes': duration_minutes,
    }
    if biggest_hand and biggest_hand.winners:
        top = max(biggest_hand.winners, key=lambda w: w['amount'])
        summary['biggest_pot_winner'] = split_seat(top['seat'])[0]
        summary['biggest_pot_description'] = top['description']
    return summary


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None


def local_date_for(value: Optional[str], hours_offset: int = 0) -> Optional[str]:
    """
    Turn a log timestamp into the YYYY-MM-DD the app stores on a session.

    PokerNow stamps events in UTC, so a game that ran late into the evening
    reads as the following day. ``hours_offset`` shifts the clock back to the
    host's timezone before the date is taken.
    """
    parsed = _parse_iso(value)
    if not parsed:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    from datetime import timedelta
    return (parsed + timedelta(hours=hours_offset)).date().isoformat()


def analyze(log_text: Optional[str] = None, ledger_text: Optional[str] = None,
            tz_offset_hours: int = 0) -> Dict[str, Any]:
    """
    Parse one PokerNow export pair into the payload the import screen renders.

    Either file may be omitted. With only a ledger we can still produce the
    money side of an import (no awards); with only a log we produce everything
    but have to *infer* buy-ins, which is why the result carries a
    ``reconciliation`` block for the UI to make the user confirm.
    """
    game = ParsedGame()
    if log_text:
        game = PokerNowLogParser().parse(log_text)

    ledger: Dict[str, Dict[str, Any]] = {}
    if ledger_text:
        ledger = parse_ledger(ledger_text)
        game.has_ledger = bool(ledger)

    # Ledger rows key on the PokerNow id, which the log also carries, so the
    # two files join cleanly even when a nickname changed mid-game.
    by_id = {t.pokernow_id: t for t in game.players.values() if t.pokernow_id}
    for key, record in ledger.items():
        tally = by_id.get(record['pokernow_id']) or by_id.get(key)
        if tally is None:
            tally = PlayerTally(
                seat=f"{record['name']} @ {record['pokernow_id']}".strip(' @'),
                name=record['name'],
                pokernow_id=record['pokernow_id'],
            )
            game.players[tally.seat] = tally
        tally.ledger_buy_in = record['buy_in']
        tally.ledger_buy_out = record['buy_out'] or record['stack']

    players = [_player_stats(t) for t in game.players.values()]
    for stats in players:
        stats['net'] = _round(stats['cash_out'] - stats['buy_in'])
    players.sort(key=lambda p: (-p['net'], p['name'].lower()))

    total_buy_in = _round(sum(p['buy_in'] for p in players))
    total_cash_out = _round(sum(p['cash_out'] for p in players))

    return {
        'summary': _game_summary(game, players),
        'players': players,
        'awards': build_awards(players, game.hands),
        'reconciliation': {
            'total_buy_in': total_buy_in,
            'total_cash_out': total_cash_out,
            'difference': _round(total_cash_out - total_buy_in),
            'balanced': abs(total_cash_out - total_buy_in) < 0.01,
            'source': 'ledger' if game.has_ledger else 'log',
        },
        'suggested_date': local_date_for(game.started_at, tz_offset_hours),
        'suggested_buy_in': _suggest_buy_in(players),
        'has_ledger': game.has_ledger,
        'warnings': game.warnings[:20],
        'warning_count': len(game.warnings),
    }


def _suggest_buy_in(players: List[Dict[str, Any]]) -> float:
    """
    Guess the table's standard buy-in from the individual buy-in events.

    Home games run on a single number, so the most common single buy-in wins;
    ties break toward the larger amount.
    """
    counts: Dict[float, int] = defaultdict(int)
    for player in players:
        for amount in player['buy_in_events']:
            if amount > 0:
                counts[amount] += 1
    if not counts:
        return 20.0
    return max(counts.items(), key=lambda kv: (kv[1], kv[0]))[0]


def detect_kind(text: str) -> str:
    """Return 'ledger' or 'log' for an uploaded PokerNow CSV."""
    return 'ledger' if _looks_like_ledger(text) else 'log'
