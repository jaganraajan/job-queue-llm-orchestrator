package models

import (
	"encoding/json"
	"time"
)

type JobStatus string

const (
	JobStatusQueued         JobStatus = "queued"
	JobStatusRunning        JobStatus = "running"
	JobStatusSucceeded      JobStatus = "succeeded"
	JobStatusFailed         JobStatus = "failed"
	JobStatusRetryScheduled JobStatus = "retry_scheduled"
	JobStatusDLQ            JobStatus = "dlq"
	JobStatusCancelled      JobStatus = "cancelled"
)

type Job struct {
	ID             string          `json:"id"`
	TenantID       string          `json:"tenant_id"`
	Status         JobStatus       `json:"status"`
	Priority       int             `json:"priority"`
	Model          string          `json:"model"`
	PayloadJSON    json.RawMessage `json:"payload_json"`
	IdempotencyKey string          `json:"idempotency_key,omitempty"`
	Attempt        int             `json:"attempt"`
	MaxAttempts    int             `json:"max_attempts"`
	CreatedAt      time.Time       `json:"created_at"`
	StartedAt      *time.Time      `json:"started_at,omitempty"`
	FinishedAt     *time.Time      `json:"finished_at,omitempty"`
	ErrorCode      string          `json:"error_code,omitempty"`
	ErrorMessage   string          `json:"error_message,omitempty"`
	TraceID        string          `json:"trace_id"`
}

type JobAttempt struct {
	JobID        string          `json:"job_id"`
	Attempt      int             `json:"attempt"`
	StartedAt    *time.Time      `json:"started_at,omitempty"`
	FinishedAt   *time.Time      `json:"finished_at,omitempty"`
	Success      *bool           `json:"success,omitempty"`
	ErrorCode    string          `json:"error_code,omitempty"`
	ErrorMessage string          `json:"error_message,omitempty"`
	Tokens       int             `json:"tokens,omitempty"`
	CostUSD      float64         `json:"cost_usd,omitempty"`
	ProviderMeta json.RawMessage `json:"provider_meta,omitempty"`
}

type JobSnapshot struct {
	Job           Job         `json:"job"`
	LatestAttempt *JobAttempt `json:"latest_attempt,omitempty"`
}

type CreateJobInput struct {
	TenantID       string
	Priority       int
	Model          string
	PayloadJSON    json.RawMessage
	IdempotencyKey string
	MaxAttempts    int
}
