export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retry_scheduled"
  | "dlq"
  | "cancelled";

export type EventType =
  | "job.created"
  | "job.started"
  | "job.succeeded"
  | "job.failed"
  | "job.retry_scheduled"
  | "job.moved_dlq"
  | "worker.heartbeat"
  | "queue.paused"
  | "queue.resumed";

export type Job = {
  id: string;
  tenantId: string;
  status: JobStatus;
  priority: number;
  model: string;
  payloadSummary: string;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  traceId: string;
  tokens: number;
  costUsd: number;
  nextRunAt?: string;
};

export type Worker = {
  workerId: string;
  state: "idle" | "busy" | "unhealthy";
  lastHeartbeatAt: string;
  runningJobId?: string;
  concurrency: number;
  activeSlots: number;
  restartCount: number;
};

export type TenantLimit = {
  tenantId: string;
  concurrency: number;
  rps: number;
  tokenBudgetPerMin: number;
};

export type EventRecord = {
  id: string;
  type: EventType;
  at: string;
  jobId?: string;
  workerId?: string;
  details: string;
};

export type MetricsSummary = {
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  retryRate: number;
  dlqSize: number;
  p95LatencyMs: number;
};

export type MockState = {
  queuePaused: boolean;
  jobs: Job[];
  workers: Worker[];
  tenantLimits: TenantLimit[];
  events: EventRecord[];
};
