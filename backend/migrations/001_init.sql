CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'retry_scheduled', 'dlq', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 3,
    model TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    idempotency_key TEXT,
    attempt INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    trace_id TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tenant_idempotency
ON jobs (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS job_attempts (
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    attempt INTEGER NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    success BOOLEAN,
    error_code TEXT,
    error_message TEXT,
    tokens INTEGER DEFAULT 0,
    cost_usd DOUBLE PRECISION DEFAULT 0,
    provider_meta_json JSONB,
    PRIMARY KEY (job_id, attempt)
);

CREATE TABLE IF NOT EXISTS workers (
    worker_id TEXT PRIMARY KEY,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    state TEXT NOT NULL,
    running_job_id TEXT,
    concurrency INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tenant_limits (
    tenant_id TEXT PRIMARY KEY,
    concurrency INTEGER NOT NULL,
    rps INTEGER NOT NULL,
    token_budget_per_min INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    job_id TEXT,
    worker_id TEXT,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_job_id ON events (job_id);
