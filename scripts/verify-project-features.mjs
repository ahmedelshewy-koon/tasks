import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base = process.env.TASK_TEST_URL;
if (!base)
  throw new Error("Set TASK_TEST_URL to an isolated development instance.");
const month = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .slice(0, 7);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let project;
async function command(action, data, id) {
  const response = await context.request.post(`${base}/api/work`, {
    headers: { origin: base },
    data: { action, data, id },
  });
  const body = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(body));
  return body;
}
try {
  const auth = await context.request.post(`${base}/api/auth`, {
    headers: { origin: base },
    data: { token: "local-admin" },
  });
  assert.equal(auth.status(), 200);
  project = await command("createProject", {
    name: "Feature verification",
    memberIds: ["local-employee", "local-colleague"],
  });
  const blocker = await command("createTask", {
    title: "Review release",
    projectId: project.id,
    assigneeIds: ["local-employee", "local-colleague"],
    dueDate: `${month}-20`,
  });
  const task = await command("createTask", {
    title: "Publish release",
    projectId: project.id,
    assigneeIds: ["local-employee"],
    dueDate: `${month}-21`,
  });
  await command(
    "setDependency",
    { blockerId: blocker.id, enabled: true },
    task.id,
  );
  const milestone = await command(
    "saveMilestone",
    {
      name: "Release approval",
      description: "Review all delivery work",
      dueDate: `${month}-21`,
    },
    project.id,
  );
  await command("linkMilestone", { milestoneId: milestone.id }, task.id);
  await page.addInitScript(() => localStorage.setItem("task-language", "en"));
  await page.goto(
    `${base}/?page=projects&project=${project.id}&task=${task.id}`,
  );
  await page
    .getByRole("heading", { name: "Publish release", exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: /Dependencies/ })
    .waitFor();
  await page
    .getByRole("textbox", { name: "New checklist item" })
    .fill("Confirm release notes");
  await page
    .getByRole("textbox", { name: "New checklist item" })
    .press("Enter");
  const check = page.getByRole("checkbox", {
    name: "Confirm release notes",
    exact: true,
  });
  await check.waitFor();
  await check.click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("1 / 1 completed"),
  );
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/work") &&
        response.request().method() === "POST",
    ),
    page
      .getByRole("combobox", { name: "Due date reminder" })
      .selectOption("60"),
  ]);
  await mkdir(".data/verification", { recursive: true });
  await page.screenshot({
    path: ".data/verification/task-features-en.png",
    fullPage: true,
  });
  await page.goto(`${base}/?page=projects&project=${project.id}`);
  await page.getByRole("button", { name: "Manage" }).click();
  await page
    .getByRole("button", { name: "Add milestone", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Final delivery");
  await page.getByLabel("Due date", { exact: true }).last().fill(`${month}-25`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("◇ Final delivery", { exact: true }).waitFor();
  await page.screenshot({
    path: ".data/verification/project-map-en.png",
    fullPage: true,
  });
  await page.goto(`${base}/?page=reports`);
  await page.getByRole("heading", { name: "Reports", exact: true }).waitFor();
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption(project.id);
  await page.getByRole("heading", { name: "Detailed Task Table" }).waitFor();
  await page.screenshot({
    path: ".data/verification/reports-en.png",
    fullPage: true,
  });
  await page.goto(`${base}/?page=calendar`);
  await page
    .getByRole("button", { name: "◇ Release approval · Upcoming", exact: true })
    .waitFor();
  const ar = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await ar.addCookies(await context.cookies());
  const mobile = await ar.newPage();
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(
    `${base}/?page=projects&project=${project.id}&task=${task.id}`,
  );
  await mobile.getByRole("heading", { name: "قائمة تحقق" }).waitFor();
  assert.equal(await mobile.locator("html").getAttribute("dir"), "rtl");
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await mobile
    .getByRole("heading", { name: "قائمة تحقق" })
    .scrollIntoViewIfNeeded();
  await mobile.screenshot({
    path: ".data/verification/task-features-ar-mobile.png",
    fullPage: true,
  });
  await ar.close();
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: dependency display, checklist editing/completion, reminder update, milestone creation, Project Map, report filters, calendar, and Arabic mobile RTL.",
  );
} catch (error) {
  console.log((await page.locator("body").innerText()).slice(0, 12000));
  await mkdir(".data/verification", { recursive: true });
  await page.screenshot({
    path: ".data/verification/failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  if (project) {
    await command("archiveProject", undefined, project.id);
    await command("purgeProject", undefined, project.id);
  }
  await browser.close();
}
