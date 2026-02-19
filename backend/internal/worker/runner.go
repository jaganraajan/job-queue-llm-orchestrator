package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"job-queue-llm-orchestrator/backend/internal/config"
	"job-queue-llm-orchestrator/backend/internal/models"
	"job-queue-llm-orchestrator/backend/internal/queue"
	"job-queue-llm-orchestrator/backend/internal/store"
)

type Runner struct {
	store  *store.PostgresStore
	queue  *queue.RedisQueue
	cfg    config.Config
	logger *slog.Logger
	rng    *rand.Rand
}

func NewRunner(store *store.PostgresStore, queue *queue.RedisQueue, cfg config.Config, logger *slog.Logger) *Runner {
	return &Runner{
		store:  store,
		queue:  queue,
		cfg:    cfg,
		logger: logger,
		rng:    rand.New(rand.NewSource(time.Now().UnixNano())), //nolint:gosec
	}
}

func (r *Runner) Run(ctx context.Context) error {
	state := "idle"
	runningJobID := ""

	heartbeatTicker := time.NewTicker(5 * time.Second)
	defer heartbeatTicker.Stop()

	emitHeartbeat := func() {
		if err := r.store.UpsertWorkerHeartbeat(
			ctx,
			r.cfg.WorkerID,
			state,
			runningJobID,
			r.cfg.WorkerConcurrency,
		); err != nil {
			r.logger.Error("worker heartbeat failed", "error", err)
			return
		}
		r.logger.Debug("heartbeat sent", "state", state, "running_job_id", runningJobID)
	}

	emitHeartbeat()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-heartbeatTicker.C:
			emitHeartbeat()
		default:
		}

		jobID, err := r.queue.DequeueJob(ctx, 2*time.Second)
		if err != nil {
			r.logger.Error("dequeue failed", "error", err)
			time.Sleep(750 * time.Millisecond)
			continue
		}
		if jobID == "" {
			continue
		}

		leaseAcquired, err := r.queue.AcquireLease(ctx, jobID, r.cfg.WorkerID)
		if err != nil {
			r.logger.Error("lease acquisition failed", "job_id", jobID, "error", err)
			continue
		}
		if !leaseAcquired {
			continue
		}

		job, updated, err := r.store.MarkJobRunning(ctx, jobID, r.cfg.WorkerID)
		if err != nil {
			r.logger.Error("mark running failed", "job_id", jobID, "error", err)
			_ = r.queue.ReleaseLease(ctx, jobID)
			continue
		}
		if !updated {
			_ = r.queue.ReleaseLease(ctx, jobID)
			continue
		}

		state = "busy"
		runningJobID = job.ID
		emitHeartbeat()

		runErr := r.executeJob(ctx, job)
		if runErr != nil {
			if err := r.store.MarkJobFailed(ctx, job.ID, r.cfg.WorkerID, "PROVIDER_TIMEOUT", runErr.Error()); err != nil {
				r.logger.Error("mark failed update error", "job_id", job.ID, "error", err)
			}
		} else {
			tokens := 200 + r.rng.Intn(500)
			costUSD := float64(tokens) * 0.00001
			providerMeta := json.RawMessage(`{"provider":"mock-llm","latency_source":"simulated"}`)
			if err := r.store.MarkJobSucceeded(ctx, job.ID, r.cfg.WorkerID, tokens, costUSD, providerMeta); err != nil {
				r.logger.Error("mark success update error", "job_id", job.ID, "error", err)
			}
		}

		if err := r.queue.ReleaseLease(ctx, job.ID); err != nil {
			r.logger.Warn("failed to release lease", "job_id", job.ID, "error", err)
		}

		state = "idle"
		runningJobID = ""
		emitHeartbeat()
	}
}

func (r *Runner) executeJob(ctx context.Context, job models.Job) error {
	providerCtx, cancel := context.WithTimeout(ctx, r.cfg.ProviderTimeout)
	defer cancel()

	latency := time.Duration(500+r.rng.Intn(1400)) * time.Millisecond
	select {
	case <-providerCtx.Done():
		return fmt.Errorf("provider context cancelled: %w", providerCtx.Err())
	case <-time.After(latency):
	}

	// Keep some failed jobs visible while the retry/DLQ phase is pending.
	if r.rng.Float64() < 0.2 {
		return fmt.Errorf("mock provider timeout")
	}

	return nil
}
