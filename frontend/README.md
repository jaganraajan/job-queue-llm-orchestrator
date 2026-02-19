# Job Queue LLM Orchestrator - Mock UI

This workspace now contains a Next.js mock operator UI based on `JobQueueLLMOrchestratroPLAN.md`.

## Implemented routes

- `/dashboard` global KPI cards + queue pause/resume + realtime event feed
- `/jobs` searchable/filterable jobs table with retry/cancel actions
- `/jobs/[id]` job detail panel with timeline and execution metadata
- `/workers` heartbeat + load + restart visibility
- `/dlq` grouped DLQ reasons with replay controls
- `/settings/tenants` editable tenant concurrency/RPS/token budgets

## Mock behavior

- In-memory store simulates job lifecycle transitions every 5 seconds
- Queue pause/resume impacts lifecycle movement
- Retry and DLQ replay actions mutate shared state across pages

## Run

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).
