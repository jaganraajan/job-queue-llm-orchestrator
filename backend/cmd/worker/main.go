package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"job-queue-llm-orchestrator/backend/internal/config"
	"job-queue-llm-orchestrator/backend/internal/queue"
	"job-queue-llm-orchestrator/backend/internal/store"
	"job-queue-llm-orchestrator/backend/internal/worker"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	postgresStore, err := store.NewPostgresStore(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("failed to init postgres store", "error", err)
		os.Exit(1)
	}
	defer postgresStore.Close()

	redisQueue := queue.NewRedisQueue(
		cfg.RedisAddr,
		cfg.RedisPassword,
		cfg.RedisDB,
		cfg.ReadyQueueKey,
		cfg.LeaseTTL,
	)
	defer redisQueue.Close() //nolint:errcheck

	runner := worker.NewRunner(postgresStore, redisQueue, cfg, logger)
	logger.Info("worker started", "worker_id", cfg.WorkerID)

	if err := runner.Run(ctx); err != nil {
		logger.Error("worker exited with error", "error", err)
		os.Exit(1)
	}
}
