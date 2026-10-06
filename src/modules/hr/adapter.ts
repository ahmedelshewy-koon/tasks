import { z } from "zod";
import { AppError, type Employee } from "../shared/types";
export interface HrAdapter {
  authenticate(token: string): Promise<Employee>;
  employees(token: string): Promise<Employee[]>;
  directReports(token: string, employeeId: string): Promise<Employee[]>;
}
export const developmentAllowed = (
  nodeEnv: string | undefined,
  mode: string | undefined,
) => nodeEnv !== "production" && mode === "development";
export const isDevelopment = () =>
  developmentAllowed(process.env.NODE_ENV, process.env.TASK_AUTH_MODE);
const employeeSchema = z.object({
  userId: z.string().min(1),
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  company: z.string(),
  branch: z.string(),
  department: z.string(),
  jobTitle: z.string(),
  managerId: z.string().nullable(),
  isHrAdmin: z.boolean().optional(),
});
export const developmentEmployees: Employee[] = [
  {
    userId: "local-admin",
    employeeId: "local-admin",
    name: "Local admin",
    email: "admin@localhost.test",
    company: "Local development",
    branch: "",
    department: "",
    jobTitle: "TASK administrator",
    managerId: null,
  },
  {
    userId: "local-manager",
    employeeId: "local-manager",
    name: "Local manager",
    email: "manager@localhost.test",
    company: "Local development",
    branch: "",
    department: "",
    jobTitle: "Team manager",
    managerId: null,
  },
  {
    userId: "local-employee",
    employeeId: "local-employee",
    name: "Local employee",
    email: "employee@localhost.test",
    company: "Local development",
    branch: "",
    department: "",
    jobTitle: "Team member",
    managerId: "local-manager",
  },
  {
    userId: "local-colleague",
    employeeId: "local-colleague",
    name: "Local colleague",
    email: "colleague@localhost.test",
    company: "Local development",
    branch: "",
    department: "",
    jobTitle: "Team member",
    managerId: "local-manager",
  },
];
export function hrAdapter(): HrAdapter {
  if (isDevelopment())
    return {
      async authenticate(token) {
        const person = developmentEmployees.find((e) => e.userId === token);
        if (!person)
          throw new AppError(401, "Choose a local development identity.");
        return person;
      },
      async employees() {
        return developmentEmployees;
      },
      async directReports(_token, id) {
        return developmentEmployees.filter((e) => e.managerId === id);
      },
    };
  // Request-scoped only: never share one employee's HR response across sessions.
  let snapshot: Promise<z.infer<typeof snapshotSchema>> | undefined;
  let snapshotToken: string | undefined;
  const read = (token: string) => {
    if (!snapshot || snapshotToken !== token) {
      snapshotToken = token;
      snapshot = hrFetch(hrBase(), {
        headers: { Cookie: `koon_portal_session=${token}` },
      }).then(async (response) => {
        const parsed = snapshotSchema.safeParse(await response.json());
        if (!parsed.success)
          throw new AppError(503, "HR returned an invalid directory response.");
        return parsed.data;
      });
    }
    return snapshot;
  };
  return {
    async authenticate(token) {
      return (await read(token)).me;
    },
    async employees(token) {
      return [...(await read(token)).employees];
    },
    async directReports(token, id) {
      const data = await read(token);
      if (data.me.employeeId !== id)
        throw new AppError(403, "Invalid HR employee scope.");
      return data.directReports;
    },
  };
}
const snapshotSchema = z.object({
  me: employeeSchema,
  employees: z.array(employeeSchema),
  directReports: z.array(employeeSchema),
});
function hrBase() {
  const base = process.env.HR_API_URL;
  if (!base) throw new AppError(503, "HR integration needs configuration.");
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new AppError(503, "HR requires a secure API URL.");
  return base.replace(/\/$/, "");
}
async function hrFetch(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AppError(503, "HR is temporarily unavailable. Please try again.");
  }
  if (response.status === 401)
    throw new AppError(
      401,
      "Your HR session has expired or your login details are incorrect.",
    );
  if (response.status === 403)
    throw new AppError(
      403,
      "Open HR to check your account and change your password if required.",
    );
  if (response.status === 429)
    throw new AppError(
      429,
      "Too many login attempts. Please try again in 15 minutes.",
    );
  if (!response.ok)
    throw new AppError(503, "HR is temporarily unavailable. Please try again.");
  return response;
}
export async function loginWithHr(email: string, password: string) {
  const url = new URL("../auth", hrBase() + "/");
  const response = await hrFetch(url.href, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: url.origin },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!data.authenticated) throw new AppError(401, "Invalid HR login details.");
  if (data.user?.must_change_password)
    throw new AppError(
      403,
      "Open HR and change your password before signing in to TASK.",
    );
  const token = response.headers
    .get("set-cookie")
    ?.match(/(?:^|,\s*)koon_portal_session=([^;]+)/)?.[1];
  if (!token || !/^[A-Za-z0-9_.-]+$/.test(token))
    throw new AppError(503, "HR did not issue a valid session.");
  return token;
}
