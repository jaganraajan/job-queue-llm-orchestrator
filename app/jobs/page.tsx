"use client";

import { useMemo, useState } from "react";
import { JobsTable } from "@/components/jobs-table";
import { useMockSystem } from "@/lib/mock-store";

export default function JobsPage() {
  const { state, retryJob, cancelJob } = useMockSystem();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tenant, setTenant] = useState("all");

  const tenants = useMemo(
    () => ["all", ...new Set(state.jobs.map((job) => job.tenantId))],
    [state.jobs]
  );

  const filteredJobs = useMemo(
    () =>
      state.jobs.filter((job) => {
        const matchesQuery =
          !query ||
          job.id.toLowerCase().includes(query.toLowerCase()) ||
          job.payloadSummary.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "all" || job.status === status;
        const matchesTenant = tenant === "all" || job.tenantId === tenant;

        return matchesQuery && matchesStatus && matchesTenant;
      }),
    [query, status, tenant, state.jobs]
  );

  return (
    <section className="page">
      <div className="page-title">
        <h2>Jobs</h2>
      </div>

      <div className="filters">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by job id or payload..."
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="retry_scheduled">Retry Scheduled</option>
          <option value="dlq">DLQ</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={tenant} onChange={(event) => setTenant(event.target.value)}>
          {tenants.map((tenantOption) => (
            <option key={tenantOption} value={tenantOption}>
              {tenantOption === "all" ? "All tenants" : tenantOption}
            </option>
          ))}
        </select>
      </div>

      <JobsTable jobs={filteredJobs} onRetry={retryJob} onCancel={cancelJob} />
    </section>
  );
}
