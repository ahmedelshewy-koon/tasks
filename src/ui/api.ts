import type {
  ProjectFeed,
  Snapshot,
  TaskDetail,
} from "@/modules/work/service";
import type { Employee } from "@/modules/shared/types";
export type Workspace = Snapshot & {
  me: Employee;
  development: boolean;
  hrConfigured: boolean;
};
export type Task = Snapshot["tasks"][number];
export type Project = Snapshot["projects"][number];
export type Field = Project["fields"][number];
export type SavedView = Snapshot["savedViews"][number];
export type Template = Snapshot["templates"][number];
export type FeedItem = ProjectFeed["items"][number];
export type { TaskDetail, ProjectFeed };
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.includes("/auth"))
      window.location.reload();
    throw new Error(data.error || "Request failed.");
  }
  return data;
}
export const command = <T = unknown>(
  action: string,
  data?: unknown,
  id?: string,
) =>
  request<T>("/api/work", {
    method: "POST",
    body: JSON.stringify({ action, data, id }),
  });
