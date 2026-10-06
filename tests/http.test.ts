import { expect, it, vi } from "vitest";
import { sameOrigin, respondError } from "../src/modules/shared/http";
import { AppError } from "../src/modules/shared/types";
it("uses the browser-facing host for origin validation and rejects cross-site writes", () => {
  expect(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/work", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/work", {
        headers: {
          host: "127.0.0.1:3000",
          origin: "https://untrusted.example",
        },
      }),
    ),
  ).toThrow();
  expect(() =>
    sameOrigin(new Request("http://localhost:3000/api/work")),
  ).toThrow();
});
it("clears invalid HR sessions so the browser can return to sign-in", () => {
  const response = respondError(new AppError(401, "Expired"));
  expect(response.headers.get("set-cookie")).toContain("task_session=;");
});
it("requires the configured HTTPS TASK_ORIGIN in production and ignores Host", () => {
  const write = (origin: string, host = "tasks.example.com") =>
    new Request("http://127.0.0.1:3107/api/work", {
      headers: { host, origin },
    });
  vi.stubEnv("NODE_ENV", "production");
  try {
    vi.stubEnv("TASK_ORIGIN", "");
    expect(() => sameOrigin(write("https://tasks.example.com"))).toThrow();
    vi.stubEnv("TASK_ORIGIN", "http://tasks.example.com");
    expect(() => sameOrigin(write("http://tasks.example.com"))).toThrow();
    vi.stubEnv("TASK_ORIGIN", "https://tasks.example.com");
    expect(() => sameOrigin(write("https://tasks.example.com"))).not.toThrow();
    expect(() =>
      sameOrigin(write("https://evil.example", "evil.example")),
    ).toThrow();
  } finally {
    vi.unstubAllEnvs();
  }
});
