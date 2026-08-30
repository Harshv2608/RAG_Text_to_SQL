# Zero-Cost Testing & Reproducibility Guide (Phase 8)

This document outlines how any researcher or developer can clone InsightSQL and run the full verification suite without requiring a Gemini API key or consuming API quota.

## Architecture

InsightSQL leverages a **Zero-Cost Local Architecture** through robust polymorphic `LLMProvider` abstractions:

1. **MockLLM**: Generates deterministic sequences of failures (Safety Fail -> Syntax Fail -> Success) to heavily test the orchestrator's retry and token-accumulation logic.
2. **ReplayLLM**: Reads from `evaluation/fixtures/responses.json` to deterministically replay known multi-turn interactions.
3. **Zero-Call Invariant**: A global `pytest` fixture intercepts any instantiation of the `google.genai.Client` and throws a `RuntimeError`, guaranteeing that no live API calls are accidentally made during CI/CD.

## Running the E2E Validation Suite (Offline)

### 1. Start Local Infrastructure
Start the Docker containers (PostgreSQL and Redis):
```bash
docker-compose up -d
# OR manually
docker run -d --name insightsql_postgres -p 5432:5432 postgres:15-alpine
docker run -d --name insightsql_redis -p 6379:6379 redis:alpine
```

### 2. Start Services
Ensure `.env` sets `LLM_PROVIDER=mock`.

Start the Python AI Service:
```bash
cd ai_service
export PYTHONPATH=".."
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the Node.js Gateway and Worker:
```bash
cd gateway
npm run build
npm start # Starts both index.js and worker.js
# Or use ts-node-dev for development
npx ts-node --transpileOnly src/index.ts
npx ts-node --transpileOnly src/queue/worker.ts
```

### 3. Execute Suites
Run the Node.js Test Suite:
```bash
cd gateway
npm test
```

Run the React Test Suite:
```bash
cd frontend
npm run test -- --run
```

Run the Python AI Test Suite:
```bash
cd ai_service
python -m pytest tests -v
```

This full suite validates the RAG data pipelines, queue idempotency, orchestrator logic, and frontend visualization without a single API call.
