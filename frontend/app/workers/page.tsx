"use client";

import { formatRelativeTime } from "@/lib/format";
import { useMockSystem } from "@/lib/mock-store";

export default function WorkersPage() {
  const { state } = useMockSystem();

  return (
    <section className="page">
      <div className="page-title">
        <h2>Workers</h2>
      </div>

      <div className="cards">
        {state.workers.map((worker) => {
          const freshnessMs = Date.now() - new Date(worker.lastHeartbeatAt).getTime();
          const stale = freshnessMs > 120_000;

          return (
            <article key={worker.workerId} className="panel">
              <h3>{worker.workerId}</h3>
              <p className={stale ? "error" : "hint"}>
                Heartbeat: {formatRelativeTime(worker.lastHeartbeatAt)}
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>State</dt>
                  <dd>{worker.state}</dd>
                </div>
                <div>
                  <dt>Load</dt>
                  <dd>
                    {worker.activeSlots}/{worker.concurrency}
                  </dd>
                </div>
                <div>
                  <dt>Running Job</dt>
                  <dd>{worker.runningJobId ?? "none"}</dd>
                </div>
                <div>
                  <dt>Restart Count</dt>
                  <dd>{worker.restartCount}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
