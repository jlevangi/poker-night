# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run locally (development mode with hot reload)
python backend/run.py --debug --config development --port 5000

# Debug path resolution issues
python backend/run.py --debug-paths

# Run via Docker
docker-compose up --build

# Generate admin password hash
./venv/bin/python scripts/generate_password_hash.py "newpassword"
```

There is no test suite, linter, or build step configured.

## Architecture

### Backend (Flask)

Flask app using the factory pattern in `backend/app/__init__.py`. Entry point is `backend/run.py`.

**Blueprints** (registered in `__init__.py`):
- `players_bp`, `sessions_bp`, `chip_calculator_bp`, `dashboard_bp`, `config_bp`, `calendar_bp` — all mounted at `/api`
- `stats_bp` — declares its own `/api/` prefix in route decorators (no url_prefix on registration)
- `notifications_bp` — mounted at `/api/notifications`
- `admin_bp` — mounted at `/admin` (session-based auth via `@require_admin_auth` decorator)
- `frontend_bp` — serves HTML templates and static files at root

**Data layer**: SQLAlchemy with SQLite stored in `poker_data/sessions.db`. All route files use `DatabaseService` (`backend/app/database/service.py`) for data access — never query models directly from routes (except `admin.py` which does both).

**Auto-migrations**: `AutoMigration.run_auto_migrations(app)` runs on every startup. New migrations go in `backend/app/database/migrations.py`.

**Config**: `backend/app/config.py` computes all paths dynamically relative to the backend directory. Environment loaded from `.env` at project root.

### Frontend

Two separate frontends:
1. **Public SPA**: `frontend/templates/index.html` + ES6 modules in `frontend/static/js/modules/`. Client-side router in `router.js`, API calls via `api-service.js`. No build tools — pure JS/CSS.
2. **Admin dashboard**: `frontend/templates/admin.html` — fully self-contained single file with all HTML/CSS/JS inline. Uses bottom nav, card-based layout, modal dialogs. Entries list uses `IntersectionObserver` for pagination.

### Database Models (`backend/app/database/models.py`)

Four core models: `Player`, `Session`, `Entry` (join table linking players to sessions), `PushSubscription`.

**ID formats**: `pid_NNN` (players), `sid_YYYYMMDD_N` (sessions), `eid_NNNN` (entries), `evt_YYYYMMDD_N` (calendar events).

**Calendar tables**: `CalendarEvent` and `EventRSVP` (created via auto-migration, not SQLAlchemy models — raw SQL in `calendar.py` routes).

### Key Patterns

- **Money handling**: All monetary values use `round_to_cents()` from `models.py` to prevent floating point errors.
- **RSVP statuses**: `YES`, `NO`, `MAYBE` (uppercase strings).
- **Versioned static URLs**: `versioned_url()` context processor appends `?v=APP_VERSION` for cache busting.
- **PWA**: Service worker at `frontend/static/js/sw.js`, manifest at `frontend/manifest.json`.

## Admin Dashboard (`admin.html`) Pitfalls

Since admin.html builds HTML strings with template literals:
- `escapeHtml()` MUST escape single quotes (`'` → `&#39;`) for use in onclick attributes.
- Never use `JSON.stringify()` inside HTML attributes — double quotes break attribute boundaries.
- Use `Number()` when interpolating API values into JS expressions (API may return strings).
- Use `!!value` for booleans from API responses.
- After delete operations that change counts, call `loadDashboard()` to refresh stats.
