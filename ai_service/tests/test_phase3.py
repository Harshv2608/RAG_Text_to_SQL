import os
import json
import pytest
from unittest.mock import patch, MagicMock, ANY
from ai_service.app.core.llm_provider import MockLLM, ReplayLLM, GeminiLLM, get_llm_provider
from ai_service.app.core.safety_guard import check

def test_mock_llm_deterministic_cycle():
    llm = MockLLM()
    resp1, in1, out1 = llm.generate_sql("prompt", "sys")
    assert resp1["sql"] == "DROP TABLE users; SELECT * FROM users;"
    resp2, in2, out2 = llm.generate_sql("prompt", "sys")
    assert resp2["sql"] == "SELEC * FRM users;"
    resp3, in3, out3 = llm.generate_sql("prompt", "sys")
    assert resp3["sql"] == "SELECT * FROM users;"

def test_replay_llm_fixtures(tmp_path):
    fixture_file = tmp_path / "responses.json"
    fixtures = {
        "test_prompt": {
            "parsed": {"sql": "SELECT 1 FROM replay;"},
            "in_tokens": 15,
            "out_tokens": 25
        }
    }
    fixture_file.write_text(json.dumps(fixtures))
    
    llm = ReplayLLM(fixture_path=str(fixture_file))
    
    resp, in_t, out_t = llm.generate_sql("test_prompt", "sys")
    assert resp["sql"] == "SELECT 1 FROM replay;"
    assert in_t == 15
    assert out_t == 25
    
    resp2, in2, out2 = llm.generate_sql("missing_prompt", "sys")
    assert resp2["sql"] == "SELECT * FROM users LIMIT 1;"

def test_gemini_llm_mocked_success():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key", "LLM_PROVIDER": "gemini"}):
        with patch("ai_service.app.core.llm_provider.genai.Client") as MockClient:
            mock_client_instance = MockClient.return_value
            mock_response = MagicMock()
            mock_response.text = '{"sql": "SELECT * FROM real_db;"}'
            mock_response.usage_metadata.prompt_token_count = 100
            mock_response.usage_metadata.candidates_token_count = 50
            mock_client_instance.models.generate_content.return_value = mock_response
            
            llm = GeminiLLM()
            resp, in_t, out_t = llm.generate_sql("prompt", "sys")
            assert resp["sql"] == "SELECT * FROM real_db;"
            assert in_t == 100
            assert out_t == 50
            mock_client_instance.models.generate_content.assert_called_with(
                model="gemini-1.5-pro",
                contents="prompt",
                config=ANY
            )

def test_gemini_llm_fallback_routing():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key", "LLM_PROVIDER": "gemini", "GEMINI_PRIMARY_MODEL": "gemini-1.5-pro", "GEMINI_FALLBACK_MODEL": "gemini-1.5-flash"}):
        with patch("ai_service.app.core.llm_provider.genai.Client") as MockClient:
            mock_client_instance = MockClient.return_value
            
            mock_response_success = MagicMock()
            mock_response_success.text = '{"sql": "SELECT 1 FROM fallback;"}'
            mock_response_success.usage_metadata.prompt_token_count = 10
            mock_response_success.usage_metadata.candidates_token_count = 5
            
            mock_client_instance.models.generate_content.side_effect = [
                Exception("503 Service Unavailable"),
                mock_response_success
            ]
            
            llm = GeminiLLM()
            resp, in_t, out_t = llm.generate_sql("prompt", "sys")
            
            assert resp["sql"] == "SELECT 1 FROM fallback;"
            assert mock_client_instance.models.generate_content.call_count == 2
            
            mock_client_instance.models.generate_content.assert_called_with(
                model="gemini-1.5-flash",
                contents="prompt",
                config=ANY
            )

def test_gemini_llm_quarantine():
    with patch.dict(os.environ, {"LLM_PROVIDER": "mock"}):
        llm = GeminiLLM()
        with pytest.raises(RuntimeError, match="Live API calls are quarantined"):
            llm.generate_sql("prompt", "sys")

def test_safety_guard_valid():
    result = check("SELECT * FROM users WHERE id = 1;")
    assert result.passed is True

def test_safety_guard_destructive():
    result = check("DROP TABLE events;")
    assert result.passed is False
    assert "DROP" in result.reason
    
    result = check("DELETE FROM users WHERE id = 1")
    assert result.passed is False
    assert "DELETE" in result.reason

def test_safety_guard_multi_statement():
    result = check("SELECT * FROM users; SELECT * FROM events")
    assert result.passed is False
    assert "Multi-statement" in result.reason

def test_provider_factory():
    assert isinstance(get_llm_provider("mock"), MockLLM)
    assert isinstance(get_llm_provider("replay"), ReplayLLM)
    assert isinstance(get_llm_provider("gemini"), GeminiLLM)
