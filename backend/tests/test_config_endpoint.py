"""Tests for the /api/config endpoint.

Tests that the public configuration endpoint returns only the expected
non-sensitive configuration values that the frontend needs.
"""

import unittest

from app import create_app
from app.config import Config
from tests.test_config import TestConfig


class TestConfigEndpoint(unittest.TestCase):
    """Tests for GET /api/config."""

    @classmethod
    def setUpClass(cls):
        """Create the application once for the entire test class."""
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    # -- Response status & content type ------------------------------------

    def test_get_config_returns_200(self):
        """GET /api/config should return HTTP 200."""
        response = self.client.get('/api/config')
        self.assertEqual(response.status_code, 200)

    def test_get_config_returns_json(self):
        """GET /api/config should return a JSON response."""
        response = self.client.get('/api/config')
        self.assertIn('application/json', response.content_type)

    # -- Response payload ---------------------------------------------------

    def test_get_config_returns_expected_keys(self):
        """The response should contain all expected public config keys."""
        response = self.client.get('/api/config')
        data = response.get_json()
        expected_keys = {
            'APP_VERSION',
            'API_BASE_URL',
            'CACHE_NAME_PREFIX',
            'DEBUG_MODE',
            'CACHE_BUST_VALUE',
        }
        self.assertEqual(set(data.keys()), expected_keys)

    def test_get_config_api_base_url(self):
        """API_BASE_URL should be '/api'."""
        response = self.client.get('/api/config')
        data = response.get_json()
        self.assertEqual(data['API_BASE_URL'], '/api')

    def test_get_config_cache_name_prefix(self):
        """CACHE_NAME_PREFIX should be 'gamble-king-cache'."""
        response = self.client.get('/api/config')
        data = response.get_json()
        self.assertEqual(data['CACHE_NAME_PREFIX'], 'gamble-king-cache')

    def test_get_config_cache_bust_value(self):
        """CACHE_BUST_VALUE should be 1."""
        response = self.client.get('/api/config')
        data = response.get_json()
        self.assertEqual(data['CACHE_BUST_VALUE'], 1)

    def test_get_config_app_version_matches_config(self):
        """APP_VERSION should match the value computed by Config()."""
        response = self.client.get('/api/config')
        data = response.get_json()
        config = Config()
        self.assertEqual(data['APP_VERSION'], config.APP_VERSION)

    def test_get_config_debug_mode_is_false(self):
        """DEBUG_MODE should be False for the base Config class."""
        response = self.client.get('/api/config')
        data = response.get_json()
        self.assertFalse(data['DEBUG_MODE'])

    # -- Security -----------------------------------------------------------

    def test_get_config_no_sensitive_keys_exposed(self):
        """The response should not expose sensitive configuration values."""
        response = self.client.get('/api/config')
        data = response.get_json()
        sensitive_keys = {
            'SECRET_KEY',
            'ADMIN_PASSWORD_HASH',
            'SQLALCHEMY_DATABASE_URI',
        }
        for key in sensitive_keys:
            self.assertNotIn(key, data)


if __name__ == '__main__':
    unittest.main()
