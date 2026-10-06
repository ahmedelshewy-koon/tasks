import assert from "node:assert/strict";
const base = process.env.TASK_TEST_URL || "http://127.0.0.1:3107";
async function session(token) {
  const response = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers.get("set-cookie").split(";")[0];
  return async (path = "/api/work", action, data, id) => {
    const response = await fetch(`${base}${path}`, {
      method: action ? "POST" : "GET",
      headers: { cookie, origin: base, "content-type": "application/json" },
      ...(action ? { body: JSON.stringify({ action, data, id }) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
}
const admin = await session("local-admin"),
  manager = await session("local-manager"),
  employee = await session("local-employee"),
  peer = await session("local-colleague");
let project, personal;
try {
  assert.equal((await admin()).body.actor.isAdmin, true);
  assert.deepEqual((await manager()).body.actor.directReportIds.sort(), [
    "local-colleague",
    "local-employee",
  ]);
  const p = await manager("/api/work", "createProject", {
    name: "API verification (temporary)",
    memberIds: ["local-employee", "local-colleague"],
  });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  project = p.body.id;
  const task = await manager("/api/work", "createTask", {
    title: "Shared API verification",
    projectId: project,
    assigneeIds: ["local-employee", "local-colleague"],
  });
  assert.equal(task.status, 200, JSON.stringify(task.body));
  const taskId = task.body.id;
  assert.equal(
    (
      await employee(
        "/api/work",
        "completePart",
        { userId: "local-employee", completed: true },
        taskId,
      )
    ).status,
    200,
  );
  assert.equal(
    (await manager(`/api/work?task=${taskId}`)).body.task.status,
    "in_progress",
  );
  assert.equal(
    (
      await employee(
        "/api/work",
        "completePart",
        { userId: "local-colleague", completed: true },
        taskId,
      )
    ).status,
    403,
  );
  await peer(
    "/api/work",
    "completePart",
    { userId: "local-colleague", completed: true },
    taskId,
  );
  assert.equal(
    (await manager(`/api/work?task=${taskId}`)).body.task.status,
    "done",
  );
  const privateResult = await employee("/api/work", "createTask", {
    title: "Private API verification",
    assigneeIds: ["local-employee"],
  });
  personal = privateResult.body.id;
  assert.equal((await manager(`/api/work?task=${personal}`)).status, 403);
  assert.equal((await admin(`/api/work?task=${personal}`)).status, 200);
  assert.equal(
    (
      await peer(
        "/api/work",
        "addComment",
        { body: "Verification comment" },
        taskId,
      )
    ).status,
    200,
  );
  assert.equal(
    (await employee(`/api/work?task=${taskId}`)).body.comments.length,
    1,
  );
  assert.equal(
    (await employee()).body.notifications.some(
      (n) => n.taskId === taskId && n.kind === "assignment",
    ),
    true,
  );
  const unauth = await fetch(`${base}/api/work`);
  assert.equal(unauth.status, 401);
  console.log(
    "PASS: real HTTP sessions, roles, assignments, completion, personal privacy, comments, notifications, unauthenticated rejection.",
  );
} finally {
  if (project)
    assert.equal(
      (await manager("/api/work", "archiveProject", undefined, project)).status,
      200,
    );
  if (personal)
    assert.equal(
      (await employee("/api/work", "archiveTask", undefined, personal)).status,
      200,
    );
  console.log("Temporary verification work archived (an admin can delete it permanently from Archive).");
}
