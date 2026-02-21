"use client";

import Link from "next/link";
import { formatRelativeTime, formatUsd } from "@/lib/format";
import { Job } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

export const JobsTable = ({
  jobs,
  onRetry,
  onCancel
}: {
  jobs: Job[];
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Job</th>
          <th>Status</th>
          <th>Tenant</th>
          <th>Model</th>
          <th>Attempts</th>
          <th>Cost</th>
          <th>Age</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs.length === 0 && (
          <tr>
            <td colSpan={8}>
              <p>No jobs found for the selected filters.</p>
            </td>
          </tr>
        )}
        {jobs.map((job) => (
          <tr key={job.id}>
            <td>
              <Link href={`/jobs/${job.id}`}>{job.id}</Link>
              <p>{job.payloadSummary}</p>
            </td>
            <td>
              <StatusBadge status={job.status} />
            </td>
            <td>{job.tenantId}</td>
            <td>{job.model}</td>
            <td>
              {job.attempt}/{job.maxAttempts}
            </td>
            <td>{formatUsd(job.costUsd)}</td>
            <td>{formatRelativeTime(job.createdAt)}</td>
            <td>
              <div className="table-actions">
                {onRetry && (job.status === "failed" || job.status === "retry_scheduled") && (
                  <button onClick={() => onRetry(job.id)}>Retry</button>
                )}
                {onCancel && (job.status === "queued" || job.status === "running" || job.status === "retry_scheduled") && (
                  <button className="danger" onClick={() => onCancel(job.id)}>
                    Cancel
                  </button>
                )}
                {!onRetry && !onCancel && <span className="hint">N/A</span>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
