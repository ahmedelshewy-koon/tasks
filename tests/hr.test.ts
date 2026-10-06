import { afterEach, expect, it, vi } from "vitest";
import { loginWithHr, hrAdapter } from "../src/modules/hr/adapter";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function setup() {
  vi.stubEnv("TASK_AUTH_MODE", "hr");
  vi.stubEnv("HR_API_URL", "http://localhost:3000/api/task");
}
it("exchanges HR credentials for its session cookie without returning the password", async () => {
  setup();
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: { must_change_password: 0 },
        }),
        {
          headers: {
            "set-cookie":
              "koon_portal_session=opaque.signature; HttpOnly; Path=/",
          },
        },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await loginWithHr("staff@example.com", "secret-password")).toBe(
    "opaque.signature",
  );
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:3000/api/auth");
});
it("requires HR password changes before opening TASK", async () => {
  setup();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          authenticated: true,
          user: { must_change_password: 1 },
        }),
      ),
  );
  await expect(loginWithHr("staff@example.com", "password")).rejects.toThrow(
    /HR.*password/i,
  );
});
it("validates the current HR session and uses HR supplied direct reports", async () => {
  setup();
  const me = {
    userId: "7",
    employeeId: "17",
    name: "Staff",
    email: "staff@example.com",
    company: "Company",
    branch: "",
    department: "",
    jobTitle: "",
    managerId: null,
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ me, employees: [me], directReports: [] }),
    );
  vi.stubGlobal("fetch", fetcher);
  const hr = hrAdapter();
  expect(await hr.authenticate("opaque.signature")).toEqual(me);
  expect(await hr.directReports("opaque.signature", "17")).toEqual([]);
  expect(fetcher.mock.calls[0][1].headers.Cookie).toBe(
    "koon_portal_session=opaque.signature",
  );
});
it("rejects expired HR sessions", async () => {
  setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  );
  await expect(hrAdapter().authenticate("expired")).rejects.toMatchObject({
    status: 401,
  });
});
