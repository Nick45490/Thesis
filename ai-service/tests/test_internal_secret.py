"""Tests for routes.py's _require_internal_secret — the only thing standing
between ai-service and free, unauthenticated inference for anyone who reaches
its port directly (it has no other auth of its own). Mirrors the same 4 cases
collection-service's requireInternalSecret.middleware.test.js covers for the
equivalent JS check, since this is the Python side of the same guarantee.
"""

import os

import pytest
from fastapi import HTTPException

from src.routes import _require_internal_secret


@pytest.fixture(autouse=True)
def _clean_env():
    original = os.environ.pop("INTERNAL_SERVICE_SECRET", None)
    yield
    if original is not None:
        os.environ["INTERNAL_SERVICE_SECRET"] = original
    else:
        os.environ.pop("INTERNAL_SERVICE_SECRET", None)


def test_passes_when_header_matches_the_configured_secret():
    os.environ["INTERNAL_SERVICE_SECRET"] = "top-secret"
    # No exception raised == FastAPI treats the dependency as satisfied.
    _require_internal_secret(x_internal_secret="top-secret")


def test_rejects_with_401_when_header_is_missing():
    os.environ["INTERNAL_SERVICE_SECRET"] = "top-secret"
    with pytest.raises(HTTPException) as exc_info:
        _require_internal_secret(x_internal_secret=None)
    assert exc_info.value.status_code == 401


def test_rejects_with_401_when_header_does_not_match():
    os.environ["INTERNAL_SERVICE_SECRET"] = "top-secret"
    with pytest.raises(HTTPException) as exc_info:
        _require_internal_secret(x_internal_secret="wrong-value")
    assert exc_info.value.status_code == 401


def test_rejects_every_request_when_secret_itself_is_unset():
    # Fail-closed: an unconfigured secret must never be treated as "no check
    # required" — otherwise deploying without the env var silently disables
    # the whole guard instead of blocking every request. Matches the same
    # empty-header-still-rejected case in the JS equivalent.
    with pytest.raises(HTTPException) as exc_info:
        _require_internal_secret(x_internal_secret="")
    assert exc_info.value.status_code == 401


# The following four cover rotation: INTERNAL_SERVICE_SECRET_PREVIOUS lets a
# secret roll out to every receiver before the gateway switches to sending
# it, without a hard cutover that would reject every request in between.
# Mirrors the equivalent JS tests in the Node services.

def test_accepts_current_secret_even_while_previous_is_also_configured():
    os.environ["INTERNAL_SERVICE_SECRET"] = "new-secret"
    os.environ["INTERNAL_SERVICE_SECRET_PREVIOUS"] = "old-secret"
    _require_internal_secret(x_internal_secret="new-secret")


def test_accepts_previous_secret_during_a_rotation_window():
    os.environ["INTERNAL_SERVICE_SECRET"] = "new-secret"
    os.environ["INTERNAL_SERVICE_SECRET_PREVIOUS"] = "old-secret"
    _require_internal_secret(x_internal_secret="old-secret")


def test_rejects_value_matching_neither_current_nor_previous():
    os.environ["INTERNAL_SERVICE_SECRET"] = "new-secret"
    os.environ["INTERNAL_SERVICE_SECRET_PREVIOUS"] = "old-secret"
    with pytest.raises(HTTPException) as exc_info:
        _require_internal_secret(x_internal_secret="some-other-value")
    assert exc_info.value.status_code == 401


def test_unset_previous_secret_does_not_relax_the_check():
    os.environ["INTERNAL_SERVICE_SECRET"] = "new-secret"
    os.environ.pop("INTERNAL_SERVICE_SECRET_PREVIOUS", None)
    with pytest.raises(HTTPException) as exc_info:
        _require_internal_secret(x_internal_secret="old-secret")
    assert exc_info.value.status_code == 401
