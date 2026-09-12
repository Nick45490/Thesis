import base64

import pytest

from src.preprocess import decode_base64_image

RAW_BYTES = b"not a real image, just some bytes to round-trip"


def test_decodes_a_plain_base64_string():
    encoded = base64.b64encode(RAW_BYTES).decode("ascii")
    assert decode_base64_image(encoded) == RAW_BYTES


def test_decodes_a_data_url_prefixed_base64_string():
    # The frontend sends data URLs (data:image/jpeg;base64,<payload>) — the
    # prefix before the comma must be stripped before decoding.
    encoded = base64.b64encode(RAW_BYTES).decode("ascii")
    data_url = f"data:image/jpeg;base64,{encoded}"
    assert decode_base64_image(data_url) == RAW_BYTES


def test_incorrectly_padded_base64_raises():
    # base64.b64decode is lenient about stray non-alphabet characters (it just
    # drops them), so a real failure case has to be a genuine padding error,
    # not just "looks wrong" text — verified directly against the stdlib
    # before writing this assertion, rather than assuming it would raise.
    with pytest.raises(Exception):
        decode_base64_image("abc")
