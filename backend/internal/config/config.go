package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPAddr          string
	DatabaseURL       string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	ReadyQueueKey     string
	LeaseTTL          time.Duration
	WorkerID          string
	WorkerConcurrency int
	ProviderTimeout   time.Duration
}

func Load() Config {
	return Config{
		HTTPAddr:          envString("HTTP_ADDR", ":8080"),
		DatabaseURL:       envString("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/job_queue?sslmode=disable"),
		RedisAddr:         envString("REDIS_ADDR", "localhost:6379"),
		RedisPassword:     envString("REDIS_PASSWORD", ""),
		RedisDB:           envInt("REDIS_DB", 0),
		ReadyQueueKey:     envString("REDIS_READY_QUEUE_KEY", "queue:ready"),
		LeaseTTL:          envDuration("JOB_LEASE_TTL", 30*time.Second),
		WorkerID:          envString("WORKER_ID", "worker-1"),
		WorkerConcurrency: envInt("WORKER_CONCURRENCY", 1),
		ProviderTimeout:   envDuration("PROVIDER_TIMEOUT", 8*time.Second),
	}
}

func envString(key string, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
