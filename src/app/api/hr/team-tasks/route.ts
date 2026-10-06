import { hrTaskBridge } from "../../../../modules/hr/task-bridge";

// Managers only see tasks of their reports that TASK already lets them view.
export async function GET(request: Request) {
  return hrTaskBridge(
    request,
    async (service) => ({ tasks: await service.teamTasks() }),
    { team: true },
  );
}
