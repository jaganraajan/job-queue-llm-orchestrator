import { NextResponse } from "next/server";
import { getBackendBaseURL } from "@/lib/backend-url";

const toErrorResponse = (message: string, status = 502): NextResponse =>
  NextResponse.json(
    {
      code: "upstream_error",
      message
    },
    { status }
  );

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const backendURL = `${getBackendBaseURL()}/v1/jobs/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(backendURL, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend";
    return toErrorResponse(message);
  }
}
