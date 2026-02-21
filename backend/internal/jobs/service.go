package jobs

import (
	"context"
	"fmt"
	"log/slog"

	"job-queue-llm-orchestrator/backend/internal/models"
	"job-queue-llm-orchestrator/backend/internal/queue"
	"job-queue-llm-orchestrator/backend/internal/store"
)

type Service struct {
	store  *store.PostgresStore
	queue  *queue.RedisQueue
	logger *slog.Logger
}

func NewService(store *store.PostgresStore, queue *queue.RedisQueue, logger *slog.Logger) *Service {
	return &Service{
		store:  store,
		queue:  queue,
		logger: logger,
	}
}

func (s *Service) CreateJob(ctx context.Context, input models.CreateJobInput) (models.Job, bool, error) {
	job, existing, err := s.store.CreateJob(ctx, input)
	if err != nil {
		return models.Job{}, false, err
	}

	if !existing {
		if err := s.queue.EnqueueJob(ctx, job.ID); err != nil {
			return models.Job{}, false, fmt.Errorf("enqueue job: %w", err)
		}
	}

	return job, existing, nil
}

func (s *Service) GetJob(ctx context.Context, jobID string) (models.JobSnapshot, error) {
	job, latestAttempt, err := s.store.GetJobByID(ctx, jobID)
	if err != nil {
		return models.JobSnapshot{}, err
	}
	return models.JobSnapshot{
		Job:           job,
		LatestAttempt: latestAttempt,
	}, nil
}

func (s *Service) ListJobs(ctx context.Context, status string, tenantID string, model string, limit int) ([]models.Job, error) {
	return s.store.ListJobs(ctx, status, tenantID, model, limit)
}

func (s *Service) Store() *store.PostgresStore {
	return s.store
}
