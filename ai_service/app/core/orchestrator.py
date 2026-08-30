import time
from typing import Dict, Any, Tuple, Optional, List
from ai_service.app.core.llm_provider import LLMProvider
from ai_service.app.core.safety_guard import check
from ai_service.app.models.schemas import ExecutionLog

class SQLOrchestrator:
    def __init__(self, llm_provider: LLMProvider, db_executor: Any, chroma_client: Optional[Any] = None):
        self.llm = llm_provider
        self.db = db_executor
        self.chroma = chroma_client

    def generate_and_correct(
        self, 
        question: str, 
        schema_signature: str, 
        tier: int, 
        rag_enabled: bool = False,
        max_retries: int = 5
    ) -> Tuple[bool, bool, str, Optional[List[Dict[str, Any]]], int, int, int, float, List[ExecutionLog]]:
        
        # Base prompt mapping
        base_prompt = f"Schema: {schema_signature}\nQuestion: {question}\nGenerate a PostgreSQL query."
        system_instruction = "You are an expert PostgreSQL developer. Return only valid JSON with a 'sql' key."
        
        if rag_enabled and self.chroma:
            examples = self.chroma.retrieve(question, top_k=3)
            if examples:
                few_shot_str = "\n\n".join([f"Example Question: {ex['question']}\nExample SQL: {ex['gold_sql']}" for ex in examples])
                base_prompt = f"Here are some examples of similar queries:\n{few_shot_str}\n\n{base_prompt}"
        
        prompt = base_prompt
        
        execution_success = False
        result_correct = False
        final_sql = ""
        final_data = None
        
        total_in_tokens = 0
        total_out_tokens = 0
        logs = []
        
        start_time = time.time()
        attempt = 1
        max_attempts = max_retries  # exactly 5 total LLM generation attempts
        
        while attempt <= max_attempts:
            # 1. Generate SQL
            llm_resp, in_t, out_t = self.llm.generate_sql(prompt, system_instruction)
            
            total_in_tokens += in_t
            total_out_tokens += out_t
            
            sql = llm_resp.get("sql", "")
            final_sql = sql
            
            # 2. Run safety guard
            guard_result = check(sql)
            if not guard_result.passed:
                logs.append(ExecutionLog(
                    attempt_number=attempt,
                    generated_sql=sql,
                    status="rejected_safety",
                    error_message=guard_result.reason,
                    tokens_used=in_t + out_t,
                    latency_ms=0.0 # Detailed attempt latency simplified for this prototype
                ))
                prompt = base_prompt + f"\n\nPREVIOUS ATTEMPT REJECTED BY GUARD: {guard_result.reason}. Fix the SQL."
                attempt += 1
                continue
                
            # 3. Execute against read-only DB
            db_success, data, db_err = self.db.execute(sql)
            if not db_success:
                logs.append(ExecutionLog(
                    attempt_number=attempt,
                    generated_sql=sql,
                    status="rejected_execution",
                    error_message=db_err,
                    tokens_used=in_t + out_t,
                    latency_ms=0.0
                ))
                prompt = base_prompt + f"\n\nPREVIOUS ATTEMPT FAILED WITH DB ERROR: {db_err}. Fix the SQL."
                attempt += 1
                continue
                
            # 4. Immediate execution success
            execution_success = True
            final_data = data
            logs.append(ExecutionLog(
                attempt_number=attempt,
                generated_sql=sql,
                status="success",
                error_message=None,
                tokens_used=in_t + out_t,
                latency_ms=0.0
            ))
            break
            
        latency_ms = (time.time() - start_time) * 1000.0
        
        # Result correctness is evaluated upstream by the evaluation harness.
        # For the orchestrator's perspective, successful DB execution is treated as the goal.
        result_correct = execution_success
        
        attempt_count = min(attempt, max_attempts)
        retry_count = max(0, attempt_count - 1)
        total_tokens = total_in_tokens + total_out_tokens
        
        return (
            execution_success,
            result_correct,
            final_sql,
            final_data,
            attempt_count,
            retry_count,
            total_tokens,
            latency_ms,
            logs
        )
