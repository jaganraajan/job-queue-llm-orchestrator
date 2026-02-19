import { Job, MockState, TenantLimit, Worker } from "@/lib/types";

const now = Date.now();

const minutesAgo = (minutes: number): string =>
  new Date(now - minutes * 60_000).toISOString();

const makeJob = (partial: Partial<Job> & Pick<Job, "id" | "tenantId" | "status">): Job => ({
  priority: 3,
  model: "gpt-4.1-mini",
  payloadSummary: "Summarize support escalation transcript",
  idempotencyKey: `idem-${partial.id}`,
  attempt: 0,
  maxAttempts: 3,
  createdAt: minutesAgo(40),
  traceId: `trace-${partial.id}`,
  tokens: 0,
  costUsd: 0,
  ...partial
});

export const seedJobs = (): Job[] => [
  makeJob({
    id: "job_1001",
    tenantId: "acme",
    status: "queued",
    priority: 5,
    createdAt: minutesAgo(2),
    payloadSummary: "Classify inbound legal request"
  }),
  makeJob({
    id: "job_1002",
    tenantId: "northwind",
    status: "running",
    attempt: 1,
    startedAt: minutesAgo(1),
    tokens: 320,
    costUsd: 0.0048,
    payloadSummary: "Draft customer renewal email"
  }),
  makeJob({
    id: "job_1003",
    tenantId: "acme",
    status: "succeeded",
    attempt: 1,
    createdAt: minutesAgo(25),
    startedAt: minutesAgo(24),
    finishedAt: minutesAgo(23),
    tokens: 824,
    costUsd: 0.0134,
    payloadSummary: "Generate incident postmortem bullets"
  }),
  makeJob({
    id: "job_1004",
    tenantId: "globex",
    status: "retry_scheduled",
    attempt: 2,
    maxAttempts: 4,
    errorCode: "PROVIDER_TIMEOUT",
    errorMessage: "Upstream response exceeded timeout",
    nextRunAt: minutesAgo(-3),
    createdAt: minutesAgo(18),
    tokens: 210,
    costUsd: 0.0031,
    payloadSummary: "Transform CRM notes into action items"
  }),
  makeJob({
    id: "job_1005",
    tenantId: "initech",
    status: "failed",
    attempt: 3,
    maxAttempts: 3,
    errorCode: "RATE_LIMIT",
    errorMessage: "Tenant budget exhausted",
    createdAt: minutesAgo(30),
    startedAt: minutesAgo(29),
    finishedAt: minutesAgo(28),
    tokens: 1500,
    costUsd: 0.025,
    payloadSummary: "Batch summarize quarterly reports"
  }),
  makeJob({
    id: "job_1006",
    tenantId: "initech",
    status: "dlq",
    attempt: 3,
    maxAttempts: 3,
    errorCode: "VALIDATION_ERROR",
    errorMessage: "Payload missing required field: prompt",
    createdAt: minutesAgo(55),
    finishedAt: minutesAgo(51),
    payloadSummary: "Redacted payload"
  }),
  makeJob({
    id: "job_1007",
    tenantId: "northwind",
    status: "queued",
    priority: 2,
    createdAt: minutesAgo(4),
    model: "gpt-4.1",
    payloadSummary: "Refine product launch FAQ"
  }),
  makeJob({
    id: "job_1008",
    tenantId: "globex",
    status: "cancelled",
    attempt: 0,
    createdAt: minutesAgo(9),
    finishedAt: minutesAgo(7),
    payloadSummary: "Cancelled - legacy migration request"
  }),
  makeJob({
    id: "job_1009",
    tenantId: "acme",
    status: "succeeded",
    attempt: 1,
    createdAt: minutesAgo(12),
    startedAt: minutesAgo(11),
    finishedAt: minutesAgo(10),
    tokens: 540,
    costUsd: 0.0087,
    payloadSummary: "Generate meeting follow-up draft"
  }),
  makeJob({
    id: "job_1010",
    tenantId: "globex",
    status: "queued",
    createdAt: minutesAgo(1),
    payloadSummary: "Classify expense ticket attachments"
  })
];

export const seedWorkers = (): Worker[] => [
  {
    workerId: "worker-a",
    state: "busy",
    lastHeartbeatAt: minutesAgo(0),
    runningJobId: "job_1002",
    concurrency: 4,
    activeSlots: 3,
    restartCount: 1
  },
  {
    workerId: "worker-b",
    state: "idle",
    lastHeartbeatAt: minutesAgo(0),
    concurrency: 4,
    activeSlots: 1,
    restartCount: 0
  },
  {
    workerId: "worker-c",
    state: "unhealthy",
    lastHeartbeatAt: minutesAgo(3),
    concurrency: 2,
    activeSlots: 0,
    restartCount: 3
  }
];

export const seedTenantLimits = (): TenantLimit[] => [
  { tenantId: "acme", concurrency: 8, rps: 20, tokenBudgetPerMin: 80_000 },
  { tenantId: "globex", concurrency: 5, rps: 12, tokenBudgetPerMin: 55_000 },
  { tenantId: "initech", concurrency: 3, rps: 8, tokenBudgetPerMin: 25_000 },
  { tenantId: "northwind", concurrency: 4, rps: 10, tokenBudgetPerMin: 35_000 }
];

export const createInitialState = (): MockState => ({
  queuePaused: false,
  jobs: seedJobs(),
  workers: seedWorkers(),
  tenantLimits: seedTenantLimits(),
  events: [
    {
      id: "evt_1",
      type: "job.created",
      at: minutesAgo(6),
      jobId: "job_1002",
      details: "Job accepted via POST /v1/jobs"
    },
    {
      id: "evt_2",
      type: "job.started",
      at: minutesAgo(1),
      jobId: "job_1002",
      workerId: "worker-a",
      details: "Worker lease acquired"
    },
    {
      id: "evt_3",
      type: "job.moved_dlq",
      at: minutesAgo(51),
      jobId: "job_1006",
      details: "Max attempts reached"
    },
    {
      id: "evt_4",
      type: "worker.heartbeat",
      at: minutesAgo(0),
      workerId: "worker-a",
      details: "Heartbeat OK"
    }
  ]
});
