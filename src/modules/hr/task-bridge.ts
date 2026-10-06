import { getDb } from "../../db";
import { hrAdapter, isDevelopment } from "./adapter";
import { subordinateUserIds } from "./hierarchy";
import { createService } from "../work/service";
import { AppError } from "../shared/types";

type Service = ReturnType<typeof createService>;

// Read-only HR integration. Identity always comes from the validated HR session.
export async function hrTaskBridge(
  request: Request,
  read: (service: Service) => Promise<object>,
  { team = false } = {},
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/)?.[1];
    if (!token || isDevelopment())
      return Response.json(
        { error: "HR sign-in required." },
        { status: 401, headers },
      );
    const hr = hrAdapter();
    const me = await hr.authenticate(token);
    const directory = team ? await hr.employees(token) : [me];
    const reports = team ? await hr.directReports(token, me.employeeId) : [];
    if (!directory.some((e) => e.userId === me.userId)) directory.push(me);
    for (const report of reports)
      if (!directory.some((e) => e.employeeId === report.employeeId))
        directory.push(report);
    const service = createService(
      await getDb(),
      {
        userId: me.userId,
        employeeId: me.employeeId,
        isAdmin: false,
        directReportIds: reports.map((e) => e.userId),
        ...(team && { subordinateIds: subordinateUserIds(me, directory) }),
      },
      directory,
    );
    return Response.json(await read(service), { headers });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 503;
    return Response.json(
      {
        error:
          status === 401 || status === 403
            ? "HR sign-in required."
            : "Tasks are temporarily unavailable.",
      },
      { status, headers },
    );
  }
}
