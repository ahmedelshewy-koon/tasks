export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Actor = {
  userId: string;
  employeeId: string;
  isAdmin: boolean;
  directReportIds: string[];
  subordinateIds?: string[];
};
export type Employee = {
  isHrAdmin?: boolean;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  company: string;
  branch: string;
  department: string;
  jobTitle: string;
  managerId: string | null;
};
export type ProjectRole = "project_manager" | "member" | "viewer";
// Missing role entries mean "member", the role every existing membership had.
export type ProjectAccess = {
  ownerId: string;
  memberIds: string[];
  roles?: Record<string, ProjectRole>;
};
export type TaskAccess = {
  creatorId: string;
  projectId: string | null;
  assigneeIds: string[];
};
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireAccess(
  allowed: boolean,
  message = "You do not have permission to do this.",
) {
  if (!allowed) throw new AppError(403, message);
}
