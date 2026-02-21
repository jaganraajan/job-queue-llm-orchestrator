"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { formatNumber, formatRelativeTime, formatUsd } from "@/lib/format";
import { cancelJob, getJobSnapshot, retryJob } from "@/lib/backend-api";
import { EventRecord, Job } from "@/lib/types";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<{ tokens?: number; cost_usd?: number } | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadJob = async () => {
    try {
      setError(null);
      const snapshot = await getJobSnapshot(params.id);
      setJob(snapshot.job);
      setLatestAttempt(snapshot.latestAttempt);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load job");
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
    const interval = setInterval(() => {
      void loadJob();
    }, 3500);

    return () => clearInterval(interval);
  }, [params.id]);

  const handleRetryJob = async () => {
    if (!job) {
      return;
    }

    setActionBusy(true);
    try {
      setError(null);
      await retryJob(job.id);
      await loadJob();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Failed to retry job");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelJob = async () => {
    if (!job) {
      return;
    }

    setActionBusy(true);
    try {
      setError(null);
      await cancelJob(job.id);
      await loadJob();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel job");
    } finally {
      setActionBusy(false);
    }
  };

  const timelineEvents = useMemo<EventRecord[]>(() => {
    if (!job) {
      return [];
    }

    const events: EventRecord[] = [
      {
        id: `${job.id}-created`,
        type: "job.created",
        at: job.createdAt,
        jobId: job.id,
        details: "Job accepted via POST /v1/jobs"
      }
    ];

    if (job.startedAt) {
      events.push({
        id: `${job.id}-started`,
        type: "job.started",
        at: job.startedAt,
        jobId: job.id,
        details: "Worker acquired lease and started execution"
      });
    }

    if (job.finishedAt) {
      const type =
        job.status === "succeeded"
          ? "job.succeeded"
          : job.status === "failed"
            ? "job.failed"
            : job.status === "dlq"
              ? "job.moved_dlq"
              : "job.failed";
      events.push({
        id: `${job.id}-finished`,
        type,
        at: job.finishedAt,
        jobId: job.id,
        details: job.errorMessage || `Job finished with status ${job.status}`
      });
    }

    return events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [job]);

  if (loading) {
    return (
      <section className="page">
        <div className="panel">
          <h3>Loading job...</h3>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page">
        <div className="panel">
          <h3>Failed to load job</h3>
          <p className="error">{error}</p>
        </div>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="page">
        <div className="panel">
          <h3>Job not found</h3>
          <p className="hint">No backend job exists with id {params.id}.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-title">
        <div>
          <h2>{job.id}</h2>
          <p>Trace: {job.traceId}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="panel-grid">
        <article className="panel">
          <h3>Request + Execution</h3>
          <dl className="detail-grid">
            <div>
              <dt>Tenant</dt>
              <dd>{job.tenantId}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{job.model}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{job.priority}</dd>
            </div>
            <div>
              <dt>Attempts</dt>
              <dd>
                {job.attempt}/{job.maxAttempts}
              </dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>{formatUsd(latestAttempt?.cost_usd ?? job.costUsd)}</dd>
            </div>
            <div>
              <dt>Tokens</dt>
              <dd>{formatNumber(latestAttempt?.tokens ?? job.tokens)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatRelativeTime(job.createdAt)}</dd>
            </div>
            <div>
              <dt>Idempotency Key</dt>
              <dd>{job.idempotencyKey}</dd>
            </div>
          </dl>
          <p className="hint">Payload summary (redacted): {job.payloadSummary}</p>
          {job.errorMessage && <p className="error">{job.errorCode}: {job.errorMessage}</p>}
          <div className="actions">
            {(job.status === "failed" || job.status === "retry_scheduled" || job.status === "cancelled" || job.status === "dlq") && (
              <button onClick={() => void handleRetryJob()} disabled={actionBusy}>
                Retry Job
              </button>
            )}
            {(job.status === "queued" || job.status === "running" || job.status === "retry_scheduled") && (
              <button className="danger" onClick={() => void handleCancelJob()} disabled={actionBusy}>
                Cancel Job
              </button>
            )}
          </div>
          {actionBusy && <p className="hint">Applying action...</p>}
        </article>

        <article className="panel">
          <h3>Timeline</h3>
          <ul className="timeline">
            {timelineEvents.length === 0 && <li>No events for this job yet.</li>}
            {timelineEvents.map((event) => (
              <li key={event.id}>
                <strong>{event.type}</strong>
                <p>{event.details}</p>
                <span>{formatRelativeTime(event.at)}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
