package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	// "time"

	"job-queue-llm-orchestrator/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}

	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) Close() {
	s.pool.Close()
}

func (s *PostgresStore) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *PostgresStore) CreateJob(ctx context.Context, input models.CreateJobInput) (models.Job, bool, error) {
	job := models.Job{}

	if input.Priority <= 0 {
		input.Priority = 3
	}
	if input.MaxAttempts <= 0 {
		input.MaxAttempts = 3
	}
	if len(input.PayloadJSON) == 0 {
		input.PayloadJSON = json.RawMessage(`{}`)
	}

	jobID := uuid.NewString()
	traceID := uuid.NewString()
	var idempotency any
	if input.IdempotencyKey != "" {
		idempotency = input.IdempotencyKey
	}

	query := `
INSERT INTO jobs (
	id, tenant_id, status, priority, model, payload_json, idempotency_key, attempt, max_attempts, created_at, trace_id
)
VALUES ($1, $2, 'queued', $3, $4, $5, $6, 0, $7, now(), $8)
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
RETURNING id, tenant_id, status, priority, model, payload_json, COALESCE(idempotency_key, ''), attempt, max_attempts, created_at, started_at, finished_at, COALESCE(error_code, ''), COALESCE(error_message, ''), trace_id
`
	err := s.pool.QueryRow(
		ctx,
		query,
		jobID,
		input.TenantID,
		input.Priority,
		input.Model,
		[]byte(input.PayloadJSON),
		idempotency,
		input.MaxAttempts,
		traceID,
	).Scan(
		&job.ID,
		&job.TenantID,
		&job.Status,
		&job.Priority,
		&job.Model,
		&job.PayloadJSON,
		&job.IdempotencyKey,
		&job.Attempt,
		&job.MaxAttempts,
		&job.CreatedAt,
		&job.StartedAt,
		&job.FinishedAt,
		&job.ErrorCode,
		&job.ErrorMessage,
		&job.TraceID,
	)
	if err == nil {
		if err := s.appendEvent(ctx, "job.created", &job.ID, nil, "Job accepted via POST /v1/jobs"); err != nil {
			return models.Job{}, false, err
		}
		return job, false, nil
	}

	if !errors.Is(err, pgx.ErrNoRows) {
		return models.Job{}, false, fmt.Errorf("insert job: %w", err)
	}

	if input.IdempotencyKey == "" {
		return models.Job{}, false, fmt.Errorf("job conflict without idempotency key: %w", err)
	}

	existing, err := s.getJobByTenantAndIdempotency(ctx, input.TenantID, input.IdempotencyKey)
	if err != nil {
		return models.Job{}, false, err
	}
	return existing, true, nil
}

func (s *PostgresStore) GetJobByID(ctx context.Context, jobID string) (models.Job, *models.JobAttempt, error) {
	job, err := s.getJobByID(ctx, jobID)
	if err != nil {
		return models.Job{}, nil, err
	}

	attempt, err := s.getLatestAttempt(ctx, jobID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return models.Job{}, nil, err
	}
	if errors.Is(err, ErrNotFound) {
		return job, nil, nil
	}

	return job, &attempt, nil
}

func (s *PostgresStore) MarkJobRunning(ctx context.Context, jobID string, workerID string) (models.Job, bool, error) {
	job := models.Job{}
	query := `
UPDATE jobs
SET status = 'running', started_at = now(), attempt = attempt + 1, error_code = null, error_message = null
WHERE id = $1 AND status = 'queued'
RETURNING id, tenant_id, status, priority, model, payload_json, COALESCE(idempotency_key, ''), attempt, max_attempts, created_at, started_at, finished_at, COALESCE(error_code, ''), COALESCE(error_message, ''), trace_id
`
	err := s.pool.QueryRow(ctx, query, jobID).Scan(
		&job.ID,
		&job.TenantID,
		&job.Status,
		&job.Priority,
		&job.Model,
		&job.PayloadJSON,
		&job.IdempotencyKey,
		&job.Attempt,
		&job.MaxAttempts,
		&job.CreatedAt,
		&job.StartedAt,
		&job.FinishedAt,
		&job.ErrorCode,
		&job.ErrorMessage,
		&job.TraceID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Job{}, false, nil
	}
	if err != nil {
		return models.Job{}, false, fmt.Errorf("mark running: %w", err)
	}

	if _, err := s.pool.Exec(
		ctx,
		`INSERT INTO job_attempts (job_id, attempt, started_at) VALUES ($1, $2, now())
		 ON CONFLICT (job_id, attempt) DO UPDATE SET started_at = excluded.started_at`,
		job.ID,
		job.Attempt,
	); err != nil {
		return models.Job{}, false, fmt.Errorf("insert job attempt start: %w", err)
	}

	if err := s.appendEvent(ctx, "job.started", &job.ID, &workerID, "Dequeued and started"); err != nil {
		return models.Job{}, false, err
	}

	return job, true, nil
}

func (s *PostgresStore) MarkJobSucceeded(ctx context.Context, jobID string, workerID string, tokens int, costUSD float64, providerMeta json.RawMessage) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var attempt int
	err = tx.QueryRow(
		ctx,
		`UPDATE jobs
		 SET status = 'succeeded', finished_at = now(), error_code = null, error_message = null
		 WHERE id = $1 AND status = 'running'
		 RETURNING attempt`,
		jobID,
	).Scan(&attempt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("update succeeded: %w", err)
	}

	cmdTag, err := tx.Exec(
		ctx,
		`UPDATE job_attempts
		 SET finished_at = now(), success = true, tokens = $3, cost_usd = $4, provider_meta_json = $5
		 WHERE job_id = $1 AND attempt = $2`,
		jobID,
		attempt,
		tokens,
		costUSD,
		[]byte(providerMeta),
	)
	if err != nil {
		return fmt.Errorf("update job attempt success: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO job_attempts (job_id, attempt, started_at, finished_at, success, tokens, cost_usd, provider_meta_json)
			 VALUES ($1, $2, now(), now(), true, $3, $4, $5)`,
			jobID,
			attempt,
			tokens,
			costUSD,
			[]byte(providerMeta),
		); err != nil {
			return fmt.Errorf("insert missing success attempt row: %w", err)
		}
	}

	if err := appendEventTx(ctx, tx, "job.succeeded", &jobID, &workerID, "Provider returned completion"); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) MarkJobFailed(ctx context.Context, jobID string, workerID string, errorCode string, errorMessage string) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var attempt int
	err = tx.QueryRow(
		ctx,
		`UPDATE jobs
		 SET status = 'failed', finished_at = now(), error_code = $2, error_message = $3
		 WHERE id = $1 AND status = 'running'
		 RETURNING attempt`,
		jobID,
		errorCode,
		errorMessage,
	).Scan(&attempt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("update failed: %w", err)
	}

	cmdTag, err := tx.Exec(
		ctx,
		`UPDATE job_attempts
		 SET finished_at = now(), success = false, error_code = $3, error_message = $4
		 WHERE job_id = $1 AND attempt = $2`,
		jobID,
		attempt,
		errorCode,
		errorMessage,
	)
	if err != nil {
		return fmt.Errorf("update job attempt failed: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO job_attempts (job_id, attempt, started_at, finished_at, success, error_code, error_message)
			 VALUES ($1, $2, now(), now(), false, $3, $4)`,
			jobID,
			attempt,
			errorCode,
			errorMessage,
		); err != nil {
			return fmt.Errorf("insert missing failed attempt row: %w", err)
		}
	}

	if err := appendEventTx(ctx, tx, "job.failed", &jobID, &workerID, "Provider execution failed"); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) UpsertWorkerHeartbeat(
	ctx context.Context,
	workerID string,
	state string,
	runningJobID string,
	concurrency int,
) error {
	var runningJob any
	if runningJobID != "" {
		runningJob = runningJobID
	}
	_, err := s.pool.Exec(
		ctx,
		`INSERT INTO workers (worker_id, last_heartbeat_at, state, running_job_id, concurrency)
		 VALUES ($1, now(), $2, $3, $4)
		 ON CONFLICT (worker_id) DO UPDATE
		 SET last_heartbeat_at = excluded.last_heartbeat_at,
		     state = excluded.state,
		     running_job_id = excluded.running_job_id,
		     concurrency = excluded.concurrency`,
		workerID,
		state,
		runningJob,
		concurrency,
	)
	return err
}

func (s *PostgresStore) getJobByID(ctx context.Context, jobID string) (models.Job, error) {
	job := models.Job{}
	err := s.pool.QueryRow(
		ctx,
		`SELECT id, tenant_id, status, priority, model, payload_json, COALESCE(idempotency_key, ''), attempt, max_attempts, created_at, started_at, finished_at, COALESCE(error_code, ''), COALESCE(error_message, ''), trace_id
		 FROM jobs
		 WHERE id = $1`,
		jobID,
	).Scan(
		&job.ID,
		&job.TenantID,
		&job.Status,
		&job.Priority,
		&job.Model,
		&job.PayloadJSON,
		&job.IdempotencyKey,
		&job.Attempt,
		&job.MaxAttempts,
		&job.CreatedAt,
		&job.StartedAt,
		&job.FinishedAt,
		&job.ErrorCode,
		&job.ErrorMessage,
		&job.TraceID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Job{}, ErrNotFound
	}
	if err != nil {
		return models.Job{}, fmt.Errorf("get job by id: %w", err)
	}
	return job, nil
}

func (s *PostgresStore) getJobByTenantAndIdempotency(ctx context.Context, tenantID string, key string) (models.Job, error) {
	job := models.Job{}
	err := s.pool.QueryRow(
		ctx,
		`SELECT id, tenant_id, status, priority, model, payload_json, COALESCE(idempotency_key, ''), attempt, max_attempts, created_at, started_at, finished_at, COALESCE(error_code, ''), COALESCE(error_message, ''), trace_id
		 FROM jobs
		 WHERE tenant_id = $1 AND idempotency_key = $2`,
		tenantID,
		key,
	).Scan(
		&job.ID,
		&job.TenantID,
		&job.Status,
		&job.Priority,
		&job.Model,
		&job.PayloadJSON,
		&job.IdempotencyKey,
		&job.Attempt,
		&job.MaxAttempts,
		&job.CreatedAt,
		&job.StartedAt,
		&job.FinishedAt,
		&job.ErrorCode,
		&job.ErrorMessage,
		&job.TraceID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Job{}, ErrNotFound
	}
	if err != nil {
		return models.Job{}, fmt.Errorf("get job by tenant + idempotency: %w", err)
	}
	return job, nil
}

func (s *PostgresStore) getLatestAttempt(ctx context.Context, jobID string) (models.JobAttempt, error) {
	attempt := models.JobAttempt{}
	err := s.pool.QueryRow(
		ctx,
		`SELECT job_id, attempt, started_at, finished_at, success, COALESCE(error_code, ''), COALESCE(error_message, ''), tokens, cost_usd, provider_meta_json
		 FROM job_attempts
		 WHERE job_id = $1
		 ORDER BY attempt DESC
		 LIMIT 1`,
		jobID,
	).Scan(
		&attempt.JobID,
		&attempt.Attempt,
		&attempt.StartedAt,
		&attempt.FinishedAt,
		&attempt.Success,
		&attempt.ErrorCode,
		&attempt.ErrorMessage,
		&attempt.Tokens,
		&attempt.CostUSD,
		&attempt.ProviderMeta,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.JobAttempt{}, ErrNotFound
	}
	if err != nil {
		return models.JobAttempt{}, fmt.Errorf("get latest attempt: %w", err)
	}
	return attempt, nil
}

func (s *PostgresStore) appendEvent(
	ctx context.Context,
	eventType string,
	jobID *string,
	workerID *string,
	details string,
) error {
	_, err := s.pool.Exec(
		ctx,
		`INSERT INTO events (event_type, job_id, worker_id, details, created_at)
		 VALUES ($1, $2, $3, $4, now())`,
		eventType,
		jobID,
		workerID,
		details,
	)
	if err != nil {
		return fmt.Errorf("insert event: %w", err)
	}
	return nil
}

func appendEventTx(
	ctx context.Context,
	tx pgx.Tx,
	eventType string,
	jobID *string,
	workerID *string,
	details string,
) error {
	_, err := tx.Exec(
		ctx,
		`INSERT INTO events (event_type, job_id, worker_id, details, created_at)
		 VALUES ($1, $2, $3, $4, now())`,
		eventType,
		jobID,
		workerID,
		details,
	)
	if err != nil {
		return fmt.Errorf("insert event tx: %w", err)
	}
	return nil
}
