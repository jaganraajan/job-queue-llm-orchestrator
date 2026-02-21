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

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const backendURL = `${getBackendBaseURL()}/v1/admin/jobs/${encodeURIComponent(id)}/retry`;

  try {
    const response = await fetch(backendURL, {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
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
