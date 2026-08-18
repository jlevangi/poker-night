"""Tests for the /api/chip-calculator/<buy_in> endpoint.

Covers the chip distribution route which calculates a weighted breakdown of
poker chips for a given buy-in amount.  The underlying algorithm lives in
``backend/scripts/chip_calculator.py`` and is invoked through the route in
``backend/app/routes/chip_calculator.py`` (mounted at ``/api``).

The Flask ``<float:`` converter used by the route only matches non-negative
decimal strings (``\\d+\\.\\d+``), so negative values and bare integers are
rejected at the routing layer with a 404 rather than reaching the handler.
"""

import unittest

from app import create_app

from tests.test_config import TestConfig


# Chip values in dollars, must match the definitions in
# backend/scripts/chip_calculator.py.
CHIP_VALUES = {
    "Black": 1.00,
    "Blue": 0.50,
    "Green": 0.20,
    "Red": 0.10,
    "White": 0.05,
}

# All fields returned by GET /api/chip-calculator/<buy_in>.
RESPONSE_FIELDS = {"buy_in", "chip_distribution", "total_chips"}


class TestChipCalculator(unittest.TestCase):
    """Tests for GET /api/chip-calculator/<buy_in>."""

    @classmethod
    def setUpClass(cls):
        """Create the application once for the entire test class."""
        cls.app = create_app(TestConfig)
        cls.client = cls.app.test_client()

    # -- Valid buy-in: status & content type -----------------------------------

    def test_valid_buy_in_returns_200(self):
        """GET /api/chip-calculator/20.0 returns HTTP 200."""
        resp = self.client.get('/api/chip-calculator/20.0')
        self.assertEqual(resp.status_code, 200)

    def test_valid_buy_in_returns_json(self):
        """GET /api/chip-calculator/20.0 returns a JSON response."""
        resp = self.client.get('/api/chip-calculator/20.0')
        self.assertIn('application/json', resp.content_type)

    # -- Valid buy-in: response payload ----------------------------------------

    def test_valid_buy_in_returns_expected_keys(self):
        """The response contains exactly buy_in, chip_distribution, total_chips."""
        resp = self.client.get('/api/chip-calculator/20.0')
        data = resp.get_json()
        self.assertEqual(set(data.keys()), RESPONSE_FIELDS)

    def test_buy_in_matches_input(self):
        """The buy_in field in the response matches the requested amount."""
        resp = self.client.get('/api/chip-calculator/25.0')
        data = resp.get_json()
        self.assertEqual(data['buy_in'], 25.0)

    def test_chip_distribution_has_chip_names(self):
        """chip_distribution keys are the five chip color names."""
        resp = self.client.get('/api/chip-calculator/20.0')
        data = resp.get_json()
        self.assertEqual(set(data['chip_distribution'].keys()), set(CHIP_VALUES))

    def test_chip_distribution_values_are_ints(self):
        """Each chip count in the distribution is an integer."""
        resp = self.client.get('/api/chip-calculator/20.0')
        data = resp.get_json()
        for count in data['chip_distribution'].values():
            self.assertIsInstance(count, int)

    def test_total_chips_equals_sum_of_distribution(self):
        """total_chips equals the sum of all individual chip counts."""
        resp = self.client.get('/api/chip-calculator/20.0')
        data = resp.get_json()
        self.assertEqual(
            data['total_chips'], sum(data['chip_distribution'].values())
        )

    def test_total_value_of_chips_equals_buy_in(self):
        """The monetary value of all chips sums to the requested buy-in."""
        resp = self.client.get('/api/chip-calculator/20.0')
        data = resp.get_json()
        total_value = sum(
            count * CHIP_VALUES[name]
            for name, count in data['chip_distribution'].items()
        )
        self.assertAlmostEqual(total_value, 20.0)

    # -- Valid buy-in: specific distributions ----------------------------------

    def test_distribution_for_20_buy_in(self):
        """A $20 buy-in produces exactly one full weighted set (no remainder)."""
        resp = self.client.get('/api/chip-calculator/20.0')
        data = resp.get_json()
        dist = data['chip_distribution']
        self.assertEqual(dist["Black"], 10)
        self.assertEqual(dist["Blue"], 10)
        self.assertEqual(dist["Green"], 13)
        self.assertEqual(dist["Red"], 14)
        self.assertEqual(dist["White"], 20)

    def test_distribution_for_25_buy_in(self):
        """A $25 buy-in adds 5 Black chips to the base $20 set."""
        resp = self.client.get('/api/chip-calculator/25.0')
        data = resp.get_json()
        dist = data['chip_distribution']
        self.assertEqual(dist["Black"], 15)
        self.assertEqual(dist["Blue"], 10)
        self.assertEqual(dist["Green"], 13)
        self.assertEqual(dist["Red"], 14)
        self.assertEqual(dist["White"], 20)

    def test_distribution_for_30_buy_in(self):
        """A $30 buy-in adds 10 Black chips to the base $20 set."""
        resp = self.client.get('/api/chip-calculator/30.0')
        data = resp.get_json()
        dist = data['chip_distribution']
        self.assertEqual(dist["Black"], 20)
        self.assertEqual(dist["Blue"], 10)
        self.assertEqual(dist["Green"], 13)
        self.assertEqual(dist["Red"], 14)
        self.assertEqual(dist["White"], 20)

    def test_small_buy_in_50_cents(self):
        """A $0.50 buy-in produces a single Blue chip (50-cent value)."""
        resp = self.client.get('/api/chip-calculator/0.5')
        data = resp.get_json()
        dist = data['chip_distribution']
        self.assertEqual(dist["Black"], 0)
        self.assertEqual(dist["Blue"], 1)
        self.assertEqual(dist["Green"], 0)
        self.assertEqual(dist["Red"], 0)
        self.assertEqual(dist["White"], 0)
        self.assertEqual(data['total_chips'], 1)

    # -- Invalid buy-in -------------------------------------------------------

    def test_zero_buy_in_returns_400(self):
        """A buy-in of 0.0 returns HTTP 400 (caught by the route handler)."""
        resp = self.client.get('/api/chip-calculator/0.0')
        self.assertEqual(resp.status_code, 400)

    def test_zero_buy_in_returns_error_message(self):
        """A buy-in of 0.0 returns the 'must be positive' error message."""
        resp = self.client.get('/api/chip-calculator/0.0')
        data = resp.get_json()
        self.assertEqual(data["error"], "Buy-in amount must be positive")

    def test_negative_buy_in_returns_404(self):
        """A negative buy-in does not match the float converter and 404s.

        The Werkzeug ``<float:`` converter regex is ``\\d+\\.\\d+`` which
        rejects the leading minus sign, so the route handler's ``<= 0`` check
        is never reached for negative values.
        """
        resp = self.client.get('/api/chip-calculator/-5.0')
        self.assertEqual(resp.status_code, 404)

    def test_non_numeric_buy_in_returns_404(self):
        """A non-numeric buy-in does not match the float converter and 404s."""
        resp = self.client.get('/api/chip-calculator/abc')
        self.assertEqual(resp.status_code, 404)


if __name__ == '__main__':
    unittest.main()
