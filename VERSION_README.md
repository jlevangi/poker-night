# Version Management

The application version is managed in a single file: `version.txt`

## Updating the Version

To update the application version, simply edit `version.txt` in the project root:

```bash
echo "2.1.5" > version.txt
```

## How It Works

1. **Backend**: The `app/config.py` reads from `version.txt` and exposes it via `/api/config`
2. **Frontend**: The JavaScript code fetches the version from the backend API
3. **Service Worker**: Uses the version for cache management and update detection
4. **Install Script**: Creates `version.txt` if it doesn't exist during deployment

## Version Format

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

## Important

- **Never** put the version in `.env` files - use `version.txt` only
- The version is automatically served to the frontend via the `/api/config` endpoint
- Update notifications trigger when users have an older cached version
