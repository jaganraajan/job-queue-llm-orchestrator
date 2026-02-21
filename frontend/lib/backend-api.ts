import { Job } from "@/lib/types";

type BackendJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retry_scheduled"
  | "dlq"
  | "cancelled";

type BackendJob = {
  id: string;
  tenant_id: string;
  status: BackendJobStatus;
  priority: number;
  model: string;
  payload_json: unknown;
  idempotency_key?: string;
  attempt: number;
  max_attempts: number;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  error_code?: string;
  error_message?: string;
  trace_id: string;
};

type BackendJobAttempt = {
  tokens?: number;
  cost_usd?: number;
};

type BackendJobSnapshot = {
  job: BackendJob;
  latest_attempt?: BackendJobAttempt;
};

type BackendListJobsResponse = {
  jobs: BackendJob[];
};

type BackendCreateJobResponse = {
  job: BackendJob;
  idempotent_replay: boolean;
};

export type JobCreateInput = {
  tenantId: string;
  model: string;
  prompt: string;
  priority: number;
  maxAttempts: number;
  idempotencyKey?: string;
};

export type JobCreateResult = {
  job: Job;
  idempotentReplay: boolean;
};

const ensureOk = async (response: Response): Promise<void> => {
  if (response.ok) {
    return;
  }

  let message = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) {
      message = body.message;
    }
  } catch {
    // No-op: fallback message is enough.
  }
  throw new Error(message);
};

const toPayloadSummary = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "Payload unavailable";
  }

  const asRecord = payload as Record<string, unknown>;
  const prompt = asRecord.prompt;
  if (typeof prompt === "string" && prompt.trim() !== "") {
    return prompt.length > 90 ? `${prompt.slice(0, 90)}...` : prompt;
  }

  const serialized = JSON.stringify(payload);
  return serialized.length > 90 ? `${serialized.slice(0, 90)}...` : serialized;
};

const mapBackendJob = (backendJob: BackendJob, latestAttempt?: BackendJobAttempt): Job => ({
  id: backendJob.id,
  tenantId: backendJob.tenant_id,
  status: backendJob.status,
  priority: backendJob.priority,
  model: backendJob.model,
  payloadSummary: toPayloadSummary(backendJob.payload_json),
  idempotencyKey: backendJob.idempotency_key ?? "",
  attempt: backendJob.attempt,
  maxAttempts: backendJob.max_attempts,
  createdAt: backendJob.created_at,
  startedAt: backendJob.started_at,
  finishedAt: backendJob.finished_at,
  errorCode: backendJob.error_code,
  errorMessage: backendJob.error_message,
  traceId: backendJob.trace_id,
  tokens: latestAttempt?.tokens ?? 0,
  costUsd: latestAttempt?.cost_usd ?? 0
});

export const listJobs = async (filters: {
  status?: string;
  tenant?: string;
  model?: string;
  limit?: number;
}): Promise<Job[]> => {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.tenant && filters.tenant !== "all") {
    params.set("tenant", filters.tenant);
  }
  if (filters.model && filters.model !== "all") {
    params.set("model", filters.model);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  const response = await fetch(`/api/v1/jobs${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store"
  });
  await ensureOk(response);

  const body = (await response.json()) as BackendListJobsResponse;
  return body.jobs.map((job) => mapBackendJob(job));
};

export const createJob = async (input: JobCreateInput): Promise<JobCreateResult> => {
  const response = await fetch("/api/v1/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})
    },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      priority: input.priority,
      model: input.model,
      payload: {
        prompt: input.prompt
      },
      max_attempts: input.maxAttempts,
      idempotency_key: input.idempotencyKey ?? ""
    })
  });
  await ensureOk(response);

  const body = (await response.json()) as BackendCreateJobResponse;
  return {
    job: mapBackendJob(body.job),
    idempotentReplay: body.idempotent_replay
  };
};

export const getJobSnapshot = async (
  jobId: string
): Promise<{
  job: Job;
  latestAttempt?: BackendJobAttempt;
}> => {
  const response = await fetch(`/api/v1/jobs/${jobId}`, {
    method: "GET",
    cache: "no-store"
  });
  await ensureOk(response);

  const body = (await response.json()) as BackendJobSnapshot;
  return {
    job: mapBackendJob(body.job, body.latest_attempt),
    latestAttempt: body.latest_attempt
  };
};

export const cancelJob = async (jobId: string): Promise<Job> => {
  const response = await fetch(`/api/v1/jobs/${jobId}/cancel`, {
    method: "POST"
  });
  await ensureOk(response);

  const body = (await response.json()) as { job: BackendJob };
  return mapBackendJob(body.job);
};

export const retryJob = async (jobId: string): Promise<Job> => {
  const response = await fetch(`/api/v1/admin/jobs/${jobId}/retry`, {
    method: "POST"
  });
  await ensureOk(response);

  const body = (await response.json()) as { job: BackendJob };
  return mapBackendJob(body.job);
};
