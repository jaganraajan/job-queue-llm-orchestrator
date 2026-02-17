export const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const hours = Math.round(diffMin / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const formatUsd = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

export const titleCaseStatus = (status: string): string =>
  status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
