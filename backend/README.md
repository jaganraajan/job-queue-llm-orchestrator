# Backend (Go)

This folder contains the first backend slice:

- API service: `GET /v1/jobs`, `POST /v1/jobs`, `GET /v1/jobs/{id}`, `GET /healthz`
- Redis ready queue + lease key support
- Worker process that dequeues and executes jobs
- Postgres persistence for jobs, attempts, worker heartbeats, events

## Environment

Set env vars (or rely on defaults):

```bash
export HTTP_ADDR=:8080
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_queue?sslmode=disable
export REDIS_ADDR=localhost:6379
export REDIS_PASSWORD=
export REDIS_DB=0
export REDIS_READY_QUEUE_KEY=queue:ready
export JOB_LEASE_TTL=30s
export WORKER_ID=worker-1
export WORKER_CONCURRENCY=1
export PROVIDER_TIMEOUT=8s
```

## Database Migration

Apply:

`/Users/jaganraajan/projects-ai/job-queue-llm-orchestrator/backend/migrations/001_init.sql`

with your migration tool or `psql`.

## Run

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

## Quick API Check

Create a job:

```bash
curl -i -X POST http://localhost:8080/v1/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-1" \
  -d '{
    "tenant_id":"acme",
    "priority":5,
    "model":"gpt-4.1-mini",
    "payload":{"prompt":"Summarize this incident."},
    "max_attempts":3
  }'
```

Fetch it:

```bash
curl -s http://localhost:8080/v1/jobs/<job_id>
```
