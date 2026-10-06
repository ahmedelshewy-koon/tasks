// Browser verification for V1 advanced core features. Run against an isolated
// development instance only:
//   TASK_TEST_URL=http://127.0.0.1:3108 node scripts/verify-advanced-core.mjs
// It creates temporary verification work and archives it afterward.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.TASK_TEST_URL;
if (!base)
  throw new Error("Set TASK_TEST_URL to an isolated development instance.");
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (days) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
await mkdir(".data/verification", { recursive: true });
const run = Date.now().toString(36);
const kit = `V1 kit ${run}`;
const copyName = `From kit ${run}`;
const shot = (page, name) =>
  page.screenshot({ path: `.data/verification/v1-${name}.png`, fullPage: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const sessions = [];
async function session(user, { lang = "en", width = 1440, height = 1000 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  sessions.push(context);
  const auth = await context.request.post(`${base}/api/auth`, {
    headers: { origin: base },
    data: { token: user },
  });
  assert.equal(auth.status(), 200, `sign in ${user}`);
  await context.addInitScript(
    (l) => localStorage.setItem("task-language", l),
    lang,
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${user}: ${error.message}`));
  const command = async (action, data, id) => {
    const response = await context.request.post(`${base}/api/work`, {
      headers: { origin: base },
      data: { action, data, id },
    });
    const body = await response.json();
    return { status: response.status(), body };
  };
  const ok = async (action, data, id) => {
    const r = await command(action, data, id);
    assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.body)}`);
    return r.body;
  };
  return { page, command, ok };
}
const noHorizontalScroll = async (page, label) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 1, `${label}: page scrolls horizontally by ${overflow}px`);
};

let projectId, copyId;
const admin = await session("local-admin");
try {
  // ---- Seed through the API as admin, owned by the manager ----
  const project = await admin.ok("createProject", {
    name: "V1 verification",
    ownerId: "local-manager",
    startDate: shift(-10),
    dueDate: shift(20),
    memberIds: ["local-employee", "local-colleague"],
    roles: { "local-colleague": "viewer" },
    sectionNames: ["Plan", "Build"],
  });
  projectId = project.id;
  const manager = await session("local-manager");
  await manager.ok(
    "saveField",
    { name: "Client", type: "select", options: ["Acme", "Globex"] },
    projectId,
  );
  const late = await manager.ok("createTask", {
    title: "Overdue spec",
    projectId,
    priority: "urgent",
    dueDate: shift(-2),
    assigneeIds: ["local-employee"],
    tags: ["Spec", "Q4"],
  });
  const weekly = await manager.ok("createTask", {
    title: "Weekly sync notes",
    projectId,
    dueDate: shift(1),
    assigneeIds: ["local-employee"],
    recurrence: "weekly",
    tags: ["Ops"],
  });
  await manager.ok("createTask", {
    title: "Build dashboard",
    projectId,
    dueDate: shift(5),
    priority: "high",
    assigneeIds: ["local-manager"],
  });
  // Viewers cannot be assigned or comment (server side).
  assert.equal(
    (
      await manager.command("createTask", {
        title: "x",
        projectId,
        assigneeIds: ["local-colleague"],
      })
    ).status,
    403,
  );

  // ---- Manager: Overview, health override, list, saved views (EN desktop) ----
  const { page } = manager;
  await page.goto(`${base}/?page=projects&project=${projectId}`);
  await page.getByText("Project health").waitFor();
  await page.getByRole("button", { name: "Project Map", exact: true }).waitFor();
  for (const tab of ["Overview", "List", "Board", "Calendar", "Activity"])
    await page.getByRole("button", { name: tab, exact: true }).first().waitFor();
  await page.locator(".health-card .health-badge").waitFor();
  await page.getByText("Overdue spec").first().waitFor();
  await shot(page, "overview-en");
  await page.locator(".health-card select").selectOption("off_track");
  await page
    .locator(".health-card .health-badge", { hasText: "Off track" })
    .waitFor();
  await page.getByText("set project health manually").first().waitFor();

  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.locator(".tag-chip", { hasText: "#Spec" }).first().waitFor();
  await page.getByRole("button", { name: "Customize" }).click();
  await page.getByLabel("Group by").selectOption("priority");
  await page.locator(".group-row", { hasText: "Urgent" }).waitFor();
  await page
    .locator(".column-picker label", { hasText: "Client" })
    .locator("input")
    .check();
  await page.getByRole("button", { name: "Save view" }).first().click();
  await page.getByLabel("View name").fill("By priority");
  await page.locator(".save-view-form button.primary").click();
  await page.locator(".view-pill.active", { hasText: "By priority" }).waitFor();
  await page.locator(".task-table th", { hasText: "Client" }).waitFor();
  await page.getByLabel("Tag").selectOption({ label: "#Ops" });
  await page.locator(".task-table").getByText("Weekly sync notes").waitFor();
  assert.equal(await page.getByText("Overdue spec").count(), 0);
  await shot(page, "list-saved-view-en");

  // ---- Task drawer: custom field, mention ----
  await page.goto(`${base}/?page=projects&project=${projectId}&task=${late.id}`);
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("heading", { name: "Overdue spec" }).waitFor();
  await drawer.getByLabel("Client").selectOption("Acme");
  await drawer.getByLabel("Client").and(page.locator(":enabled")).waitFor();
  const box = drawer.getByRole("combobox", { name: "Write a comment…" });
  await box.click();
  await box.pressSequentially("Please check @Local e");
  await drawer.getByRole("option", { name: "Local employee" }).click();
  await box.pressSequentially("thanks");
  await drawer.getByRole("button", { name: "Post comment" }).click();
  await drawer.locator(".comment .mention", { hasText: "@Local employee" }).waitFor();
  await shot(page, "drawer-mention-en");

  // ---- Archive and restore a task through the UI ----
  await drawer.getByRole("button", { name: "Archive task" }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.goto(`${base}/?page=archive`);
  await page.locator(".archive-list").getByText("Overdue spec").waitFor();
  await shot(page, "archive-en");
  const row = page.locator(".archive-list li", { hasText: "Overdue spec" });
  await row.getByRole("button", { name: "Restore" }).click();
  await row.waitFor({ state: "detached" });

  // ---- Template: save then create a project from it ----
  await page.goto(`${base}/?page=projects&project=${projectId}`);
  await page.getByRole("button", { name: "More project actions" }).click();
  await page.getByRole("menuitem", { name: "Save as template" }).click();
  await page.getByLabel("Template name").fill(kit);
  await page.getByRole("button", { name: "Save template" }).click();
  await page.getByRole("heading", { name: "Project templates" }).waitFor();
  await page.locator(".template-card", { hasText: kit }).waitFor();
  const card = page.locator(".template-card", { hasText: kit });
  await card.getByRole("button", { name: "View contents" }).click();
  await shot(page, "templates-en");
  await card.getByRole("button", { name: "Use template" }).click();
  await page.getByLabel("Project name").fill(copyName);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("heading", { name: copyName }).waitFor();
  copyId = new URL(page.url()).searchParams.get("project");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByText("Build dashboard").first().waitFor();

  // ---- Workload ----
  await page.goto(`${base}/?page=workload`);
  await page.locator(".workload-table").getByText("Local employee").waitFor();
  await shot(page, "workload-en");

  // ---- Employee: mention notification; viewer: read-only ----
  const employee = await session("local-employee");
  await employee.page.goto(`${base}/?page=notifications`);
  await employee.page.getByText("Mentioned you").first().waitFor();
  const done = await employee.ok("completePart", {
    userId: "local-employee",
    completed: true,
  }, weekly.id);
  assert.ok(done);
  const snapshot = await (
    await employee.page.request.get(`${base}/api/work`)
  ).json();
  const copies = snapshot.tasks.filter(
    (t) => t.title === "Weekly sync notes" && t.projectId === projectId,
  );
  assert.equal(copies.length, 2, "recurrence created the next task");
  assert.ok(copies.some((t) => t.dueDate === shift(8)));

  const viewer = await session("local-colleague");
  await viewer.page.goto(
    `${base}/?page=projects&project=${projectId}&task=${late.id}`,
  );
  await viewer.page
    .getByText("Viewers can read comments but cannot post.")
    .waitFor();
  assert.equal(await viewer.page.getByRole("button", { name: "New task" }).count(), 0);

  // ---- Arabic, mobile width, RTL ----
  const mobile = await session("local-manager", {
    lang: "ar",
    width: 390,
    height: 844,
  });
  await mobile.page.goto(`${base}/?page=projects&project=${projectId}`);
  await mobile.page.getByText("صحة المشروع").first().waitFor();
  assert.equal(
    await mobile.page.evaluate(() => document.documentElement.dir),
    "rtl",
  );
  await noHorizontalScroll(mobile.page, "overview ar mobile");
  await shot(mobile.page, "overview-ar-mobile");
  await mobile.page.getByRole("button", { name: "النشاط", exact: true }).click();
  await mobile.page.locator(".project-feed").waitFor();
  await noHorizontalScroll(mobile.page, "activity ar mobile");
  await shot(mobile.page, "activity-ar-mobile");
  await mobile.page.goto(`${base}/?page=workload`);
  await mobile.page.locator(".workload-table").waitFor();
  await noHorizontalScroll(mobile.page, "workload ar mobile");
  await shot(mobile.page, "workload-ar-mobile");
  await mobile.page.goto(`${base}/?page=templates`);
  await mobile.page.locator(".template-card").first().waitFor();
  await noHorizontalScroll(mobile.page, "templates ar mobile");
  await shot(mobile.page, "templates-ar-mobile");

  // ---- Admin: archive, then permanently delete the copy ----
  await admin.ok("archiveProject", undefined, copyId);
  await admin.page.goto(`${base}/?page=archive`);
  await admin.page.locator(".archive-list li", { hasText: copyName }).first().waitFor();
  await admin.page
    .locator(".archive-list li", { hasText: copyName })
    .getByRole("button", { name: "Delete permanently" })
    .click();
  await admin.page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently" })
    .click();
  await admin.page.getByText("permanently deleted a project").first().waitFor();
  copyId = undefined;
  await shot(admin.page, "archive-admin-en");

  assert.deepEqual(errors, [], "no client-side exceptions");
  console.log("PASS: advanced core features verified in the browser.");
} catch (error) {
  console.error(error);
  for (const ctx of sessions)
    for (const p of ctx.pages()) await p.screenshot({ path: `.data/verification/v1-failure-${sessions.indexOf(ctx)}.png`, fullPage: true }).catch(() => {});
  if (errors.length) console.error("Page errors:", errors);
  process.exitCode = 1;
} finally {
  if (copyId) await admin.command("archiveProject", undefined, copyId);
  if (projectId) await admin.command("archiveProject", undefined, projectId);
  const snapshot = await (await admin.page.request.get(`${base}/api/work`)).json();
  for (const template of snapshot.templates ?? [])
    if (template.name === kit)
      await admin.command("deleteTemplate", undefined, template.id);
  await browser.close();
}
