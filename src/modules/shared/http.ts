import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./types";
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const expected =
    process.env.TASK_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;
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
