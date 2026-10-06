import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./types";
// Production trusts only the configured canonical HTTPS origin, never the Host header.
function expectedOrigin(request: Request) {
  if (process.env.NODE_ENV === "production") {
    let configured: URL | undefined;
    try {
      configured = new URL(process.env.TASK_ORIGIN || "");
    } catch {}
    if (!configured || configured.protocol !== "https:")
      throw new AppError(
        503,
        "TASK_ORIGIN must be set to the public HTTPS origin.",
      );
    return configured.origin;
  }
  const url = new URL(request.url);
  return (
    process.env.TASK_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = expectedOrigin(request);
  if (!origin || origin !== expected)
    throw new AppError(403, "Request origin is not allowed.");
}
export function respondError(error: unknown) {
  if (error instanceof AppError) {
    const response = NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
    if (error.status === 401) response.cookies.delete("task_session");
    return response;
  }
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  console.error(
    "TASK request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
