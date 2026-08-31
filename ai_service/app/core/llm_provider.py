import json
import os
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple
from google import genai

class LLMProvider(ABC):
    @abstractmethod
    def generate_sql(self, prompt: str, system_instruction: str) -> Tuple[Dict[str, Any], int, int]:
        """Returns: (parsed_json_dict, input_tokens, output_tokens)"""
        pass

class MockLLM(LLMProvider):
    def __init__(self):
        self.call_count = 0
        
    def generate_sql(self, prompt: str, system_instruction: str) -> Tuple[Dict[str, Any], int, int]:
        self.call_count += 1
        if self.call_count % 2 != 0:
            return ({"sql": "SELEC * FRM users;"}, 60, 20)
        return ({"sql": "SELECT * FROM users;"}, 70, 20)

class ReplayLLM(LLMProvider):
    def __init__(self, fixture_path: str = "evaluation/fixtures/responses.json"):
        self.fixture_path = fixture_path
        self._fixtures = {}
        self._state = {}
        self._load_fixtures()
        
    def _load_fixtures(self):
        try:
            with open(self.fixture_path, 'r') as f:
                self._fixtures = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self._fixtures = {}

    def generate_sql(self, prompt: str, system_instruction: str) -> Tuple[Dict[str, Any], int, int]:
        import hashlib
        # Use a hash of the prompt to track state
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
        
        # Check if we have an exact match in fixtures
        if prompt in self._fixtures:
            resp = self._fixtures[prompt]
            return (resp.get("parsed", {"sql": "SELECT 1;"}), resp.get("in_tokens", 10), resp.get("out_tokens", 10))
            
        # Or check if any fixture key is a substring of the prompt (useful for questions)
        for key, resp in self._fixtures.items():
            if key in prompt:
                # If it's a list, treat it as a sequence of responses for this key
                if isinstance(resp, list):
                    attempt = self._state.get(key, 0)
                    current_resp = resp[min(attempt, len(resp) - 1)]
                    self._state[key] = attempt + 1
                    return (current_resp.get("parsed", {"sql": "SELECT 1;"}), current_resp.get("in_tokens", 10), current_resp.get("out_tokens", 10))
                else:
                    return (resp.get("parsed", {"sql": "SELECT 1;"}), resp.get("in_tokens", 10), resp.get("out_tokens", 10))

        # Default fallback if not found in fixtures
        return ({"sql": "SELECT * FROM users LIMIT 1;"}, 10, 10)

class GeminiLLM(LLMProvider):
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.primary_model = os.getenv("GEMINI_PRIMARY_MODEL", "gemini-3.5-flash")
        self.fallback_model = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash")
        
        # Only initialize real client if not strictly mocked
        if self.api_key and os.getenv("LLM_PROVIDER") != "mock":
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def _call_api(self, model: str, prompt: str, system_instruction: str) -> Tuple[Dict[str, Any], int, int]:
        if not self.client:
             raise RuntimeError("Gemini API key not configured or LLM_PROVIDER is mock.")
        
        response = self.client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0.0
            )
        )
        
        try:
            parsed = json.loads(response.text)
        except (json.JSONDecodeError, TypeError):
            parsed = {"sql": "", "error": "Failed to parse JSON from Gemini"}
            
        in_tokens = response.usage_metadata.prompt_token_count if response.usage_metadata else 0
        out_tokens = response.usage_metadata.candidates_token_count if response.usage_metadata else 0
        
        return parsed, in_tokens, out_tokens

    def generate_sql(self, prompt: str, system_instruction: str) -> Tuple[Dict[str, Any], int, int]:
        if os.getenv("LLM_PROVIDER") != "gemini":
             raise RuntimeError("Live API calls are quarantined. Set LLM_PROVIDER=gemini to allow real calls.")
             
        try:
            return self._call_api(self.primary_model, prompt, system_instruction)
        except Exception as e:
            # Fallback routing
            return self._call_api(self.fallback_model, prompt, system_instruction)

def get_llm_provider(provider_type: str = "mock") -> LLMProvider:
    if provider_type == "mock":
        return MockLLM()
    elif provider_type == "replay":
        return ReplayLLM()
    elif provider_type == "gemini":
        return GeminiLLM()
    else:
        return MockLLM()
