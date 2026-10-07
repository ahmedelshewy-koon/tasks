"use client";
import { reportIds } from "../modules/hr/hierarchy";
import { useCallback, useEffect, useState } from "react";
import { useMobileNavigation } from "./use-navigation";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  Archive,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Bell,
  Gauge,
  CalendarDays,
  Check,
  CheckCheck,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Folder,
  FolderOpen,
  Globe2,
  LayoutDashboard,
  LayoutGrid,
  Map as MapIcon,
  GanttChart,
  List,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  command,
  request,
  type Workspace,
  type Project,
  type Task,
} from "./api";
import { dateToday, translate, priorityLabels, type Language } from "./i18n";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  type Translate,
} from "./primitives";
import { Login } from "./login";
import { Confirm, ProjectForm, TaskForm } from "./forms";
import {
  blankFilters,
  filterTasks,
  FiltersBar,
  formatDate,
  TaskBoard,
  TaskCalendar,
  TaskList,
} from "./task-views";
import { TaskDrawer } from "./task-drawer";
import {
  EmployeeChart,
  PriorityChart,
  ProjectsChart,
} from "./dashboard-charts";
import { MyTeam } from "./my-team";
import { TeamTaskSummary } from "./team-task-summary";
import "./team-tasks.css";
import { WorkspaceSettings } from "./workspace-settings";
import { Reports } from "./reports";
import "./advanced.css";
import { SavedViewsBar } from "./saved-views";
import { defaultView } from "./view-config";
import { ProjectOverview, HealthBadge } from "./project-overview";
import { ProjectActivity } from "./project-activity";
import { WorkloadPage } from "./workload";
import { ArchivePage } from "./archive";
import { FieldsManager } from "./custom-fields";
import { roleLabels } from "./activity-text";
import "./features.css";
import { SanaaBrand } from "./sanaa-brand";
import { ProjectRoadmap } from "./project-roadmap";
import { ProjectGantt } from "./project-gantt";
import "./project-gantt.css";
type PageName =
  | "reports"
  | "dashboard"
  | "my-tasks"
  | "projects"
  | "team"
  | "my-team"
  | "calendar"
  | "notifications"
  | "workload"
  | "archive"
  | "admin"
  | "profile";
const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "my-tasks", label: "My Tasks", icon: CheckSquare2 },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "team", label: "Team Tasks", icon: Users },
  { id: "my-team", label: "My Team", icon: Users },
  { id: "workload", label: "Workload", icon: Gauge },
  { id: "reports", label: "Reports", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;
const projectViews = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "gantt", label: "Gantt", icon: GanttChart },
  { id: "roadmap", label: "Project Map", icon: MapIcon },
  { id: "activity", label: "Activity", icon: Activity },
];
const taskViews = projectViews.filter((v) =>
  ["list", "board", "calendar"].includes(v.id),
);
export function TaskApp({
  signedIn,
  development,
}: {
  signedIn: boolean;
  development: boolean;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  const [lang, setLang] = useState<Language>("ar");
  const [languageReady, setLanguageReady] = useState(false);
  useEffect(() => {
    setLang(localStorage.getItem("task-language") === "en" ? "en" : "ar");
    setLanguageReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (languageReady) localStorage.setItem("task-language", lang);
  }, [lang, languageReady]);
  const t = (text: string) => translate(lang, text);
  return (
    <QueryClientProvider client={client}>
      {signedIn ? (
        <WorkspaceApp t={t} lang={lang} setLang={setLang} />
      ) : (
        <Login
          development={development}
          lang={lang}
          t={t}
          onLanguage={setLang}
        />
      )}
    </QueryClientProvider>
  );
}
function WorkspaceApp({
  t,
  lang,
  setLang,
}: {
  t: Translate;
  lang: Language;
  setLang: (l: Language) => void;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: () => request<Workspace>("/api/work"),
  });
  const [page, setPage] = useState<PageName>("dashboard");
  const [projectId, setProjectId] = useState<string>();
  const [mobile, setMobile] = useState(false);
  const closeNavigation = useCallback(() => setMobile(false), []);
  const isMobile = useMobileNavigation(mobile, closeNavigation);
  const [taskId, setTaskId] = useState<string>();
  const [newTask, setNewTask] = useState(false);
  const [projectForm, setProjectForm] = useState<Project | true | undefined>();
  const [archiveProject, setArchiveProject] = useState<Project>();
  const [fieldsFor, setFieldsFor] = useState<Project>();
  const [layout, setLayout] = useState(defaultView);
  const [section, setSection] = useState(false);
  const [filters, setFilters] = useState(blankFilters);
  const [view, setView] = useState("list");
  const [error, setError] = useState("");
  const detailOpen = newTask || !!projectForm || !!taskId;
  useEffect(() => {
    if (!detailOpen) return;
    window.scrollTo({ top: 0 });
    document.querySelector(".main-shell")?.scrollTo({ top: 0 });
  }, [detailOpen, taskId]);
  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href);
      const requestedPage = url.searchParams.get("page");
      const p = requestedPage === "settings" ? "profile" : requestedPage;
      if (p && [...nav.map((n) => n.id), "admin", "profile"].includes(p))
        setPage(p as PageName);
      else setPage("dashboard");
      const project = url.searchParams.get("project") || undefined;
      setProjectId(project);
      const requestedView = url.searchParams.get("view");
      setView(
        project
          ? projectViews.some((v) => v.id === requestedView)
            ? requestedView!
            : "overview"
          : "list",
      );
      setTaskId(url.searchParams.get("task") || undefined);
      setNewTask(false);
      setProjectForm(undefined);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const go = (p: PageName, id?: string) => {
    setNewTask(false);
    setProjectForm(undefined);
    setTaskId(undefined);
    setPage(p);
    setProjectId(id);
    setFilters(blankFilters);
    setLayout(defaultView);
    setMobile(false);
    setView(id ? "overview" : "list");
    window.history.pushState(
      null,
      "",
      `/?page=${p}${id ? `&project=${id}` : ""}`,
    );
  };
  const refresh = () => client.invalidateQueries({ queryKey: ["workspace"] });
  async function complete(task: Task, done: boolean) {
    setError("");
    try {
      await command(
        "completePart",
        { userId: query.data!.actor.userId, completed: done },
        task.id,
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const data = query.data;
  const currentProject = data?.projects.find((p) => p.id === projectId);
  // Every employee can create projects; managing members still follows HR.
  const canManage = !!data;
  const pageLabel =
    [
      ...nav,
      { id: "admin", label: "Admin" },
      { id: "profile", label: "Your profile" },
    ].find((n) => n.id === page)?.label || "Dashboard";
  const unread = data?.notifications.filter((n) => !n.readAt).length || 0;
  let pageTasks = data?.tasks || [];
  if (page === "my-tasks")
    pageTasks = pageTasks.filter((t) =>
      t.assigneeIds.includes(data!.actor.userId),
    );
  if (page === "team")
    pageTasks = pageTasks.filter(
      (t) =>
        t.projectId &&
        t.assigneeIds.some((id) => reportIds(data!.actor).includes(id)),
    );
  if (page === "projects")
    pageTasks = pageTasks.filter(
      (t) => t.projectId === projectId && !t.parentId,
    );
  const filtered = filterTasks(pageTasks, filters);
  return (
    <div className="app-shell readable-workspace">
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      {mobile && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobile(false)}
          aria-label={t("Close")}
        />
      )}
      <aside
        id="task-navigation"
        inert={isMobile && !mobile}
        role={isMobile && mobile ? "dialog" : undefined}
        aria-modal={isMobile && mobile ? true : undefined}
        aria-label={t("Workspace")}
        className={`sidebar ${mobile ? "is-open" : ""}`}
      >
        <div className="sidebar-brand brand">
          <SanaaBrand className="sana-wordmark" />
          <button
            className="mobile-close icon-button"
            aria-label={t("Close")}
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <span className="nav-label">{t("Workspace")}</span>
        <nav aria-label={t("Workspace")}>
          {nav
            .filter((n) =>
              n.id === "reports" || n.id === "workload"
                ? !!data &&
                  (data.actor.isAdmin || reportIds(data.actor).length > 0)
                : !["team", "my-team"].includes(n.id) ||
                  !!(data ? reportIds(data.actor).length : 0),
            )
            .map((n) => (
              <button
                key={n.id}
                className={`nav-item ${page === n.id ? "active" : ""}`}
                onClick={() => go(n.id)}
              >
                <n.icon size={18} />
                <span>{t(n.label)}</span>
                {n.id === "notifications" && unread > 0 && (
                  <span className="nav-count">{unread}</span>
                )}
                {n.id === "archive" &&
                  !!data &&
                  data.archive.projects.length + data.archive.tasks.length >
                    0 && (
                    <span className="nav-count muted-count">
                      {data.archive.projects.length + data.archive.tasks.length}
                    </span>
                  )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {data?.actor.isAdmin && (
            <button
              className={`nav-item ${page === "admin" ? "active" : ""}`}
              onClick={() => go("admin")}
            >
              <ShieldCheck size={18} />
              <span>{t("Admin")}</span>
            </button>
          )}
          <button
            type="button"
            className="nav-item"
            onClick={async () => {
              await request("/api/auth", { method: "DELETE" });
              window.location.href = "/";
            }}
          >
            <LogOut size={18} />
            <span>{t("Sign out")}</span>
          </button>
          <div className="sidebar-divider" />
          <button
            className="profile-button"
            aria-current={page === "profile" ? "page" : undefined}
            onClick={() => go("profile")}
          >
            <Avatar name={data?.me.name || "Sanaa"} />
            <span>
              <strong>{data?.me.name || "Sanaa"}</strong>
              <small>
                {data?.actor.isAdmin
                  ? t("Admin")
                  : data?.me.jobTitle || t("Workspace")}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={isMobile && mobile}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-controls="task-navigation"
              aria-expanded={mobile}
              aria-label={t("Open navigation")}
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-root">{t("Workspace")}</span>
            <ChevronRight size={13} />
            <span>{t(pageLabel)}</span>
            {currentProject && (
              <>
                <ChevronRight size={13} />
                <span>{currentProject.name}</span>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">
              {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Africa/Cairo",
              }).format(new Date())}
            </span>
            <button
              className="icon-button"
              aria-label={t("Language")}
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
            >
              <Globe2 size={17} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label={t("Notifications")}
              onClick={() => go("notifications")}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <Avatar small name={data?.me.name || "Sanaa"} />
          </div>
        </header>
        {data?.development && (
          <div className="development-banner">
            <ShieldCheck size={13} />
            {t("Development identities · HR is not connected")}
          </div>
        )}
        <main className="workspace-main" id="main-content" tabIndex={-1}>
          {query.isPending ? (
            <Loading t={t} />
          ) : query.error ? (
            <div className="panel error-panel">
              <ErrorBox error={query.error.message} />
              <button
                className="button secondary"
                onClick={() => query.refetch()}
              >
                {t("Retry")}
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  await request("/api/auth", { method: "DELETE" });
                  window.location.reload();
                }}
              >
                {t("Sign out")}
              </button>
            </div>
          ) : (
            data && (
              <>
                {detailOpen && (
                  <>
                    {newTask && (
                      <TaskForm
                        page
                        data={data}
                        projectId={currentProject?.id}
                        t={t}
                        onClose={() => setNewTask(false)}
                        onSaved={async (id) => {
                          setNewTask(false);
                          await refresh();
                          setTaskId(id);
                        }}
                      />
                    )}
                    {!newTask && projectForm && (
                      <ProjectForm
                        page
                        data={data}
                        project={projectForm === true ? undefined : projectForm}
                        t={t}
                        onClose={() => setProjectForm(undefined)}
                        onSaved={async (id) => {
                          setProjectForm(undefined);
                          await refresh();
                          go("projects", id);
                        }}
                      />
                    )}
                    {!newTask && !projectForm && taskId && (
                      <TaskDrawer
                        page
                        key={taskId}
                        id={taskId}
                        data={data}
                        t={t}
                        lang={lang}
                        onClose={() => setTaskId(undefined)}
                        onOpen={setTaskId}
                      />
                    )}
                  </>
                )}
                <div hidden={detailOpen}>
                  {error && (
                    <div className="global-error">
                      <ErrorBox error={error} />
                      <button
                        className="icon-button"
                        onClick={() => setError("")}
                        aria-label={t("Close")}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                  {page === "dashboard" && (
                    <>
                      <PageHeading title={t("Workspace overview")}>
                        <button
                          className="button primary"
                          onClick={() => setNewTask(true)}
                        >
                          <Plus size={16} />
                          {t("New task")}
                        </button>
                      </PageHeading>
                      <Dashboard
                        data={data}
                        t={t}
                        lang={lang}
                        onOpen={setTaskId}
                        onComplete={complete}
                        onProject={(id) => go("projects", id)}
                        onTasks={() => go("my-tasks")}
                        onProjects={() => go("projects")}
                        onCreateProject={() => setProjectForm(true)}
                        onCreateTask={() => setNewTask(true)}
                      />
                    </>
                  )}
                  {page === "my-team" && (
                    <>
                      <PageHeading title={t("My Team")} />
                      <MyTeam
                        actor={data.actor}
                        employees={data.employees}
                        t={t}
                      />
                    </>
                  )}
                  {(page === "my-tasks" ||
                    page === "team" ||
                    (page === "projects" && currentProject)) && (
                    <>
                      {page === "projects" && (
                        <button
                          className="text-button back-link"
                          onClick={() => go("projects")}
                        >
                          ← {t("Back to projects")}
                        </button>
                      )}
                      <PageHeading
                        title={
                          currentProject && page === "projects"
                            ? currentProject.name
                            : t(page === "team" ? "Team Tasks" : "My Tasks")
                        }
                        subtitle={
                          currentProject && page === "projects"
                            ? currentProject.description
                            : undefined
                        }
                      >
                        {currentProject && page === "projects" && (
                          <ProjectActions
                            project={currentProject}
                            data={data}
                            t={t}
                            onEdit={() => setProjectForm(currentProject)}
                            onFields={() => setFieldsFor(currentProject)}
                            onArchive={() => setArchiveProject(currentProject)}
                          />
                        )}
                        {(page !== "projects" ||
                          currentProject?.canContribute) && (
                          <button
                            className="button primary"
                            onClick={() => setNewTask(true)}
                          >
                            <Plus size={16} />
                            {t("New task")}
                          </button>
                        )}
                      </PageHeading>
                      {page === "team" && !reportIds(data.actor).length ? (
                        <Empty
                          title={t("No access")}
                          description={t(
                            "This page is not available for your role.",
                          )}
                        />
                      ) : (
                        <>
                          {currentProject && page === "projects" && (
                            <div className="project-summary">
                              <div className="project-summary-main">
                                <Avatar
                                  small
                                  name={
                                    data.employees.find(
                                      (e) =>
                                        e.userId === currentProject.ownerId,
                                    )?.name || currentProject.ownerId
                                  }
                                />
                                <span>
                                  {
                                    data.employees.find(
                                      (e) =>
                                        e.userId === currentProject.ownerId,
                                    )?.name
                                  }
                                </span>
                                <span className="summary-separator" />
                                <span>
                                  {currentProject.memberIds.length}{" "}
                                  {t("members")}
                                </span>
                                <span className="summary-separator" />
                                <HealthBadge
                                  health={currentProject.health}
                                  t={t}
                                />
                                {currentProject.myRole && (
                                  <span className="badge role-badge">
                                    {t(roleLabels[currentProject.myRole])}
                                  </span>
                                )}
                                <span className="summary-separator" />
                                <CalendarDays size={14} />
                                <span>
                                  {formatDate(currentProject.dueDate, t, lang)}
                                </span>
                              </div>
                              <div className="project-summary-progress">
                                <span>{currentProject.progress}%</span>
                                <div className="mini-progress">
                                  <span
                                    style={{
                                      width: `${currentProject.progress}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                          {page === "team" && (
                            <TeamTaskSummary
                              tasks={pageTasks}
                              t={t}
                              lang={lang}
                            />
                          )}
                          <div className="view-toolbar">
                            <div className="tabs">
                              {(currentProject && page === "projects"
                                ? projectViews
                                : taskViews
                              ).map((v) => (
                                <button
                                  key={v.id}
                                  className={view === v.id ? "active" : ""}
                                  aria-pressed={view === v.id}
                                  onClick={() => {
                                    setView(v.id);
                                    if (currentProject)
                                      window.history.replaceState(
                                        null,
                                        "",
                                        `/?page=projects&project=${currentProject.id}&view=${v.id}`,
                                      );
                                  }}
                                >
                                  <v.icon size={15} />
                                  {t(v.label)}
                                </button>
                              ))}
                            </div>
                            {!["overview", "activity"].includes(view) && (
                              <span className="muted small-text">
                                {filtered.length} {t("tasks")}
                              </span>
                            )}
                          </div>
                          {view === "overview" && currentProject ? (
                            <ProjectOverview
                              project={currentProject}
                              data={data}
                              t={t}
                              lang={lang}
                              onOpen={setTaskId}
                              onView={setView}
                            />
                          ) : view === "activity" && currentProject ? (
                            <section className="panel feed-panel">
                              <ProjectActivity
                                projectId={currentProject.id}
                                data={data}
                                t={t}
                                lang={lang}
                                onOpen={setTaskId}
                              />
                            </section>
                          ) : (
                            <>
                              <FiltersBar
                                value={filters}
                                onChange={setFilters}
                                data={data}
                                t={t}
                                hideProject={page === "projects"}
                                fields={currentProject?.fields}
                              />
                              {view !== "roadmap" && (
                                <SavedViewsBar
                                  key={`${page}-${currentProject?.id ?? ""}`}
                                  scope={
                                    page === "projects"
                                      ? "project"
                                      : page === "team"
                                        ? "team"
                                        : "my-tasks"
                                  }
                                  projectId={currentProject?.id}
                                  data={data}
                                  t={t}
                                  fields={currentProject?.fields ?? []}
                                  filters={filters}
                                  onFilters={setFilters}
                                  view={layout}
                                  onView={setLayout}
                                />
                              )}
                              {page === "projects" &&
                              currentProject?.sections.length ? (
                                <div className="section-pills">
                                  {currentProject.sections.map((s) => (
                                    <span className="badge" key={s.id}>
                                      {s.name}
                                    </span>
                                  ))}
                                  {currentProject.canManage && (
                                    <button
                                      className="text-button"
                                      onClick={() => setSection(true)}
                                    >
                                      <Plus size={13} />
                                      {t("Add section")}
                                    </button>
                                  )}
                                </div>
                              ) : page === "projects" &&
                                currentProject?.canManage ? (
                                <button
                                  className="text-button add-section"
                                  onClick={() => setSection(true)}
                                >
                                  <Plus size={13} />
                                  {t("Add section")}
                                </button>
                              ) : null}
                              {view === "roadmap" && currentProject ? (
                                <ProjectRoadmap
                                  project={currentProject}
                                  tasks={pageTasks}
                                  visibleTasks={filtered}
                                  data={data}
                                  t={t}
                                  lang={lang}
                                  onOpen={setTaskId}
                                />
                              ) : view === "calendar" ? (
                                <TaskCalendar
                                  milestones={data.milestones.filter((m) =>
                                    page === "projects"
                                      ? m.projectId === currentProject?.id
                                      : !filters.project ||
                                        m.projectId === filters.project,
                                  )}
                                  onProject={(id) => go("projects", id)}
                                  tasks={filtered}
                                  t={t}
                                  lang={lang}
                                  onOpen={setTaskId}
                                />
                              ) : !pageTasks.length ? (
                                <div className="panel">
                                  <Empty
                                    title={t("No tasks yet")}
                                    description={t(
                                      "Create your first task to get started.",
                                    )}
                                  >
                                    <button
                                      className="button secondary"
                                      onClick={() => setNewTask(true)}
                                    >
                                      <Plus size={15} />
                                      {t("New task")}
                                    </button>
                                  </Empty>
                                </div>
                              ) : view === "gantt" && currentProject ? (
                                <ProjectGantt
                                  project={currentProject}
                                  tasks={filtered}
                                  milestones={data.milestones.filter(
                                    (m) => m.projectId === currentProject.id,
                                  )}
                                  t={t}
                                  lang={lang}
                                  onOpen={setTaskId}
                                />
                              ) : view === "board" ? (
                                <TaskBoard
                                  tasks={filtered}
                                  data={data}
                                  t={t}
                                  lang={lang}
                                  onOpen={setTaskId}
                                />
                              ) : (
                                <div className="panel">
                                  <TaskList
                                    tasks={filtered}
                                    detailed={page === "team"}
                                    data={data}
                                    t={t}
                                    lang={lang}
                                    onOpen={setTaskId}
                                    onComplete={complete}
                                    view={layout}
                                    fields={currentProject?.fields}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {page === "reports" && (
                    <Reports data={data} t={t} lang={lang} onOpen={setTaskId} />
                  )}
                  {page === "projects" && !currentProject && (
                    <>
                      <PageHeading title={t("Projects")}>
                        {canManage && (
                          <button
                            className="button primary"
                            onClick={() => setProjectForm(true)}
                          >
                            <Plus size={16} />
                            {t("New project")}
                          </button>
                        )}
                      </PageHeading>
                      <div className="projects-toolbar">
                        <div className="tabs">
                          <button
                            className={!filters.status ? "active" : ""}
                            onClick={() =>
                              setFilters({ ...filters, status: "" })
                            }
                          >
                            {t("All")}
                            <span>{data.projects.length}</span>
                          </button>
                          <button
                            className={
                              filters.status === "active" ? "active" : ""
                            }
                            onClick={() =>
                              setFilters({ ...filters, status: "active" })
                            }
                          >
                            {t("Active")}
                          </button>
                          <button
                            className={
                              filters.status === "completed" ? "active" : ""
                            }
                            onClick={() =>
                              setFilters({ ...filters, status: "completed" })
                            }
                          >
                            {t("Completed")}
                          </button>
                        </div>
                      </div>
                      {!data.projects.length ? (
                        <div className="panel">
                          <Empty
                            title={t("No projects yet")}
                            description={t(
                              canManage
                                ? "A shared place for your team’s work."
                                : "Your projects will appear here when a manager adds you.",
                            )}
                          >
                            {canManage && (
                              <button
                                className="button secondary"
                                onClick={() => setProjectForm(true)}
                              >
                                <Plus size={15} />
                                {t("Create project")}
                              </button>
                            )}
                          </Empty>
                        </div>
                      ) : (
                        <div className="project-grid">
                          {data.projects
                            .filter(
                              (p) =>
                                !filters.status || p.status === filters.status,
                            )
                            .map((p) => (
                              <ProjectCard
                                key={p.id}
                                project={p}
                                data={data}
                                t={t}
                                lang={lang}
                                onOpen={() => go("projects", p.id)}
                                onArchive={
                                  p.canManage
                                    ? () => setArchiveProject(p)
                                    : undefined
                                }
                              />
                            ))}
                        </div>
                      )}
                    </>
                  )}
                  {page === "calendar" && (
                    <>
                      <PageHeading title={t("Calendar")}>
                        <button
                          className="button primary"
                          onClick={() => setNewTask(true)}
                        >
                          <Plus size={16} />
                          {t("New task")}
                        </button>
                      </PageHeading>
                      <FiltersBar
                        value={filters}
                        onChange={setFilters}
                        data={data}
                        t={t}
                      />
                      <TaskCalendar
                        milestones={data.milestones.filter(
                          (m) =>
                            !filters.project || m.projectId === filters.project,
                        )}
                        onProject={(id) => go("projects", id)}
                        tasks={filtered}
                        t={t}
                        lang={lang}
                        onOpen={setTaskId}
                      />
                    </>
                  )}
                  {page === "notifications" && (
                    <>
                      <PageHeading title={t("Notifications")}>
                        <button
                          className="button secondary"
                          onClick={async () => {
                            await command("markRead");
                            await refresh();
                          }}
                        >
                          <CheckCheck size={16} />
                          {t("Mark all as read")}
                        </button>
                      </PageHeading>
                      <div className="panel notification-list">
                        {!data.notifications.length ? (
                          <Empty
                            title={t("You’re all caught up")}
                            description={t("New updates will appear here.")}
                          />
                        ) : (
                          data.notifications.map((n) => (
                            <button
                              key={n.id}
                              className={`notification-row ${!n.readAt ? "unread" : ""}`}
                              onClick={async () => {
                                setTaskId(n.taskId);
                                await command("markRead", undefined, n.id);
                                await refresh();
                              }}
                            >
                              <span className="notification-icon">
                                {n.kind === "mention" ? (
                                  <AtSign size={18} />
                                ) : n.kind === "comment" ? (
                                  <Users size={18} />
                                ) : n.kind === "overdue" ? (
                                  <Clock3 size={18} />
                                ) : (
                                  <CheckSquare2 size={18} />
                                )}
                              </span>
                              <span>
                                <strong>
                                  {t(
                                    (
                                      {
                                        assignment: "New assignment",
                                        comment: "New comment",
                                        mention: "Mentioned you",
                                        update: "Task updated",
                                        upcoming: "Due soon",
                                        overdue: "Overdue task",
                                      } as Record<string, string>
                                    )[n.kind] || n.kind,
                                  )}
                                </strong>
                                <p>{n.message}</p>
                                <time>
                                  {new Intl.DateTimeFormat(
                                    lang === "ar" ? "ar-EG" : "en-GB",
                                    { dateStyle: "medium", timeStyle: "short" },
                                  ).format(new Date(n.createdAt))}
                                </time>
                              </span>
                              {!n.readAt && <i aria-label={t("Unread")} />}
                              <ChevronRight size={16} />
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                  {page === "workload" && (
                    <>
                      <PageHeading icon={Users} title={t("Team workload")} />
                      {data.actor.isAdmin || reportIds(data.actor).length ? (
                        <WorkloadPage
                          data={data}
                          people={
                            data.actor.isAdmin
                              ? data.employees.map((e) => e.userId)
                              : reportIds(data.actor)
                          }
                          t={t}
                          lang={lang}
                          onPerson={(userId) => {
                            go(reportIds(data.actor).length ? "team" : "admin");
                            setFilters({ ...blankFilters, assignee: userId });
                          }}
                          onTeam={() => {
                            go(reportIds(data.actor).length ? "team" : "admin");
                            setFilters(blankFilters);
                          }}
                        />
                      ) : (
                        <Empty
                          title={t("No access")}
                          description={t(
                            "This page is not available for your role.",
                          )}
                        />
                      )}
                    </>
                  )}
                  {page === "archive" && (
                    <>
                      <PageHeading title={t("Archive")} />
                      <ArchivePage
                        data={data}
                        t={t}
                        lang={lang}
                        onOpen={setTaskId}
                      />
                    </>
                  )}
                  {page === "profile" && (
                    <WorkspaceSettings me={data.me} t={t} />
                  )}
                  {page === "admin" &&
                    (data.actor.isAdmin ? (
                      <AdminPage
                        data={data}
                        t={t}
                        lang={lang}
                        onOpen={setTaskId}
                        onComplete={complete}
                      />
                    ) : (
                      <Empty
                        title={t("No access")}
                        description={t(
                          "This page is not available for your role.",
                        )}
                      />
                    ))}
                </div>
              </>
            )
          )}
          <footer className="workspace-footer">
            <span>
              Sanaa Tasks
            </span>
            <span>{t("Simple by default.")}</span>
          </footer>
        </main>
      </div>
      {archiveProject && (
        <Confirm
          t={t}
          action="archive"
          onClose={() => setArchiveProject(undefined)}
          onConfirm={async () => {
            await command("archiveProject", undefined, archiveProject.id);
            await refresh();
            if (projectId === archiveProject.id) go("projects");
          }}
        />
      )}
      {fieldsFor && (
        <FieldsManager
          project={
            data?.projects.find((p) => p.id === fieldsFor.id) ?? fieldsFor
          }
          t={t}
          onClose={() => setFieldsFor(undefined)}
        />
      )}
      {section && currentProject && (
        <SectionForm
          t={t}
          projectId={currentProject.id}
          onClose={() => setSection(false)}
          onSaved={async () => {
            setSection(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
function PageHeading({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon?: typeof Users;
  title: string;
  subtitle?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>
          {Icon && (
            <span className="page-heading-icon">
              <Icon size={26} aria-hidden="true" />
            </span>
          )}
          {title}
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Dashboard({
  data,
  t,
  lang,
  onOpen,
  onComplete,
  onProject,
  onTasks,
  onProjects,
  onCreateProject,
  onCreateTask,
}: {
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  onComplete: (t: Task, d: boolean) => void;
  onProject: (id: string) => void;
  onTasks: () => void;
  onProjects: () => void;
  onCreateProject: () => void;
  onCreateTask: () => void;
}) {
  const tasks = data.tasks;
  const today = dateToday();
  const active = data.projects.filter((p) => p.status === "active");
  const manageable = data.actor.isAdmin || !!reportIds(data.actor).length;
  const stats = [
    {
      label: "Total tasks",
      value: tasks.length,
      icon: CheckSquare2,
      color: "teal",
    },
    {
      label: "To Do",
      value: tasks.filter((t) => t.status === "todo").length,
      icon: Circle,
      color: "gray",
    },
    {
      label: "In Progress",
      value: tasks.filter((t) => t.status === "in_progress").length,
      icon: Clock3,
      color: "amber",
    },
    {
      label: "Done",
      value: tasks.filter((t) => t.status === "done").length,
      icon: CheckCheck,
      color: "green",
    },
    {
      label: "Overdue",
      value: tasks.filter(
        (t) => t.dueDate && t.dueDate < today && t.status !== "done",
      ).length,
      icon: CalendarDays,
      color: "rose",
    },
  ];
  const attention = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 6);
  return (
    <>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div>
              <span>{t(stat.label)}</span>
              <span className={`stat-icon ${stat.color}`}>
                <stat.icon size={17} />
              </span>
            </div>
            <strong>{new Intl.NumberFormat(lang).format(stat.value)}</strong>
          </div>
        ))}
      </div>
      {!tasks.length && (
        <div className="getting-started">
          <div className="getting-started-icon">
            <FolderOpen size={29} />
          </div>
          <div>
            <span className="eyebrow">{t("Your workspace")}</span>
            <h2>
              {t(
                manageable
                  ? "Get your workspace started"
                  : "Start with a personal task",
              )}
            </h2>
            <p>
              {t(
                manageable
                  ? "Create a project, bring in your team, and give the next step an owner."
                  : "Capture a next step. You can add project work as your team grows.",
              )}
            </p>
          </div>
          <button
            className="button primary"
            onClick={manageable ? onCreateProject : onCreateTask}
          >
            {t(manageable ? "Create project" : "Create task")}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <section className="panel attention-panel">
        <div className="panel-header">
          <div>
            <h2>{t("Tasks that need attention")}</h2>
            <p>{t("Your next steps, all in one place.")}</p>
          </div>
          <button className="text-button" onClick={onTasks}>
            {t("View all tasks")}
            <ArrowUpRight size={14} />
          </button>
        </div>
        {attention.length ? (
          <TaskList
            tasks={attention}
            data={data}
            t={t}
            lang={lang}
            onOpen={onOpen}
            onComplete={onComplete}
            compact
          />
        ) : (
          <Empty
            title={t(tasks.length ? "You’re all caught up" : "No tasks yet")}
            description={t(
              tasks.length
                ? "New updates will appear here."
                : "Create your first task to get started.",
            )}
          />
        )}
      </section>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-header">
            <h2>
              {t("Active projects")}
              <span className="count">{active.length}</span>
            </h2>
            <button className="text-button" onClick={onProjects}>
              {t("View projects")}
              <ArrowUpRight size={14} />
            </button>
          </div>
          {!active.length ? (
            <Empty
              title={t("No projects yet")}
              description={t("A shared place for your team’s work.")}
            />
          ) : (
            <ProjectsChart
              projects={active}
              tasks={tasks}
              t={t}
              lang={lang}
              today={today}
              onProject={onProject}
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>{t("Tasks by priority")}</h2>
            <span className="muted small-text">
              {tasks.length} {t("tasks")}
            </span>
          </div>
          {tasks.length ? (
            <PriorityChart tasks={tasks} t={t} lang={lang} today={today} />
          ) : (
            <p className="chart-empty">
              {t("Your team’s work will appear here.")}
            </p>
          )}
        </section>
      </div>
      {manageable && (
        <section className="panel employee-panel">
          <div className="panel-header">
            <h2>{t("Tasks by employee")}</h2>
          </div>
          {!tasks.length ? (
            <div className="small-empty">{t("No data yet")}</div>
          ) : (
            <EmployeeChart
              employees={data.employees.filter(
                (e) =>
                  data.actor.isAdmin ||
                  reportIds(data.actor).includes(e.userId),
              )}
              tasks={tasks}
              t={t}
              lang={lang}
              today={today}
            />
          )}
        </section>
      )}
    </>
  );
}
function ProjectCard({
  project: p,
  data,
  t,
  lang,
  onOpen,
  onArchive,
}: {
  project: Project;
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: () => void;
  onArchive?: () => void;
}) {
  return (
    <article className="project-card panel">
      <div className="project-card-heading">
        <span className="project-icon">
          <Folder size={21} />
        </span>
        <span className="project-card-badges">
          <HealthBadge health={p.health} t={t} />
          <span
            className={`badge ${p.status === "active" ? "status-in_progress" : "status-done"}`}
          >
            {t(p.status === "active" ? "Active" : "Completed")}
          </span>
        </span>
      </div>
      <button className="project-title" onClick={onOpen}>
        {p.name}
        <ArrowUpRight size={17} />
      </button>
      <p>{p.description || t("No description")}</p>
      <div className="project-card-progress">
        <span>{t("Progress")}</span>
        <strong>{p.progress}%</strong>
      </div>
      <div className="mini-progress">
        <span style={{ width: `${p.progress}%` }} />
      </div>
      <div className="project-card-meta">
        <span>
          <CheckSquare2 size={14} />
          {p.taskCount} {t("tasks")}
        </span>
        <span>
          <CalendarDays size={14} />
          {formatDate(p.dueDate, t, lang)}
        </span>
      </div>
      <div className="project-card-footer">
        <div className="avatar-stack">
          {[...new Set([p.ownerId, ...p.memberIds])].slice(0, 4).map((id) => (
            <Avatar
              key={id}
              small
              name={data.employees.find((e) => e.userId === id)?.name || id}
            />
          ))}
        </div>
        {onArchive && (
          <button className="text-button muted" onClick={onArchive}>
            <Archive size={13} />
            {t("Archive project")}
          </button>
        )}
      </div>
    </article>
  );
}
function ProjectActions({
  project,
  data,
  t,
  onEdit,
  onFields,
  onArchive,
}: {
  project: Project;
  data: Workspace;
  t: Translate;
  onEdit: () => void;
  onFields: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!project.canManage) return null;
  const item = (label: string, action: () => void) => (
    <button
      role="menuitem"
      onClick={() => {
        setOpen(false);
        action();
      }}
    >
      {t(label)}
    </button>
  );
  return (
    <div className="project-actions">
      <button className="button secondary" onClick={onEdit}>
        {t("Edit project")}
      </button>
      <div className="menu-wrap">
        <button
          className="button secondary icon-only"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("More project actions")}
          onClick={() => setOpen(!open)}
        >
          <Settings2 size={16} />
        </button>
        {open && (
          <>
            <button
              className="menu-backdrop"
              aria-label={t("Close")}
              onClick={() => setOpen(false)}
            />
            <div className="menu" role="menu">
              {item("Custom fields", onFields)}
              {item("Archive project", onArchive)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function SectionForm({
  t,
  projectId,
  onClose,
  onSaved,
}: {
  t: Translate;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t("Add section")} t={t} onClose={onClose}>
      <form
        className="form-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            await command("addSection", { name: form.get("name") }, projectId);
            onSaved();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("Section name")}>
          <input name="name" required autoFocus maxLength={100} />
        </Field>
        {error && <ErrorBox error={error} />}
        <div className="form-footer">
          <button className="button primary" disabled={busy}>
            {t("Add section")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AdminPage({
  data,
  t,
  lang,
  onOpen,
  onComplete,
}: {
  data: Workspace;
  t: Translate;
  lang: Language;
  onOpen: (id: string) => void;
  onComplete: (t: Task, d: boolean) => void;
}) {
  const client = useQueryClient();
  const admins = useQuery({
    queryKey: ["admins"],
    queryFn: () => request<{ userId: string }[]>("/api/work?admins=1"),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(blankFilters);
  const change = async (id: string, enabled: boolean) => {
    setBusy(true);
    setError("");
    try {
      await command("setAdmin", { userId: id, enabled });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admins"] }),
        client.invalidateQueries({ queryKey: ["workspace"] }),
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading title={t("Access and integration")} />
      {error && <ErrorBox error={error} />}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="section-heading">
            <h3>
              <ShieldCheck size={18} />
              {t("TASK administrators")}
            </h3>
          </div>
          {admins.error && <ErrorBox error={admins.error.message} />}
          <div className="admin-list">
            {data.employees.map((e) => {
              const enabled = admins.data?.some((a) => a.userId === e.userId);
              return (
                <div className="assignee-row" key={e.userId}>
                  <Avatar small name={e.name} />
                  <span>{e.name}</span>
                  <button
                    className="text-button"
                    disabled={busy || admins.isPending}
                    onClick={() => change(e.userId, !enabled)}
                  >
                    {t(enabled ? "Remove admin" : "Grant admin")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="section-heading">
            <h3>{t("HR integration")}</h3>
            <span className="badge">
              {t(
                data.development
                  ? "Development adapter"
                  : data.hrConfigured
                    ? "Connected adapter"
                    : "Not configured",
              )}
            </span>
          </div>
          <p className="muted">
            {t("HR is the source of truth for identities and direct reports.")}
          </p>
          <p className="helper">
            {t(
              "Connection settings are managed through server environment variables.",
            )}
          </p>
          <div className="config-names">
            <code>HR_API_URL</code>
            <code>SESSION_SECRET</code>
            <code>TASK_BOOTSTRAP_ADMINS</code>
          </div>
        </section>
      </div>
      <div className="panel-header admin-work-heading">
        <h2>{t("Total tasks")}</h2>
        <span className="muted small-text">
          {data.tasks.length} {t("tasks")}
        </span>
      </div>
      <FiltersBar value={filters} onChange={setFilters} data={data} t={t} />
      <div className="panel">
        <TaskList
          tasks={filterTasks(data.tasks, filters)}
          data={data}
          t={t}
          lang={lang}
          onOpen={onOpen}
          onComplete={onComplete}
        />
      </div>
    </>
  );
}
