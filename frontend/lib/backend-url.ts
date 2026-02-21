export const getBackendBaseURL = (): string =>
  process.env.BACKEND_URL?.replace(/\/+$/, "") || "http://localhost:8080";
