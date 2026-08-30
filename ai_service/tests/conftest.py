import pytest
from unittest.mock import patch

@pytest.fixture(autouse=True)
def zero_call_invariant():
    """
    Globally enforces the Zero-Call Invariant across all Phase 8 testing.
    Any instantiation of google.genai.Client will immediately raise a RuntimeError.
    """
    with patch('google.genai.Client') as mock_client:
        mock_client.side_effect = RuntimeError("Zero-Call Invariant Violated: Live Gemini API call attempted during testing.")
        yield
