"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { JobsTable } from "@/components/jobs-table";
import { createJob, listJobs } from "@/lib/backend-api";
import { Job } from "@/lib/types";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tenant, setTenant] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    tenantId: "acme",
    model: "gpt-4.1-mini",
    prompt: "",
    priority: 3,
    maxAttempts: 3,
    idempotencyKey: ""
  });

  const refreshJobs = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      setError(null);
      const nextJobs = await listJobs({ limit: 200 });
      setJobs(nextJobs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshJobs(true);
    const interval = setInterval(() => {
      void refreshJobs();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const tenants = useMemo(
    () => ["all", ...new Set(jobs.map((job) => job.tenantId))],
    [jobs]
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const matchesQuery =
          !query ||
          job.id.toLowerCase().includes(query.toLowerCase()) ||
          job.payloadSummary.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "all" || job.status === status;
        const matchesTenant = tenant === "all" || job.tenantId === tenant;

        return matchesQuery && matchesStatus && matchesTenant;
      }),
    [jobs, query, status, tenant]
  );

  const handleCreateJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.prompt.trim()) {
      setError("Prompt is required to create a job");
      return;
    }

    setCreating(true);
    try {
      setError(null);
      await createJob({
        tenantId: createForm.tenantId,
        model: createForm.model,
        prompt: createForm.prompt.trim(),
        priority: createForm.priority,
        maxAttempts: createForm.maxAttempts,
        idempotencyKey: createForm.idempotencyKey.trim() || undefined
      });
      setCreateForm((prev) => ({
        ...prev,
        prompt: "",
        idempotencyKey: ""
      }));
      await refreshJobs();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="page">
      <div className="page-title">
        <h2>Jobs</h2>
        <button onClick={() => void refreshJobs()} disabled={creating}>
          Refresh
        </button>
      </div>

      <article className="panel">
        <h3>Create Job</h3>
        <form className="tenant-form" onSubmit={handleCreateJob}>
          <div className="filters">
            <input
              value={createForm.tenantId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, tenantId: event.target.value }))}
              placeholder="tenant id"
            />
            <input
              value={createForm.model}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, model: event.target.value }))}
              placeholder="model"
            />
            <input
              value={createForm.idempotencyKey}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, idempotencyKey: event.target.value }))}
              placeholder="idempotency key (optional)"
            />
          </div>
          <textarea
            value={createForm.prompt}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, prompt: event.target.value }))}
            placeholder="Prompt text..."
            rows={3}
          />
          <div className="filters">
            <input
              type="number"
              min={1}
              max={10}
              value={createForm.priority}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  priority: Number(event.target.value) || 1
                }))
              }
            />
            <input
              type="number"
              min={1}
              max={10}
              value={createForm.maxAttempts}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  maxAttempts: Number(event.target.value) || 1
                }))
              }
            />
            <button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </article>

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

      {error && (
        <div className="panel">
          <p className="error">{error}</p>
        </div>
      )}

      {loading && jobs.length === 0 && (
        <div className="panel">
          <p className="hint">Loading jobs...</p>
        </div>
      )}

      <JobsTable jobs={filteredJobs} />
    </section>
  );
}
