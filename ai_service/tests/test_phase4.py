import pytest
from unittest.mock import MagicMock
from ai_service.app.core.orchestrator import SQLOrchestrator
from ai_service.app.core.llm_provider import MockLLM
from ai_service.app.models.schemas import ExecutionLog

class DeterministicTestLLM(MockLLM):
    def __init__(self, sequence):
        self.call_count = 0
        self.sequence = sequence
        
    def generate_sql(self, prompt, sys_inst):
        if self.call_count < len(self.sequence):
            resp = self.sequence[self.call_count]
        else:
            resp = self.sequence[-1]
        self.call_count += 1
        return resp

def test_immediate_success():
    mock_db = MagicMock()
    mock_db.execute.return_value = (True, [{"id": 1}], "")
    
    llm = DeterministicTestLLM([
        ({"sql": "SELECT * FROM users;"}, 10, 15)
    ])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert success is True
    assert correct is True
    assert attempts == 1
    assert retries == 0
    assert sql == "SELECT * FROM users;"
    assert data == [{"id": 1}]
    assert tokens == 25
    assert len(logs) == 1
    assert logs[0].status == "success"

def test_safety_rejection_then_correction():
    mock_db = MagicMock()
    mock_db.execute.return_value = (True, [], "")
    
    llm = DeterministicTestLLM([
        ({"sql": "DROP TABLE users;"}, 10, 10),
        ({"sql": "SELECT * FROM users;"}, 20, 15)
    ])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert success is True
    assert attempts == 2
    assert retries == 1
    assert tokens == 55  # (10+10) + (20+15)
    assert logs[0].status == "rejected_safety"
    assert logs[1].status == "success"
    assert "DROP" in logs[0].error_message

def test_execution_error_then_correction():
    mock_db = MagicMock()
    mock_db.execute.side_effect = [
        (False, [], "column 'bad_col' does not exist"),
        (True, [{"valid": True}], "")
    ]
    
    llm = DeterministicTestLLM([
        ({"sql": "SELECT bad_col FROM users;"}, 10, 10),
        ({"sql": "SELECT id FROM users;"}, 30, 10)
    ])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert success is True
    assert attempts == 2
    assert retries == 1
    assert logs[0].status == "rejected_execution"
    assert "bad_col" in logs[0].error_message
    assert logs[1].status == "success"

def test_multiple_retry_sequence():
    mock_db = MagicMock()
    # Attempt 1: guard rejection (DROP)
    # Attempt 2: db execution error (syntax error)
    # Attempt 3: db execution error (column not exist)
    # Attempt 4: db execution success
    mock_db.execute.side_effect = [
        (False, [], "syntax error"),
        (False, [], "column not exist"),
        (True, [], "")
    ]
    
    llm = DeterministicTestLLM([
        ({"sql": "DROP TABLE users;"}, 5, 5),          # Attempt 1
        ({"sql": "SELECT * FRM users;"}, 10, 5),       # Attempt 2
        ({"sql": "SELECT bad FROM users;"}, 15, 5),    # Attempt 3
        ({"sql": "SELECT * FROM users;"}, 20, 5)       # Attempt 4
    ])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert success is True
    assert correct is True
    assert attempts == 4
    assert retries == 3
    assert tokens == 70  # (5+5) + (10+5) + (15+5) + (20+5)
    assert len(logs) == 4
    assert logs[0].status == "rejected_safety"
    assert logs[1].status == "rejected_execution"
    assert logs[2].status == "rejected_execution"
    assert logs[3].status == "success"

def test_max_retries_termination():
    mock_db = MagicMock()
    # Always fails
    mock_db.execute.return_value = (False, [], "syntax error")
    
    llm = DeterministicTestLLM([
        ({"sql": "SELECT * FRM users;"}, 10, 10)
    ])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert success is False
    assert correct is False
    assert attempts == 5  # Exactly 5 total attempts
    assert retries == 4   # 4 retries
    assert len(logs) == 5
    assert tokens == 100  # 5 * 20
    for log in logs:
        assert log.status == "rejected_execution"

def test_token_accumulation():
    mock_db = MagicMock()
    mock_db.execute.side_effect = [
        (False, [], "err1"),
        (False, [], "err2"),
        (True, [], "")
    ]
    
    llm = DeterministicTestLLM([
        ({"sql": "S1;"}, 10, 5),   # 15
        ({"sql": "S2;"}, 20, 10),  # 30
        ({"sql": "S3;"}, 30, 15)   # 45
    ])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert tokens == 90  # 15 + 30 + 45
    assert attempts == 3
    assert retries == 2

def test_latency_tracking():
    mock_db = MagicMock()
    mock_db.execute.return_value = (True, [], "")
    llm = DeterministicTestLLM([({"sql": "SELECT 1;"}, 10, 10)])
    
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert isinstance(lat, float)
    assert lat >= 0.0

def test_exact_feedback_propagation():
    mock_db = MagicMock()
    mock_db.execute.side_effect = [
        (False, [], "postgres_timeout_error"),
        (True, [], "")
    ]
    
    prompts_received = []
    
    class TrackingLLM(MockLLM):
        def __init__(self):
            self.call_count = 0
            
        def generate_sql(self, prompt, sys_inst):
            prompts_received.append(prompt)
            self.call_count += 1
            if self.call_count == 1:
                return ({"sql": "bad sql"}, 10, 10)
            return ({"sql": "good sql"}, 10, 10)
            
    llm = TrackingLLM()
    orchestrator = SQLOrchestrator(llm, mock_db)
    orchestrator.generate_and_correct("my_q", "my_schema", 1, max_retries=5)
    
    assert len(prompts_received) == 2
    assert "postgres_timeout_error" not in prompts_received[0]
    assert "PREVIOUS ATTEMPT FAILED WITH DB ERROR: postgres_timeout_error. Fix the SQL." in prompts_received[1]
    assert "my_schema" in prompts_received[1]

def test_final_failure_behavior():
    mock_db = MagicMock()
    mock_db.execute.return_value = (False, [], "fatal")
    
    llm = DeterministicTestLLM([({"sql": "bad"}, 10, 10)])
    orchestrator = SQLOrchestrator(llm, mock_db)
    success, correct, sql, data, attempts, retries, tokens, lat, logs = orchestrator.generate_and_correct(
        "test", "schema", 1, max_retries=5
    )
    
    assert success is False
    assert correct is False
    assert sql == "bad"
    assert data is None
    assert attempts == 5
    assert retries == 4
