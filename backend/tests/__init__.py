"""Test suite for the Poker Night Flask backend.

Ensures the backend directory is on the Python path so that test modules
can import the application as `from app import create_app`.
"""
import os
import sys

# Insert the backend directory (parent of this package) at the front of
# sys.path so that `app` is importable regardless of the working directory
# from which the test suite is launched.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
