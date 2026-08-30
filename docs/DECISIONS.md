# Architectural Decision Records

## ADR-001: Architecture Scaffolding and Mock-First Development
**Date:** 2026-08-30
**Status:** Accepted

### Context
InsightSQL is an empirical research testbed for measuring RAG-augmented self-correction in text-to-SQL agents. To ensure rigorous evaluation without unintentional cost or data leakage, we need an isolated infrastructure setup.

### Decision
1. **Containerized Infrastructure:** We will use Docker Compose to manage PostgreSQL (SaaS schema), Redis (BullMQ queue), and ChromaDB (vector store). Persistent volumes are defined to prevent data loss across restarts.
2. **Mock-First API Strategy:** `LLM_PROVIDER=mock` is the strict default in `.env.example`. External LLM APIs (e.g., Gemini) are quarantined until the final phase.
3. **Multi-User Database Access:** We define an admin connection for migrations/seeding and a strict `insights_readonly` user for query execution to mitigate prompt injection risks structurally.

### Consequences
- Requires developers and test harnesses to actively supply mock/fixture responses for early phases.
- Simplifies local reproducibility and removes the barrier to entry (no immediate API key needed).

## ADR-002: Deterministic Data Generation and Train/Test Disjunction
**Date:** 2026-08-30
**Status:** Accepted

### Context
To accurately measure the impact of RAG on SQL generation without data leakage, the few-shot examples presented to the model (via ChromaDB) and the final evaluation benchmark must be strictly isolated. Additionally, robust multi-tier complexity requires relational depth (joins, aggregations) that cannot be modeled well in a flat table.

### Decision
1. **Schema & Seed:** We use a realistic multi-table SaaS schema (Users, Events, Subscriptions, Payments). The data is generated programmatically but loaded deterministically via a static seed.sql to guarantee repeatability across trial runs.
2. **Data Leakage Prevention:** We constructed exactly 30 training questions and 30 distinct testing questions. The two datasets share no overlapping questions, ensuring that RAG effectiveness is measured on unseen generalization rather than memorized retrieval.
3. **Execution Validation:** Every single gold SQL query was run against the actual seeded Postgres database to guarantee that the benchmark target is syntactically valid and produces a result set.

### Consequences
- Eliminates silent failures caused by syntactically invalid "gold" reference queries.
- Ensures the 60-run evaluation harness is operating on scientifically sound ground truth.

## ADR-003: LLM Provider Abstraction and Zero-Cost Mock Strategy
**Date:** 2026-08-30
**Status:** Accepted

### Context
Building applications that depend heavily on external LLM APIs (like Gemini) introduces latency, unreliability during testing, and development cost. Furthermore, a non-deterministic API response makes unit-testing a "self-correction" engine almost impossible. 

### Decision
We engineered a strict LLMProvider abstraction layer where MockLLM serves as the absolute default. The mock provider is programmed to intentionally fail in a predictable cycle (e.g., attempt 1 fails the safety check, attempt 2 has a syntax error, attempt 3 succeeds). 

### Consequences
- Allows full functional unit testing of the Orchestrator without spending API credits or facing rate limits.
- Guarantees the CI/CD pipeline and automated evaluation loops run consistently.

## ADR-004: Self-Correction Loop without RAG
**Date:** 2026-08-30
**Decision:** The orchestrator loop was implemented strictly around SQL generation, safety validation, and DB execution retry routing. RAG contextual injection has been intentionally deferred to Phase 5 to strictly maintain phase isolation. Metrics generated include granular attempt counts, retry counts, latency, and comprehensive token tracking.

## ADR-005: Strict Train/Test Ingestion Quorum
**Date:** 2026-08-30
**Decision:** To defend against hybrid dataset poisoning (e.g. 20 train + 10 test), ChromaClient.populate() forces cross-referencing against the original authoritative benchmark files. It guarantees precisely 30 records ingested mirroring 'train_bank.json' and checks 0% intersection against 'test_benchmark.json' IDs, questions, and SQLs prior to population.

## ADR-006: Asynchronous Job Queue Architecture via BullMQ/Redis
**Date:** 2026-08-30
**Decision:** The Node.js Gateway strictly operates as a dumb async router. AI logic, prompt configuration, and agent state loops are strictly banned from this layer. Both /api/query (interactive) and /api/eval/batch (background execution) deposit payloads into a standard BullMQ queue. The BullMQ worker transparently forwards these payloads via Axios to the Python FastAPI service. This insulates the Node.js event loop from the heavy LLM retry latencies (which can spike dramatically due to safety rejections and multiple API cycles).

## ADR-007: Frontend State Polling & Step-Ladder Visualizer
**Date:** 2026-08-30
**Decision:** The React frontend will maintain zero local AI logic. It triggers jobs via REST (/api/query, /api/eval) and uses interval polling (GET /api/query/:jobId/status) to track background worker progress. The UI dynamically renders the 'Retry Ladder' visualization directly from the Python orchestrator's execution log array.
**Rationale:** Isolates the presentation layer from the AI infrastructure. Polling aligns with the asynchronous Gateway + BullMQ architectural design. Directly visualizing the logs array ensures strict accuracy for the formula Retry Count = max(0, Attempt Count - 1).

## ADR-008: Factorial Batch Orchestration and Metric Aggregation
**Date:** 2026-08-30
**Decision:** The frontend Evaluation Dashboard requests POST /eval, which triggers the Gateway to securely read 	est_benchmark.json and deterministically enqueue 60 permutations (30 questions x 2 RAG states). Experimental metrics are calculated directly by querying BullMQ job returns via GET /benchmark/summary.
**Rationale:** Prevents frontend manipulation of experimental inputs and ensures the 2x3 factorial design enforces strict job deduping IDs, protecting the integrity of the research metrics.

## ADR-009: Zero-Cost Testing Architecture, Replay Fixtures, and Research Hardening
**Date:** 2026-08-30
**Decision:** We adopt a strict zero-cost testing architecture by enforcing a global pytest invariant that blocks live Gemini API calls unless LLM_PROVIDER=gemini is explicitly set. We introduced ReplayLLM (fixture-based multi-turn responses) and expanded MockLLM to deterministically output safety/syntax failures. An unmocked E2E integration test validates the queue mechanics.
**Rationale:** This guarantees offline reproducibility and protects project budgets while ensuring rigorous regression testing of factorial RAG variables and error-recovery behaviors.
