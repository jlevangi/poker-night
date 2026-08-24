# Plan — Improve Gamble King's Public Frontend

> **Provenance.** This plan was (re)created in the continuation worktree
> `2026-08-22-improve-gamble-king-s-public-b73bdb-2`. It is untracked
> orchestration state (not app source). Earlier iterations' completed work is
> not re-listed here (fresh worktree, prior handoffs not carried over) — this
> file tracks the session-card step landed this iteration plus the known
> follow-ups. See `handoff.md` for iteration detail.

## Objective
Make the public SPA faster and easier to scan. Frontend-only where possible.
Two-stylesheet contract (both linked from `templates/index.html`):
`static/css/styles/main.css` (which `@import`s the component partials) +
`static/css/dark-mode.css`. **All** new/changed styling belongs in
`styles/main.css` via the component partials — never a standalone stylesheet.

## Global constraints
- Frontend-only. Do **not** change the backend unless a frontend *defect* makes
  it strictly necessary (a richer card is a feature, not a defect).
- Never `write` an existing repo file wholesale — exact string replacement only.
- Gate before handoff: `python3 -m compileall -q backend && python3 scripts/check-css.py`.
- Reuse existing design tokens / `neo-*` primitives. Dark mode + tabular-nums
  via tokens, no custom fonts.

## Steps

- [x] **Session cards (sessions-page): denser, scannable layout — money front and center.**  _(Done, iter 7)_
  - Replaced the two hand-rolled per-session `<a>` blocks (Active list + All list)
    with one shared `_renderSessionCard()` method → consistent markup, DRY.
  - New single-row card. Left meta: compact date + status pill (gold=ACTIVE,
    muted=ENDED) + per-player buy-in. Right: headline = session `total_value`
    (total money at the table), large tabular number; gold for ACTIVE.
  - CSS added to `components/_lists.css` (`.session-card*`), tokens only.
  - Empty / loading / error states unchanged (still owned by `load()`).

- [ ] **Session card: "who's playing" roster + net P/L.**  _(Deferred — needs a deliberate backend decision)_
  - `/api/sessions` (→ `Session.to_dict()`) returns only session-level fields:
    `total_value` = `sum(entry.total_buy_in_amount)`. It includes **no** player
    roster, **no** per-player P/L, and **no** net session P/L.
  - The data exists downstream: `Entry.profit` (payout − buy-in), per-entry
    roster — but they are only exposed by the session **detail** endpoint, not
    the list.
  - To show "who's playing" + net P/L on the card, `Session.to_dict()` must gain
    e.g. `player_count`, `roster` (names), `net_profit`. That is an **additive
    backend change** → out of scope for a pure-frontend iteration. Decide the
    payload shape deliberately (and confirm the detail page is unaffected), then
    implement backend first, then surface it on the card.
  - Note: for the seeded data, ended-session net P/L ≈ $0 (payout tracks
    buy-in), so net P/L is a *weak* headline there; `total_value` (money at the
    table) is the more useful always-populated metric and is what landed in iter 7.

## Deferred / out of scope this iteration
- True "P/L front and center" (per-player net win/loss) — same backend blocker as above.
