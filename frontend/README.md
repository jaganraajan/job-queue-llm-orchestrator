# Job Queue LLM Orchestrator - Frontend

This Next.js UI now uses the Go backend for job creation and job reads.

## Implemented routes

- `/dashboard` global KPI cards + queue pause/resume + realtime event feed
- `/jobs` backend-connected jobs table + create job form
- `/jobs/[id]` backend-connected job detail panel
- `/workers` heartbeat + load + restart visibility
- `/dlq` grouped DLQ reasons with replay controls
- `/settings/tenants` editable tenant concurrency/RPS/token budgets

## Data sources

- `/jobs` and `/jobs/[id]` call frontend API routes:
  - `GET /api/v1/jobs` -> backend `GET /v1/jobs`
  - `POST /api/v1/jobs` -> backend `POST /v1/jobs`
  - `GET /api/v1/jobs/:id` -> backend `GET /v1/jobs/:id`
- Other pages still use mock in-memory state until corresponding backend endpoints are implemented.

Backend URL defaults to `http://localhost:8080` and can be changed with:

`BACKEND_URL=http://localhost:8080`

## Run

```bash
cd /Users/jaganraajan/projects-ai/job-queue-llm-orchestrator/frontend
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).
