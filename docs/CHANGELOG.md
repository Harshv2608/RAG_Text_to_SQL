# Changelog

All notable changes to the InsightSQL project will be documented in this file.

## [Unreleased] - Phase 1 Complete
### Added
- Initial workspace scaffolding.
- `.env.example` defining `LLM_PROVIDER=mock` as default and database/infrastructure configuration.
- `docker-compose.yml` with persistent volumes and configurations for PostgreSQL (with healthcheck), Redis, and ChromaDB.
- `docs/CHANGELOG.md` for project history.
- `docs/DECISIONS.md` containing ADR-001 regarding the architectural scaffolding.
- Empty directories for `gateway`, `ai_service`, `benchmark`, `evaluation`, and `frontend`.

## [Unreleased] - Phase 2 Complete
### Added
- Database schema definition (enchmark/schema/schema.sql) including multi-table architecture and read-only execution user scoping.
- Deterministic seed data generator and SQL payload (enchmark/schema/seed.sql) containing 50+ users, events, subscriptions, and payments.
- 	rain_bank.json comprising 30 distinct text-to-SQL examples across 3 complexity tiers for ChromaDB indexing.
- 	est_benchmark.json comprising 30 non-overlapping benchmark questions for final system evaluation.
- erify_benchmark.py testing script ensuring 100% execution success of all queries against the seeded PostgreSQL dataset.

## [Unreleased] - Phase 3 Complete
### Added
- Defined equirements.txt for i_service with FastAPI, Pydantic, and database drivers.
- Initialized Pydantic data models (schemas.py) to govern generation requests, logs, and responses.
- Implemented LLMProvider abstract base class with a working MockLLM handling deterministic failure cycles.
- Built a lightweight SQL SafetyGuard (safety_guard.py) filtering destructive statements and multiline execution.
- Added FastAPI scaffolding (main.py) exposing the foundational /health and /generate endpoints.
- Developed Pytest suite targeting the MockLLM and SafetyGuard components ensuring complete mock execution.

### Phase 4: Self-Correction Loop Engine
- Implemented \SQLOrchestrator\ in \i_service/app/core/orchestrator.py\ for deterministic self-correction testing.
- Implemented read-only \PostgresExecutor\ in \i_service/app/db/postgres.py\.
- Added full test suite in \i_service/tests/test_phase4.py\ covering success, max retries, execution failure routing, and token counting.

### Phase 5: Vector Database & Few-Shot RAG
- Integrated ChromaDB via \ChromaClient\.
- Implemented strict train/test isolation inside ingestion validating authoritative benchmark files.
- Integrated RAG retrieval mapping perfectly into orchestrator execution (injecting top_k=3) strictly when rag_enabled=True.

### Phase 6: Gateway & Job Queue Infrastructure
- Created Node.js Express server (\gateway/\) with Zod input validation.
- Integrated BullMQ with IORedis to asynchronously queue jobs without blocking the main event loop.
- Defined a passthrough worker (\sqlWorker\) that proxies requests symmetrically to the Python \/orchestrate\ layer.

### Phase 6: Corrective Maintenance (Revalidation)
- Aligned API endpoints to specification: \/query\, \/eval\, \/metrics\, \/health\.
- Added idempotent queue handling for evaluation benchmarks (\jobId\ mapped to \question_id\).
- Fully integrated Gateway worker to route \/orchestrate\ payloads to the Python AI service.
- Validated complete asynchronous end-to-end integration via Redis and Python FastAPI tests.

### Phase 7: Interactive Frontend Layer
- Initialized Vite + React (TypeScript) frontend application.
- Styled with TailwindCSS emphasizing a premium glassmorphism dark aesthetic.
- Created LiveRunner page for real-time visualization of the AI self-correction retry ladder.
- Created EvalDashboard page with polling queue status and Recharts-based data visualization.
- Strictly enforced React as a pure presentational and state layer, isolating all LLM and RAG logic behind the Gateway APIs.

### Phase 7 Corrective Maintenance
- Reconciled API contracts to remove obsolete '/api' prefixes.
- Expanded Frontend Test Suite to explicitly cover rendering of the Retry Ladder, Eval Dashboard aggregations, and Layout health polling.
- Implemented real experimental metric aggregation via GET /benchmark/summary in Node Gateway.
- Forced POST /eval to deterministically enqueue the 60-run factorial permutations by reading 	est_benchmark.json securely from the backend.
- Standardized health schema parity to { status, services: { gateway, redis, ai_service } }.

### Phase 8 Testing & Replay Architecture
- Implemented ReplayLLM to read fixtures and simulate deterministic multi-turn AI responses without calling Gemini.
- Added robust fallback/quarantine logic to GeminiLLM and test-suite-wide intercepts preventing accidental live API usage.
- Replaced mocked-infra tests with a true E2E Node.js test dispatching 60 factorial jobs through Redis/BullMQ to FastAPI.
- Enforced automated invariants ensuring RAG seeds (k=3/0) and dataset leakage strictly remain uncompromised.
