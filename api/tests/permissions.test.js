const test = require("node:test");
const assert = require("node:assert/strict");
const { src, createDb, run } = require("./helpers/env");

const db = createDb();
const { getRoleOf, canView, canEdit, isOwner } = src("utils", "taskAccess.js");
const { requireTaskAccess } = src("middleware", "permissionMiddleware.js");
const { validateObjectIdParams } = src("middleware", "validateMiddleware.js");

const owner = db.addUser("Chu", "chu@x.com");
const editor = db.addUser("Bien Tap", "editor@x.com");
const viewer = db.addUser("Xem", "viewer@x.com");
const primary = db.addUser("Chinh", "primary@x.com");
const assigned = db.addUser("Duoc Giao", "assigned@x.com");
const stranger = db.addUser("La", "la@x.com");

const task = db.addTask(owner._id, {
  assignees: [{ user: primary._id, isPrimary: true }, { user: assigned._id, isPrimary: false }],
  sharedWith: [{ user: editor._id, role: "editor" }, { user: viewer._id, role: "viewer" }],
});

test("vai tro: chu so huu / editor / viewer / nguoi la", () => {
  assert.equal(getRoleOf(task, owner._id), "owner");
  assert.equal(getRoleOf(task, primary._id), "editor"); // phu trach chinh duoc sua
  assert.equal(getRoleOf(task, assigned._id), "viewer"); // duoc giao nhung khong chinh: chi xem
  assert.equal(getRoleOf(task, editor._id), "editor");
  assert.equal(getRoleOf(task, viewer._id), "viewer");
  assert.equal(getRoleOf(task, stranger._id), null);
});

test("quyen: viewer khong sua duoc, editor khong phai chu so huu", () => {
  assert.ok(canView(task, viewer._id) && !canEdit(task, viewer._id));
  assert.ok(canEdit(task, editor._id) && !isOwner(task, editor._id));
  assert.ok(isOwner(task, owner._id));
  assert.ok(!canView(task, stranger._id));
});

test("so sanh id van dung khi truong da duoc populate thanh document", () => {
  const populated = {
    createdBy: { _id: owner._id, fullName: "Chu" },
    assignees: [{ user: { _id: primary._id, fullName: "Chinh" }, isPrimary: true }],
    sharedWith: [{ user: { _id: viewer._id }, role: "viewer" }],
  };
  assert.equal(getRoleOf(populated, owner._id), "owner");
  assert.equal(getRoleOf(populated, primary._id), "editor");
  assert.equal(getRoleOf(populated, viewer._id), "viewer");
  assert.equal(getRoleOf(populated, stranger._id), null);
});

test("middleware: 404 khi khong co task, 403 khi thieu quyen, cho qua khi du quyen", async () => {
  const ok = async (req, res) => res.status(200).json({ ok: true });
  const call = (level, userId, id = task._id) =>
    run([requireTaskAccess(level), ok], { userId, params: { id } });

  assert.equal((await call("view", owner._id, "f".repeat(24))).statusCode, 404);
  assert.equal((await call("view", stranger._id)).statusCode, 403);
  assert.equal((await call("edit", viewer._id)).statusCode, 403);
  assert.equal((await call("owner", editor._id)).statusCode, 403);
  assert.equal((await call("view", viewer._id)).statusCode, 200);
  assert.equal((await call("edit", editor._id)).statusCode, 200);
  assert.equal((await call("owner", owner._id)).statusCode, 200);
});

test("middleware: id khong hop le bi tu choi 400", async () => {
  const res = await run([validateObjectIdParams("id"), async (q, r) => r.json({})], { params: { id: "abc" } });
  assert.equal(res.statusCode, 400);
});
