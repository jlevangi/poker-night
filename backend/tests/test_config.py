"""Test configuration and Flask application factory tests.

This module provides:
- ``TestConfig``: a ``Config`` subclass that redirects the SQLAlchemy
  database URI to a temporary file-based SQLite database, giving every
  test run a clean, isolated data store.
- ``TestAppFactory``: unit tests verifying that ``create_app()`` produces
  a working Flask application with the expected configuration.
"""

import atexit
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

from app import create_app
from app.config import Config


# ---------------------------------------------------------------------------
# Temporary database shared across all test modules in this run.
# Using a file (not sqlite:///:memory:) avoids the per-connection database
# problem that Flask-SQLAlchemy has with in-memory SQLite.
# ---------------------------------------------------------------------------
_TEST_DB_DIR = tempfile.mkdtemp(prefix="poker_test_")
_TEST_DB_PATH = os.path.join(_TEST_DB_DIR, "test.db")

# Without this every test run leaves its temporary database behind; fifty runs
# left fifty directories in /tmp.
atexit.register(shutil.rmtree, _TEST_DB_DIR, ignore_errors=True)


class TestConfig(Config):
    """Configuration subclass for the test suite.

    Calls the parent ``__init__`` (which calculates paths, loads the app
    version, and seeds admin config) then overrides the database URI to
    point at a throwaway SQLite file.
    """

    def __init__(self):
        super().__init__()
        self.SQLALCHEMY_DATABASE_URI = f"sqlite:///{_TEST_DB_PATH}"
        self.SQLALCHEMY_ECHO = False
        # ``TESTING`` must be an *instance* attribute because ``create_app``
        # copies only ``vars(config)`` — class-level attributes are skipped.
        self.TESTING = True


class TestAppFactory(unittest.TestCase):
    """Tests for the Flask application factory and test configuration."""

    @classmethod
    def setUpClass(cls):
        """Create the application once for the entire test class."""
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    def test_production_wsgi_factory(self):
        from run import create_production_app

        with patch.dict(os.environ, {
            'SECRET_KEY': 'test-secret',
            'ADMIN_PASSWORD_HASH': 'test-hash',
        }):
            app = create_production_app()
            self.assertFalse(app.debug)
            self.assertEqual(app.test_client().get('/').status_code, 200)

    def test_production_requires_secrets(self):
        from app.config import ProductionConfig

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'SECRET_KEY'):
                ProductionConfig()

    # -- Configuration -------------------------------------------------------

    def test_app_created(self):
        """``create_app`` should return a Flask application instance."""
        self.assertIsNotNone(self.app)

    def test_database_uri_is_temporary(self):
        """The database URI must point at the temporary test database."""
        self.assertEqual(
            self.app.config["SQLALCHEMY_DATABASE_URI"],
            f"sqlite:///{_TEST_DB_PATH}",
        )

    def test_testing_flag_enabled(self):
        """``TESTING`` must be ``True`` so Flask propagates exceptions."""
        self.assertTrue(self.app.config["TESTING"])

    # -- Database ------------------------------------------------------------

    def test_database_tables_exist(self):
        """Core ORM tables should be created during app initialization."""
        from app.database.models import db

        with self.app.app_context():
            table_names = db.inspect(db.engine).get_table_names()
            for expected in ("players", "sessions", "entries"):
                self.assertIn(expected, table_names)


if __name__ == "__main__":
    unittest.main()
