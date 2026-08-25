# Handoff — Gamble King Brand Consolidation (COMPLETE, iter 19)

## Brand system
"Gamble King" — confident, social, premium card room. Deep-navy `--casino-black`
header/brand, royal blue `--casino-blue` (#2563EB) primary action, casino gold
`--casino-gold` (#F59E0B) for highlights/crown/active, green/red/gold tint pairs
for status semantics, white/slate cards with hard 1-2px borders and soft shadows.
No gradients, no casino clichés. Single token source:
`frontend/static/css/styles/themes/_theme.css`; dark overrides in
`frontend/static/css/dark-mode.css` (same token names, `-dark`/`-light` pair
flips).

## Shared primitives changed (cumulative, 19 commits since base 1afcabb)
- `_theme.css` — single token source: brand colors, semantic roles, type scale
  (0.75–2rem), spacing, radii, shadows, transitions. `_modern-theme.css` de-duped
  (2166→~610 lines); `_legacy-vars.css` keeps the `--legacy-*` bridge only.
- `dark-mode.css` — renamed to the brand token names; `-dark`/`-light` pairs flip.
- `_buttons.css` — role classes (primary/gold/green/red/purple/ghost/danger) own
  all button color; page-local button color rules deleted.
- `_cards.css` — one `.neo-card` surface + `a.neo-card:hover` shared lift;
  per-page card duplicates deleted; hero/stat/tile variants tokenized.
- `_forms.css`, `_chips.css` (badges + status), `_tables.css`, `_lists.css`,
  `_navigation.css`, `_header.css`, `_modals.css`, `_skeletons.css` — unified to
  tokens; conflicting page rules deleted.
- Iter 19: `_calendar.css` (RSVP rows: yes/no solid brand roles in
  `event-detail-page.js` markup; "maybe" = gold tint in light, pinned solid amber
  + `--casino-black` ink in dark — solid gold never passes contrast in either
  theme), `_import.css` (radii/type tokenized), `_charts.css` (leaderboard
  variants fully tokenized, redundant dark blocks deleted), `admin.html` (self-
  contained page: :root now mirrors brand tokens; badges/alerts/RSVP inks
  re-colored to the tint vocabulary; gold cancel button fixed white-on-amber
  ~2:1 → dark ink ~8:1).

## Routes inspected (rendered, via CDP 9222 + the browser wrapper)
dashboard, players, session detail, sessions, stats, calendar, event detail,
import — desktop 1440 + mobile 390, light + dark (11 combos this pass; the
wrapper viewport is fixed at 390, so desktop was driven through
`Emulation.setDeviceMetricsOverride` on the direct CDP endpoint). Admin: login
flow + all 5 tabs + badges + RSVP inks + gold cancel + 768px bottom-nav,
rendered. All show header/nav/content; no broken surfaces found.

## Deliberate exceptions
- `admin.html` stays self-contained (inline `<style>`, no linked stylesheets)
  and light-only by design; brand alignment is via its own `:root` mirroring
  `_theme.css` values (documented in the file).
- `index.html` also links the pre-existing CDN Font Awesome (not app-owned;
  the two app-owned sheets are exactly `main.css` + `dark-mode.css`).
- `--casino-black`/`--casino-white` never flip (brand neutrals) → three
  documented per-component dark pins exist: hero name (_cards), RSVP "no"
  (_calendar), black leaderboard tile (_charts).
- Dark-theme role buttons use a tinted rest state by design; the RSVP row is
  the one place all three are pinned solid (semantic status set).

## Final gate results (this pass)
`python3 -m compileall -q backend` OK · `python3 scripts/check-css.py`
27 stylesheets, 0 problems · `../.venv/bin/python -m unittest discover -s tests`
181 tests OK · `node --check` clean on every JS module · rendered index.html
links exactly the two app-owned stylesheets (+ pre-existing CDN FA).

## Preview
Dedicated preview: `.venv/bin/python backend/run.py --debug --port 5057`
bound 0.0.0.0 (log `/tmp/preview-5057.log`), served from this worktree.
