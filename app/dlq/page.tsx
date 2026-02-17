"use client";

import { useMemo } from "react";
import { formatRelativeTime } from "@/lib/format";
import { useMockSystem } from "@/lib/mock-store";

export default function DlqPage() {
  const { state, replayDlq } = useMockSystem();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof state.jobs>();
    for (const job of state.jobs.filter((row) => row.status === "dlq")) {
      const key = job.errorCode ?? "UNKNOWN";
      const current = map.get(key) ?? [];
      map.set(key, [...current, job]);
    }
    return [...map.entries()];
  }, [state.jobs]);

  return (
    <section className="page">
      <div className="page-title">
        <h2>Dead Letter Queue</h2>
      </div>

      <div className="cards">
        {grouped.length === 0 && <article className="panel">No DLQ jobs right now.</article>}
        {grouped.map(([reason, jobs]) => (
          <article key={reason} className="panel">
            <h3>{reason}</h3>
            <p className="hint">{jobs.length} job(s) in this failure class</p>
            <ul className="timeline">
              {jobs.map((job) => (
                <li key={job.id}>
                  <strong>{job.id}</strong>
                  <p>{job.errorMessage}</p>
                  <span>{formatRelativeTime(job.createdAt)}</span>
                  <button onClick={() => replayDlq(job.id)}>Replay to Queue</button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
