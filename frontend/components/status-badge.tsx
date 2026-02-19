import { titleCaseStatus } from "@/lib/format";
import { JobStatus } from "@/lib/types";

const colorByStatus: Record<JobStatus, string> = {
  queued: "var(--status-queued)",
  running: "var(--status-running)",
  succeeded: "var(--status-succeeded)",
  failed: "var(--status-failed)",
  retry_scheduled: "var(--status-retry)",
  dlq: "var(--status-dlq)",
  cancelled: "var(--status-cancelled)"
};

export const StatusBadge = ({ status }: { status: JobStatus }) => (
  <span className="status-badge" style={{ borderColor: colorByStatus[status], color: colorByStatus[status] }}>
    {titleCaseStatus(status)}
  </span>
);
