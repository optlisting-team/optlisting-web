"""
Security regression tests: OAuth state signing, admin key check.
Run from repo root: python -m pytest backend/tests -q
"""
import os

os.environ.setdefault("EBAY_CLIENT_SECRET", "test-secret")

from backend import ebay_webhook as ew
from backend.auth import verify_admin_key


def test_state_roundtrip():
    state = ew.sign_oauth_state("user-123", now=1000)
    assert ew.verify_oauth_state(state, now=1000 + 60) == "user-123"


def test_state_expires_after_10_minutes():
    state = ew.sign_oauth_state("user-123", now=1000)
    assert ew.verify_oauth_state(state, now=1000 + 600) == "user-123"
    assert ew.verify_oauth_state(state, now=1000 + 601) is None


def test_state_rejects_future_timestamp():
    state = ew.sign_oauth_state("user-123", now=5000)
    assert ew.verify_oauth_state(state, now=1000) is None


def test_state_rejects_legacy_unsigned_format():
    assert ew.verify_oauth_state("user_victim-id_1700000000.0") is None


def test_state_rejects_tampered_payload_and_signature():
    state = ew.sign_oauth_state("user-123", now=1000)
    payload, sig = state.split(".")
    forged = ew.sign_oauth_state("victim", now=1000).split(".")[0] + "." + sig
    assert ew.verify_oauth_state(forged, now=1001) is None
    assert ew.verify_oauth_state(payload + "." + "0" * 64, now=1001) is None


def test_state_rejects_empty_and_garbage():
    for bad in (None, "", "abc", "a.b.c", "....", "!!!.@@@"):
        assert ew.verify_oauth_state(bad) is None


def test_admin_key_fail_closed_when_unset(monkeypatch):
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    assert verify_admin_key("anything") is False
    assert verify_admin_key(None) is False
    assert verify_admin_key("") is False


def test_admin_key_match_and_mismatch(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    assert verify_admin_key("s3cret") is True
    assert verify_admin_key("wrong") is False
    assert verify_admin_key(None) is False
