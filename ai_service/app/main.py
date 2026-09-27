import os
from fastapi import FastAPI
from app.models.schemas import SQLGenerationRequest, SQLGenerationResponse
from app.core.llm_provider import get_llm_provider
from app.core.orchestrator import SQLOrchestrator
from app.db.postgres import PostgresExecutor
from app.db.chroma_client import ChromaClient
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="InsightSQL AI Service")

LLM_PROVIDER_TYPE = os.getenv("LLM_PROVIDER", "mock")
llm_provider = get_llm_provider(LLM_PROVIDER_TYPE)
db_executor = PostgresExecutor()
chroma_client = ChromaClient()

orchestrator = SQLOrchestrator(llm_provider, db_executor, chroma_client)

@app.on_event("startup")
def startup_event():
    import os
    base_dir = "/benchmark" if os.path.exists("/benchmark") else "../benchmark"
    try:
        chroma_client.populate(
            train_bank_path=f"{base_dir}/train_bank.json",
            authoritative_train_path=f"{base_dir}/train_bank.json",
            authoritative_test_path=f"{base_dir}/test_benchmark.json"
        )
        print("ChromaDB populated successfully.")
    except Exception as e:
        print(f"Warning: ChromaDB population failed: {e}")

@app.get("/health")
def health_check():
    return {"status": "healthy", "provider": LLM_PROVIDER_TYPE}

@app.post("/orchestrate", response_model=SQLGenerationResponse)
def generate_query(request: SQLGenerationRequest):
    try:
        (
            execution_success,
            result_correct,
            final_sql,
            final_data,
            attempt_count,
            retry_count,
            total_tokens,
            latency_ms,
            logs
        ) = orchestrator.generate_and_correct(
            question=request.question,
            schema_signature=request.schema_signature,
            tier=request.tier,
            rag_enabled=request.rag_enabled,
            max_retries=request.max_retries
        )
        
        return SQLGenerationResponse(
            success=execution_success,
            final_sql=final_sql,
            data=final_data,
            retries=retry_count,
            api_requests_count=attempt_count,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            logs=logs
        )
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
