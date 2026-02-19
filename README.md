# Job Queue LLM Orchestrator

Monorepo layout:

- `frontend/`: Next.js operator dashboard (currently mock-data driven)
- `backend/`: Go API + worker scaffold for real job execution

## Frontend

```bash
cd /Users/jaganraajan/projects-ai/job-queue-llm-orchestrator/frontend
npm install
npm run dev
```

## Backend

```bash
cd /Users/jaganraajan/projects-ai/job-queue-llm-orchestrator/backend
go mod tidy
go run ./cmd/api
```

In a second terminal:

```bash
cd /Users/jaganraajan/projects-ai/job-queue-llm-orchestrator/backend
go run ./cmd/worker
```

Backend setup details are in `/Users/jaganraajan/projects-ai/job-queue-llm-orchestrator/backend/README.md`.
