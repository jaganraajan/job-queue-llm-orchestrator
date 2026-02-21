import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseURL } from "@/lib/backend-url";

const toErrorResponse = (message: string, status = 502): NextResponse =>
  NextResponse.json(
    {
      code: "upstream_error",
      message
    },
    { status }
  );

export async function GET(request: NextRequest): Promise<NextResponse> {
  const backendURL = `${getBackendBaseURL()}/v1/jobs${request.nextUrl.search}`;

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const backendURL = `${getBackendBaseURL()}/v1/jobs`;
  const body = await request.text();
  const idempotencyKey = request.headers.get("Idempotency-Key");

  try {
    const response = await fetch(backendURL, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") ?? "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
      },
      body
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
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
