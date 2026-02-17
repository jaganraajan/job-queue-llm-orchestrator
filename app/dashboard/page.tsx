"use client";

import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { useMockSystem } from "@/lib/mock-store";

export default function DashboardPage() {
  const { metrics, recentEvents, state, pauseQueue, resumeQueue } = useMockSystem();
  const queueHealthTone = state.queuePaused ? "warn" : "good";

  return (
    <section className="page">
      <div className="page-title">
        <h2>Global Queue Health</h2>
        <button onClick={state.queuePaused ? resumeQueue : pauseQueue}>
          {state.queuePaused ? "Resume Queue" : "Pause Queue"}
        </button>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Queued" value={formatNumber(metrics.queued)} hint="waiting for lease" />
        <KpiCard label="Running" value={formatNumber(metrics.running)} hint="active in workers" />
        <KpiCard label="Succeeded" value={formatNumber(metrics.succeeded)} hint="terminal success" tone="good" />
        <KpiCard label="Failed" value={formatNumber(metrics.failed)} hint="terminal failed" tone="warn" />
        <KpiCard
          label="Retry Rate"
          value={`${metrics.retryRate.toFixed(1)}%`}
          hint="jobs with >1 attempt"
        />
        <KpiCard label="DLQ Size" value={formatNumber(metrics.dlqSize)} hint="requires replay" tone="warn" />
        <KpiCard label="P95 Latency" value={`${metrics.p95LatencyMs}ms`} hint="enqueue to finish" />
        <KpiCard
          label="Queue Status"
          value={state.queuePaused ? "Paused" : "Flowing"}
          hint="admin control"
          tone={queueHealthTone}
        />
      </div>

      <div className="panel-grid">
        <article className="panel">
          <h3>Realtime Events (WebSocket Mock)</h3>
          <ul className="event-list">
            {recentEvents.map((event) => (
              <li key={event.id}>
                <div>
                  <StatusBadge
                    status={
                      event.type.includes("succeeded")
                        ? "succeeded"
                        : event.type.includes("failed")
                          ? "failed"
                          : event.type.includes("dlq")
                            ? "dlq"
                            : "running"
                    }
                  />
                  <p>
                    <strong>{event.type}</strong> {event.details}
                  </p>
                </div>
                <span>{formatRelativeTime(event.at)}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h3>Worker Snapshot</h3>
          <ul className="worker-list">
            {state.workers.map((worker) => (
              <li key={worker.workerId}>
                <div>
                  <h4>{worker.workerId}</h4>
                  <p>
                    {worker.activeSlots}/{worker.concurrency} slots active
                  </p>
                </div>
                <StatusBadge
                  status={
                    worker.state === "busy"
                      ? "running"
                      : worker.state === "unhealthy"
                        ? "failed"
                        : "queued"
                  }
                />
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
