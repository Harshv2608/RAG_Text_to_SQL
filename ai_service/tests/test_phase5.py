import pytest
import os
import json
from unittest.mock import MagicMock
from ai_service.app.core.orchestrator import SQLOrchestrator
from ai_service.app.core.llm_provider import MockLLM
from ai_service.app.db.chroma_client import ChromaClient

class TrackingLLM(MockLLM):
    def __init__(self):
        self.call_count = 0
        self.prompts = []
        
    def generate_sql(self, prompt, sys_inst):
        self.prompts.append(prompt)
        self.call_count += 1
        return ({"sql": "SELECT 1;"}, 10, 10)

def test_rag_disabled_isolation():
    mock_db = MagicMock()
    mock_db.execute.return_value = (True, [], "")
    mock_chroma = MagicMock()
    mock_chroma.retrieve.return_value = [{"question": "q1", "gold_sql": "s1"}]
    
    llm = TrackingLLM()
    orchestrator = SQLOrchestrator(llm, mock_db, chroma_client=mock_chroma)
    
    # RAG explicitly disabled
    orchestrator.generate_and_correct("How many users?", "schema_sig", 1, rag_enabled=False)
    
    prompt_sent = llm.prompts[0]
    
    # Assert Chroma was never called
    mock_chroma.retrieve.assert_not_called()
    # Assert no examples injected
    assert "Example Question" not in prompt_sent
    assert "Schema: schema_sig" in prompt_sent

def test_rag_enabled_injection():
    mock_db = MagicMock()
    mock_db.execute.return_value = (True, [], "")
    mock_chroma = MagicMock()
    mock_chroma.retrieve.return_value = [
        {"question": "How many users?", "gold_sql": "SELECT count(*) FROM users;"},
        {"question": "How many events?", "gold_sql": "SELECT count(*) FROM events;"}
    ]
    
    llm = TrackingLLM()
    orchestrator = SQLOrchestrator(llm, mock_db, chroma_client=mock_chroma)
    
    # RAG enabled
    orchestrator.generate_and_correct("How many total users?", "schema_sig", 1, rag_enabled=True)
    
    prompt_sent = llm.prompts[0]
    
    # Assert Chroma was called
    mock_chroma.retrieve.assert_called_with("How many total users?", top_k=3)
    # Assert examples injected
    assert "Here are some examples of similar queries:" in prompt_sent
    assert "Example Question: How many users?" in prompt_sent
    assert "Example SQL: SELECT count(*) FROM users;" in prompt_sent

class DummyEmbeddingFunction:
    def name(self) -> str:
        return "dummy"
        
    def __call__(self, input):
        # 384 dimensions matching MiniLM
        return [[0.1] * 384 for _ in input]

def test_chroma_ingestion_limits(tmp_path):
    db_path = str(tmp_path / "chroma_db")
    client = ChromaClient(db_path=db_path, collection_name="test_collection", embedding_function=DummyEmbeddingFunction())
    
    auth_train = [{"example_id": f"train_{i}", "question": f"q_train_{i}", "gold_sql": f"s_train_{i}", "tier": 1} for i in range(30)]
    auth_test = [{"question_id": f"test_{i}", "question": f"q_test_{i}", "gold_sql": f"s_test_{i}", "tier": 1} for i in range(30)]
    
    auth_train_path = tmp_path / "train_bank.json"
    auth_test_path = tmp_path / "test_benchmark.json"
    auth_train_path.write_text(json.dumps(auth_train))
    auth_test_path.write_text(json.dumps(auth_test))
    
    poisoned_data = auth_train[:20] + [{"example_id": x["question_id"], "question": x["question"], "gold_sql": x["gold_sql"], "tier": x["tier"]} for x in auth_test[:10]]
    poisoned_path = tmp_path / "poisoned_bank.json"
    poisoned_path.write_text(json.dumps(poisoned_data))
    
    with pytest.raises(ValueError, match="Isolation Error: Input data contains unauthorized records"):
        client.populate(
            train_bank_path=str(poisoned_path),
            authoritative_train_path=str(auth_train_path),
            authoritative_test_path=str(auth_test_path)
        )
        
    client.populate(
        train_bank_path=str(auth_train_path),
        authoritative_train_path=str(auth_train_path),
        authoritative_test_path=str(auth_test_path)
    )
    
    assert client.collection.count() == 30
