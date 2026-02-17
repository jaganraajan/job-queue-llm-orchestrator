"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { createInitialState } from "@/lib/mock-data";
import { EventRecord, Job, JobStatus, MetricsSummary, MockState } from "@/lib/types";

type UpdateTenantInput = {
  tenantId: string;
  concurrency: number;
  rps: number;
  tokenBudgetPerMin: number;
};

type MockSystemContextValue = {
  state: MockState;
  metrics: MetricsSummary;
  recentEvents: EventRecord[];
  pauseQueue: () => void;
  resumeQueue: () => void;
  retryJob: (jobId: string) => void;
  replayDlq: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  updateTenantLimit: (limit: UpdateTenantInput) => void;
};

const MockSystemContext = createContext<MockSystemContextValue | null>(null);

const randomLatency = (): number => 500 + Math.floor(Math.random() * 1200);

const nowIso = (): string => new Date().toISOString();

const makeEvent = (partial: Omit<EventRecord, "id" | "at">): EventRecord => ({
  id: `evt_${Math.random().toString(36).slice(2, 9)}`,
  at: nowIso(),
  ...partial
});

const isActiveStatus = (status: JobStatus): boolean =>
  status === "queued" || status === "running" || status === "retry_scheduled";

const computeMetrics = (jobs: Job[]): MetricsSummary => {
  const queued = jobs.filter((job) => job.status === "queued").length;
  const running = jobs.filter((job) => job.status === "running").length;
  const succeeded = jobs.filter((job) => job.status === "succeeded").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const retries = jobs.filter((job) => job.attempt > 1).length;
  const retryRate = jobs.length ? (retries / jobs.length) * 100 : 0;
  const dlqSize = jobs.filter((job) => job.status === "dlq").length;
  const p95LatencyMs = randomLatency();

  return {
    queued,
    running,
    succeeded,
    failed,
    retryRate,
    dlqSize,
    p95LatencyMs
  };
};

const addEvent = (events: EventRecord[], event: EventRecord): EventRecord[] =>
  [event, ...events].slice(0, 40);

export const MockSystemProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<MockState>(createInitialState);

  const metrics = useMemo(() => computeMetrics(state.jobs), [state.jobs]);
  const recentEvents = useMemo(() => state.events.slice(0, 12), [state.events]);

  const pauseQueue = () => {
    setState((prev) => ({
      ...prev,
      queuePaused: true,
      events: addEvent(
        prev.events,
        makeEvent({ type: "queue.paused", details: "Queue paused by operator" })
      )
    }));
  };

  const resumeQueue = () => {
    setState((prev) => ({
      ...prev,
      queuePaused: false,
      events: addEvent(
        prev.events,
        makeEvent({ type: "queue.resumed", details: "Queue resumed by operator" })
      )
    }));
  };

  const retryJob = (jobId: string) => {
    setState((prev) => {
      const jobs = prev.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "queued",
              errorCode: undefined,
              errorMessage: undefined,
              nextRunAt: undefined,
              finishedAt: undefined
            }
          : job
      );

      return {
        ...prev,
        jobs,
        events: addEvent(
          prev.events,
          makeEvent({
            type: "job.retry_scheduled",
            jobId,
            details: "Manual retry requested"
          })
        )
      };
    });
  };

  const replayDlq = (jobId: string) => {
    setState((prev) => {
      const jobs = prev.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "queued",
              attempt: 0,
              errorCode: undefined,
              errorMessage: undefined,
              finishedAt: undefined
            }
          : job
      );

      return {
        ...prev,
        jobs,
        events: addEvent(
          prev.events,
          makeEvent({
            type: "job.created",
            jobId,
            details: "DLQ replay enqueued"
          })
        )
      };
    });
  };

  const cancelJob = (jobId: string) => {
    setState((prev) => {
      const jobs = prev.jobs.map((job) =>
        job.id === jobId && isActiveStatus(job.status)
          ? {
              ...job,
              status: "cancelled",
              finishedAt: nowIso(),
              nextRunAt: undefined
            }
          : job
      );

      return {
        ...prev,
        jobs,
        events: addEvent(
          prev.events,
          makeEvent({ type: "job.failed", jobId, details: "Cancelled by operator" })
        )
      };
    });
  };

  const updateTenantLimit = (limit: UpdateTenantInput) => {
    setState((prev) => ({
      ...prev,
      tenantLimits: prev.tenantLimits.map((row) =>
        row.tenantId === limit.tenantId ? { ...limit } : row
      )
    }));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        let jobs = [...prev.jobs];
        let workers = [...prev.workers];
        let events = [...prev.events];

        workers = workers.map((worker) => {
          const heartbeatGap = worker.state === "unhealthy" ? 2 : 0;
          return {
            ...worker,
            lastHeartbeatAt: new Date(Date.now() - heartbeatGap * 60_000).toISOString()
          };
        });

        events = addEvent(
          events,
          makeEvent({ type: "worker.heartbeat", workerId: "worker-a", details: "Heartbeat OK" })
        );

        jobs = jobs.map((job) => {
          if (job.status === "retry_scheduled" && job.nextRunAt) {
            const ready = new Date(job.nextRunAt).getTime() <= Date.now();
            if (ready) {
              events = addEvent(
                events,
                makeEvent({
                  type: "job.retry_scheduled",
                  jobId: job.id,
                  details: "Retry delay elapsed, job re-queued"
                })
              );
              return { ...job, status: "queued", nextRunAt: undefined };
            }
          }
          return job;
        });

        if (!prev.queuePaused) {
          const nextQueued = jobs.find((job) => job.status === "queued");
          if (nextQueued) {
            jobs = jobs.map((job) =>
              job.id === nextQueued.id
                ? {
                    ...job,
                    status: "running",
                    startedAt: nowIso(),
                    attempt: Math.max(1, job.attempt)
                  }
                : job
            );
            events = addEvent(
              events,
              makeEvent({
                type: "job.started",
                jobId: nextQueued.id,
                workerId: "worker-b",
                details: "Dequeued and started"
              })
            );
          }

          const running = jobs.find((job) => job.status === "running");
          if (running && Math.random() > 0.4) {
            const willSucceed = Math.random() > 0.3;
            if (willSucceed) {
              jobs = jobs.map((job) =>
                job.id === running.id
                  ? {
                      ...job,
                      status: "succeeded",
                      finishedAt: nowIso(),
                      tokens: job.tokens + 150 + Math.floor(Math.random() * 300),
                      costUsd: Number((job.costUsd + 0.003 + Math.random() * 0.007).toFixed(4))
                    }
                  : job
              );
              events = addEvent(
                events,
                makeEvent({
                  type: "job.succeeded",
                  jobId: running.id,
                  details: "Provider returned completion"
                })
              );
            } else {
              const shouldRetry = running.attempt < running.maxAttempts;
              jobs = jobs.map((job) =>
                job.id === running.id
                  ? shouldRetry
                    ? {
                        ...job,
                        status: "retry_scheduled",
                        attempt: job.attempt + 1,
                        errorCode: "PROVIDER_TIMEOUT",
                        errorMessage: "Mock timeout from upstream",
                        nextRunAt: new Date(Date.now() + 15_000).toISOString()
                      }
                    : {
                        ...job,
                        status: "dlq",
                        finishedAt: nowIso(),
                        errorCode: "PROVIDER_TERMINAL",
                        errorMessage: "Repeated provider terminal failures"
                      }
                  : job
              );
              events = addEvent(
                events,
                makeEvent({
                  type: shouldRetry ? "job.retry_scheduled" : "job.moved_dlq",
                  jobId: running.id,
                  details: shouldRetry
                    ? "Transient failure; backoff applied"
                    : "Max attempts exhausted; moved to DLQ"
                })
              );
            }
          }
        }

        return {
          ...prev,
          jobs,
          workers,
          events
        };
      });
    }, 5_000);

    return () => clearInterval(interval);
  }, []);

  const value = useMemo(
    () => ({
      state,
      metrics,
      recentEvents,
      pauseQueue,
      resumeQueue,
      retryJob,
      replayDlq,
      cancelJob,
      updateTenantLimit
    }),
    [state, metrics, recentEvents]
  );

  return <MockSystemContext.Provider value={value}>{children}</MockSystemContext.Provider>;
};

export const useMockSystem = (): MockSystemContextValue => {
  const context = useContext(MockSystemContext);
  if (!context) {
    throw new Error("useMockSystem must be used inside MockSystemProvider");
  }
  return context;
};
