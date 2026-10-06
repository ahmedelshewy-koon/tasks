import { hrTaskBridge } from "../../../../modules/hr/task-bridge";

export async function GET(request: Request) {
  return hrTaskBridge(request, async (service) => ({
    tasks: await service.myTasks(),
  }));
}
