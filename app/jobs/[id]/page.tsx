"use client";

import { useParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { formatRelativeTime, formatUsd } from "@/lib/format";
import { useMockSystem } from "@/lib/mock-store";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, retryJob, cancelJob } = useMockSystem();

  const job = state.jobs.find((item) => item.id === params.id);
  if (!job) {
    return (
      <section className="page">
        <div className="panel">
          <h3>Job not found</h3>
          <p className="hint">This mock store does not currently include a job with id {params.id}.</p>
        </div>
      </section>
    );
  }

  const timelineEvents = state.events
    .filter((event) => event.jobId === job.id)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));

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
              <dd>{formatUsd(job.costUsd)}</dd>
            </div>
            <div>
              <dt>Tokens</dt>
              <dd>{job.tokens}</dd>
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
            {(job.status === "failed" || job.status === "retry_scheduled") && (
              <button onClick={() => retryJob(job.id)}>Retry Job</button>
            )}
            {(job.status === "queued" || job.status === "running" || job.status === "retry_scheduled") && (
              <button className="danger" onClick={() => cancelJob(job.id)}>
                Cancel Job
              </button>
            )}
          </div>
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
