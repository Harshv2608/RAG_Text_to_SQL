# RAG Text-to-SQL Benchmark

An experimental framework designed to answer the central research question:
**"Does RAG (Retrieval-Augmented Generation) improve Text-to-SQL performance across varying levels of query difficulty?"**

## Architecture

This system uses a modern, multi-tier stack:
1. **Frontend**: React + Vite + Tailwind CSS.
2. **Gateway**: Node.js + Express (handles dispatching, routing, and database tracking).
3. **Queue**: Redis + BullMQ (handles robust queueing and retries for rate-limit protection).
4. **AI Service**: Python + FastAPI (integrates with Google Gemini API to generate SQL).
5. **Execution Engine**: PostgreSQL (executes the generated SQL to verify absolute correctness).
6. **State Tracking**: SQLite (`benchmark_results.sqlite`) tracks all experimental states durably.

## Running the Project Locally (One-Click)

We have containerized the entire architecture so you don't need to manually start every service.

**Prerequisites:**
- Docker and Docker Compose installed.
- A `.env` file at the root with your `GOOGLE_API_KEY`.

**To Start Everything:**
```bash
docker compose up --build -d
```
*This will spin up Postgres, Redis, the Python AI Service, the Node Gateway, the Node Worker, and the Vite Frontend.*

**To View the Dashboard:**
Open your browser and navigate to:
[http://localhost:5173](http://localhost:5173)

**To Stop Everything:**
```bash
docker compose down
```

## How to Execute the Experiment

The dashboard provides 6 manual "Dispatch" buttons for maximum granular control.

1. Start your local stack using Docker Compose.
2. Go to the **Eval Dashboard** at `http://localhost:5173/eval`.
3. You will see 3 tiers:
   - **Tier 1** (Easy Queries)
   - **Tier 2** (Medium Queries)
   - **Tier 3** (Difficult Queries)
4. For each tier, click **RAG OFF** to execute the control group for that tier.
5. Click **RAG ON** to execute the experimental group for that tier.
6. The dashboard will live-update, calculating tokens, latency, retries, and the exact success-rate delta between RAG OFF and RAG ON.
7. If your Gemini API quota hits a `429`, the system will safely pause. You can simply click the button again the next day to resume precisely where you left off.

## Research Protocol
The experiment maintains strictly 60 conditions (3 tiers × 2 RAG states × 10 questions).
A condition marked as `quota_interrupted` is not a model failure and will be safely preserved until quota resets.
