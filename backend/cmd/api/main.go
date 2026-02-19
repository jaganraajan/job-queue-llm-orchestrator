package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"job-queue-llm-orchestrator/backend/internal/config"
	"job-queue-llm-orchestrator/backend/internal/httpapi"
	"job-queue-llm-orchestrator/backend/internal/jobs"
	"job-queue-llm-orchestrator/backend/internal/queue"
	"job-queue-llm-orchestrator/backend/internal/store"
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

	healthCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	if err := postgresStore.Ping(healthCtx); err != nil {
		cancel()
		logger.Error("postgres ping failed", "error", err)
		os.Exit(1)
	}
	if err := redisQueue.Ping(healthCtx); err != nil {
		cancel()
		logger.Error("redis ping failed", "error", err)
		os.Exit(1)
	}
	cancel()

	jobService := jobs.NewService(postgresStore, redisQueue, logger)
	apiServer := httpapi.NewServer(jobService)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           apiServer.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("api listening", "addr", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("api server exited with error", "error", err)
			stop()
		}
	}()

	<-ctx.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("api shutdown failed", "error", err)
	}
}
