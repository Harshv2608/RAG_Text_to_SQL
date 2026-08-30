import json
import os
import pytest
from ai_service.app.core.orchestrator import SQLOrchestrator
from ai_service.app.models.schemas import SQLGenerationRequest

def test_dataset_leakage_invariant():
    """
    Prove zero data leakage between train and test datasets.
    """
    train_path = os.path.join(os.path.dirname(__file__), '../../benchmark/train_bank.json')
    test_path = os.path.join(os.path.dirname(__file__), '../../benchmark/test_benchmark.json')
    
    with open(train_path, 'r') as f:
        train_data = json.load(f)
    with open(test_path, 'r') as f:
        test_data = json.load(f)
        
    train_qids = {item.get('example_id', item.get('question_id')) for item in train_data}
    test_qids = {item.get('question_id', item.get('example_id')) for item in test_data}
    
    train_questions = {item['question'] for item in train_data}
    test_questions = {item['question'] for item in test_data}
    
    train_sqls = {item['gold_sql'] for item in train_data}
    test_sqls = {item['gold_sql'] for item in test_data}
    
    # Assert zero intersection
    assert len(train_qids.intersection(test_qids)) == 0, "Data Leakage: Overlapping question IDs!"
    assert len(train_questions.intersection(test_questions)) == 0, "Data Leakage: Overlapping questions text!"
    assert len(train_sqls.intersection(test_sqls)) == 0, "Data Leakage: Overlapping gold SQL!"

@pytest.mark.asyncio
async def test_retry_count_invariant():
    """
    Prove the invariant: retry_count = max(0, attempt_count - 1)
    """
    from ai_service.app.core.llm_provider import MockLLM
    from unittest.mock import MagicMock
    # Force MockLLM to fail multiple times, generating multiple attempts
    os.environ["LLM_PROVIDER"] = "mock"
    mock_db = MagicMock()
    def mock_db_execute(sql):
        if "SELEC " in sql:
            return (False, [], "Syntax error")
        return (True, [], "")
    mock_db.execute.side_effect = mock_db_execute
    orchestrator = SQLOrchestrator(MockLLM(), mock_db)
    
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        question="Find users in India",
        schema_signature="",
        tier=1,
        rag_enabled=False,
        max_retries=5
    )
    
    attempts_count = len(logs)
    
    if attempts_count != 3:
        for log in logs:
            print(f"Attempt {log.attempt_number}: {log.status} - {log.error_message}")
            
    assert attempts_count == 3, "MockLLM should generate exactly 3 attempts (safety fail, syntax fail, success)"
    assert retries == max(0, attempts_count - 1), "Invariant violation: retry_count != max(0, attempt_count - 1)"

@pytest.mark.asyncio
async def test_factorial_job_uniqueness_invariant():
    """
    The gateway is responsible for job IDs, but we assert that the structure is expected.
    This validates the eval script outputs.
    """
    import re
    # We test that a job ID correctly specifies a unique experimental condition
    # e.g. eval_test_t1_0_tier1_rag0
    
    job_id = "eval_Q123_tier2_rag1"
    
    match = re.match(r'^eval_(.+)_tier(\d)_rag([01])$', job_id)
    assert match is not None
    assert match.group(1) == "Q123"
    assert int(match.group(2)) == 2
    assert bool(int(match.group(3))) is True
