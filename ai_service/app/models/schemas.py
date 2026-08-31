from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class SQLGenerationRequest(BaseModel):
    question: str
    tier: int = Field(ge=1, le=3)
    rag_enabled: bool = False
    max_retries: int = 5
    schema_signature: str = "users(id, name)\nevents(id, name)"

class GuardResult(BaseModel):
    passed: bool
    reason: Optional[str] = None

class ExecutionLog(BaseModel):
    attempt_number: int
    generated_sql: str
    status: str
    error_message: Optional[str] = None
    tokens_used: int = 0
    latency_ms: float = 0.0

class SQLGenerationResponse(BaseModel):
    success: bool
    final_sql: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None
    retries: int
    api_requests_count: int
    total_tokens: int
    latency_ms: float
    logs: List[ExecutionLog]
