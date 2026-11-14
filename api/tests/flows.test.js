// Kiem thu luong nghiep vu qua dung chuoi "middleware + controller" nhu trong routes/.
// Model duoc thay bang ban gia luu trong bo nho (xem helpers/env.js), nen khong can MongoDB.
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SMTP_HOST = "smtp.test";
process.env.SMTP_USER = "gui@test.com";
process.env.SMTP_PASS = "mat-khau";

const { src, createDb, run, nodemailerState } = require("./helpers/env");

const db = createDb();
const { requireTaskAccess } = src("middleware", "permissionMiddleware.js");
const { validate, validateObjectIdParams } = src("middleware", "validateMiddleware.js");
const taskCtrl = src("controllers", "taskController.js");
const assignCtrl = src("controllers", "assignmentController.js");
const shareCtrl = src("controllers", "taskShareController.js");
const userCtrl = src("controllers", "userController.js");
const emailCtrl = src("controllers", "emailLogController.js");
const { validateStatusBody } = src("validators", "taskValidator.js");
const { sendEmail } = src("services", "emailService.js");
const HttpError = src("utils", "httpError.js");

const owner = db.addUser("Chu So Huu", "chu@x.com");
const bob = db.addUser("Bob", "bob@x.com");
const cat = db.addUser("Cat", "cat@x.com");
const dan = db.addUser("Dan", "dan@x.com");

// Cac chuoi tuong ung voi routes/assignmentRoutes.js, taskShareRoutes.js, taskRoutes.js
const id = validateObjectIdParams("id");
const routes = {
  addAssignees: [id, requireTaskAccess("edit"), assignCtrl.addAssignees],
  getAssignees: [id, requireTaskAccess("view"), assignCtrl.getAssignees],
  setPrimary: [validateObjectIdParams("id", "userId"), requireTaskAccess("edit"), assignCtrl.setPrimaryAssignee],
  removeAssignee: [validateObjectIdParams("id", "userId"), requireTaskAccess("edit"), assignCtrl.removeAssignee],
  addShares: [id, requireTaskAccess("owner"), shareCtrl.addShares],
  getShares: [id, requireTaskAccess("view"), shareCtrl.getShares],
  updateShare: [validateObjectIdParams("id", "shareId"), requireTaskAccess("owner"), shareCtrl.updateShare],
  revokeShare: [validateObjectIdParams("id", "shareId"), requireTaskAccess("owner"), shareCtrl.revokeShare],
  getTask: [id, requireTaskAccess("view"), taskCtrl.getTaskById],
  updateTask: [id, requireTaskAccess("edit"), taskCtrl.updateTask],
  deleteTask: [id, requireTaskAccess("owner"), taskCtrl.deleteTask],
  updateStatus: [id, validate((req) => validateStatusBody(req.body)), requireTaskAccess("edit"), taskCtrl.updateStatus],
};

const call = (name, user, taskId, body = {}, params = {}) =>
  run(routes[name], { userId: user._id, params: { id: taskId, ...params }, body });

const notificationsFor = (user, type) =>
  db.notifications.filter((n) => String(n.userId) === String(user._id) && (!type || n.type === type));

test("giao viec cho nhieu nguoi, chon nguoi phu trach chinh, thong bao dung nguoi", async () => {
  const task = db.addTask(owner._id);
  const res = await call("addAssignees", owner, task._id, { emails: ["bob@x.com", "cat@x.com"], primaryEmail: "bob@x.com" });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.task.assigneeIds.length, 2);
  assert.equal(res.body.task.primaryAssigneeId, String(bob._id));
  assert.equal(notificationsFor(bob, "task_assigned").length, 1);
  assert.equal(notificationsFor(cat, "task_assigned").length, 1);
  assert.equal(notificationsFor(owner).length, 0); // nguoi thuc hien khong tu nhan thong bao
  assert.ok(db.activities.some((a) => a.action === "assigned" && a.taskId === task._id));
  assert.equal(typeof db.activities.at(-1).details, "object"); // lich su luu dang object
  assert.ok(db.activities.at(-1).details.message);

  // giao lai cung nhung nguoi do: khong gui them thong bao
  const before = db.notifications.length;
  await call("addAssignees", owner, task._id, { emails: ["bob@x.com"] });
  assert.equal(db.notifications.length, before);
});

test("giao viec: ho tro userIds, bao loi khi khong tim thay ai, chan nguoi khong du quyen", async () => {
  const task = db.addTask(owner._id);
  const byId = await call("addAssignees", owner, task._id, { userIds: [dan._id] });
  assert.equal(byId.statusCode, 200);

  const missing = await call("addAssignees", owner, task._id, { emails: ["khong-co@x.com"] });
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.body.notFoundEmails, ["khong-co@x.com"]);

  assert.equal((await call("addAssignees", owner, task._id, {})).statusCode, 400);
  assert.equal((await call("addAssignees", cat, task._id, { emails: ["bob@x.com"] })).statusCode, 403);
});

test("doi nguoi phu trach chinh (PATCH) va go nguoi duoc giao (DELETE)", async () => {
  const task = db.addTask(owner._id);
  await call("addAssignees", owner, task._id, { emails: ["bob@x.com", "cat@x.com"], primaryEmail: "bob@x.com" });

  const swap = await call("setPrimary", owner, task._id, { isPrimary: true }, { userId: cat._id });
  assert.equal(swap.body.task.primaryAssigneeId, String(cat._id));
  assert.equal(task.assignees.filter((a) => a.isPrimary).length, 1);

  assert.equal((await call("setPrimary", owner, task._id, { isPrimary: "yes" }, { userId: cat._id })).statusCode, 400);
  assert.equal((await call("setPrimary", owner, task._id, {}, { userId: dan._id })).statusCode, 404);

  assert.equal((await call("removeAssignee", owner, task._id, {}, { userId: bob._id })).statusCode, 200);
  assert.equal((await call("removeAssignee", owner, task._id, {}, { userId: bob._id })).statusCode, 404);
});

test("chia se cho nhieu nguoi mot luc; bo qua chinh minh; bao nguoi khong tim thay", async () => {
  const task = db.addTask(owner._id);
  const res = await call("addShares", owner, task._id, {
    shares: [
      { email: "bob@x.com", permission: "editor" },
      { userId: cat._id, permission: "viewer" },
      { email: "chu@x.com", permission: "viewer" },
      { email: "khong-co@x.com", permission: "viewer" },
    ],
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.results.created.sort(), ["bob@x.com", "cat@x.com"]);
  assert.deepEqual(res.body.results.skipped, ["chu@x.com"]);
  assert.deepEqual(res.body.results.notFound, ["khong-co@x.com"]);
  assert.equal(res.body.shares.length, 2);
  assert.ok(res.body.shares.every((s) => s.shareId && s.taskId && s.userId && s.permission && s.createdAt));
  assert.equal(notificationsFor(bob, "task_shared").length, 1);
  assert.equal(notificationsFor(cat, "task_shared").length, 1);
});

test("doi quyen va thu hoi quyen theo shareId (va theo userId o duong dan cu)", async () => {
  const task = db.addTask(owner._id);
  const created = await call("addShares", owner, task._id, { emails: ["bob@x.com", "cat@x.com"], permission: "viewer" });
  const bobShare = created.body.shares.find((s) => s.userId === String(bob._id));
  const catShare = created.body.shares.find((s) => s.userId === String(cat._id));

  const patched = await call("updateShare", owner, task._id, { permission: "editor" }, { shareId: bobShare.shareId });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.body.shares.find((s) => s.userId === String(bob._id)).permission, "editor");
  assert.equal(notificationsFor(bob, "task_share_updated").length, 1);

  // duong dan cu: tham so la id nguoi dung
  const legacy = await call("updateShare", owner, task._id, { role: "editor" }, { shareId: cat._id });
  assert.equal(legacy.statusCode, 200);

  assert.equal((await call("updateShare", owner, task._id, { permission: "root" }, { shareId: bobShare.shareId })).statusCode, 400);
  assert.equal((await call("updateShare", owner, task._id, { permission: "viewer" }, { shareId: "e".repeat(24) })).statusCode, 404);

  const revoked = await call("revokeShare", owner, task._id, {}, { shareId: catShare.shareId });
  assert.equal(revoked.statusCode, 200);
  assert.equal(revoked.body.shares.length, 1);
  assert.equal(notificationsFor(cat, "task_share_revoked").length, 1);
  assert.equal((await call("revokeShare", owner, task._id, {}, { shareId: catShare.shareId })).statusCode, 404);
});

test("phan quyen chia se: editor va viewer khong duoc chia se, nhung xem duoc danh sach", async () => {
  const task = db.addTask(owner._id);
  await call("addShares", owner, task._id, { shares: [{ email: "bob@x.com", permission: "editor" }, { email: "cat@x.com", permission: "viewer" }] });

  assert.equal((await call("addShares", bob, task._id, { emails: ["dan@x.com"] })).statusCode, 403);
  assert.equal((await call("addShares", cat, task._id, { emails: ["dan@x.com"] })).statusCode, 403);
  assert.equal((await call("getShares", cat, task._id)).statusCode, 200);
  assert.equal((await call("getShares", dan, task._id)).statusCode, 403);
});

test("viewer khong sua/doi trang thai/xoa duoc; editor sua duoc nhung khong xoa duoc", async () => {
  const task = db.addTask(owner._id);
  await call("addShares", owner, task._id, { shares: [{ email: "bob@x.com", permission: "editor" }, { email: "cat@x.com", permission: "viewer" }] });

  assert.equal((await call("updateTask", cat, task._id, { title: "Doi ten" })).statusCode, 403);
  assert.equal((await call("updateStatus", cat, task._id, { status: "completed" })).statusCode, 403);
  assert.equal((await call("deleteTask", bob, task._id)).statusCode, 403);
  assert.equal((await call("updateTask", bob, task._id, { title: "Doi ten" })).statusCode, 200);
  assert.equal(task.title, "Doi ten");
});

test("hoan thanh va doi han: thong bao cho nguoi lien quan, tru nguoi thuc hien", async () => {
  const task = db.addTask(owner._id);
  await call("addShares", owner, task._id, { emails: ["bob@x.com"], permission: "editor" });

  const bad = await call("updateStatus", bob, task._id, { status: "done" });
  assert.equal(bad.statusCode, 400);

  const done = await call("updateStatus", bob, task._id, { status: "completed" });
  assert.equal(done.statusCode, 200);
  assert.equal(notificationsFor(owner, "task_completed").length, 1);
  assert.equal(notificationsFor(bob, "task_completed").length, 0);

  const due = await call("updateTask", owner, task._id, { dueDate: "2026-12-31T00:00:00Z" });
  assert.equal(due.statusCode, 200);
  assert.equal(notificationsFor(bob, "due_date_changed").length, 1);
  assert.ok(db.activities.some((a) => a.action === "due_date_changed"));

  const invalid = await call("updateTask", owner, task._id, { startDate: "2027-01-10", dueDate: "2027-01-01" });
  assert.equal(invalid.statusCode, 400);
});

test("chi tiet cong viec tra ve myRole, assigneeIds, primaryAssigneeId, shareId", async () => {
  const task = db.addTask(owner._id);
  await call("addAssignees", owner, task._id, { emails: ["cat@x.com"], primaryEmail: "cat@x.com" });
  await call("addShares", owner, task._id, { emails: ["bob@x.com"], permission: "viewer" });

  const asCat = await call("getTask", cat, task._id);
  assert.equal(asCat.body.task.myRole, "editor");
  assert.equal(asCat.body.task.primaryAssigneeId, String(cat._id));
  const asBob = await call("getTask", bob, task._id);
  assert.equal(asBob.body.task.myRole, "viewer");
  assert.ok(asBob.body.task.sharedWith[0].shareId);
  assert.equal((await call("getTask", dan, task._id)).statusCode, 403);
});

test("xoa cong viec (chi nguoi tao) don dep thong bao va lich su", async () => {
  const task = db.addTask(owner._id);
  await call("addAssignees", owner, task._id, { emails: ["bob@x.com"] });
  assert.ok(db.notifications.some((n) => n.taskId === task._id));

  assert.equal((await call("deleteTask", owner, task._id)).statusCode, 200);
  assert.ok(!db.notifications.some((n) => n.taskId === task._id));
  assert.ok(!db.activities.some((a) => a.taskId === task._id));
  assert.equal((await call("getTask", owner, task._id)).statusCode, 404);
});

test("email: ghi log, that bai thi cho gui lai; chi nguoi tao duoc gui lai; khong gui trung", async () => {
  const task = db.addTask(owner._id);
  nodemailerState.calls.length = 0;
  nodemailerState.failTimes = 3; // 3 lan thu dau deu that bai

  const failed = await sendEmail({
    taskId: task._id, recipientId: bob._id, to: "bob@x.com",
    eventType: "task_assigned", subject: "Tieu de", html: "<p>Noi dung</p>",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.attempts, 3);

  const retry = (user, logId) => run([validateObjectIdParams("id"), emailCtrl.retryEmailLog], { userId: user._id, params: { id: logId } });

  assert.equal((await retry(bob, failed._id)).statusCode, 403); // khong phai nguoi tao
  const ok = await retry(owner, failed._id);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.log.status, "sent");
  assert.equal(ok.body.log.attempts, 4);
  assert.equal(ok.body.log.body, undefined); // khong tra ve noi dung email
  assert.equal(nodemailerState.calls.at(-1).html, "<p>Noi dung</p>");

  const again = await retry(owner, failed._id);
  assert.equal(again.statusCode, 409); // da gui thanh cong -> khong gui lai
  assert.equal((await retry(owner, "d".repeat(24))).statusCode, 403);
});

test("email: gioi han tong so lan gui lai", async () => {
  const task = db.addTask(owner._id);
  nodemailerState.failTimes = 100;
  const log = await sendEmail({ taskId: task._id, to: "bob@x.com", eventType: "x", subject: "s", html: "<p>h</p>" });
  const retry = () => run([emailCtrl.retryEmailLog], { userId: owner._id, params: { id: log._id } });

  for (let i = 0; i < 3; i++) assert.equal((await retry()).statusCode, 200); // 3 + 3 = 6 lan
  assert.equal(log.attempts, 6);
  assert.equal((await retry()).statusCode, 409);
  nodemailerState.failTimes = 0;
});

test("tim nguoi dung theo ten/email: toi thieu 2 ky tu, escape ky tu dac biet", async () => {
  const search = (q) => run([userCtrl.searchUsers], { userId: owner._id, query: { q } });

  assert.equal((await search("b")).statusCode, 400);
  assert.equal((await search(undefined)).statusCode, 400);

  const byName = await search("bo");
  assert.deepEqual(byName.body.users.map((u) => u.email), ["bob@x.com"]);
  const byEmail = await search("cat@");
  assert.deepEqual(byEmail.body.users.map((u) => u.email), ["cat@x.com"]);
  assert.equal((await search("b.b")).body.users.length, 0); // dau "." khong phai ky tu thay the bat ky

  const one = await run([validateObjectIdParams("id"), userCtrl.getUserById], { userId: owner._id, params: { id: bob._id } });
  assert.equal(one.body.user.email, "bob@x.com");
  assert.equal(one.body.user.password, undefined);
  assert.equal((await run([validateObjectIdParams("id"), userCtrl.getUserById], { userId: owner._id, params: { id: "c".repeat(24) } })).statusCode, 404);
});

test("xu ly loi tap trung: ma dung, khong lo chi tiet noi bo", async () => {
  const boom = (error) => run([async () => { throw error; }], { userId: owner._id });

  const cast = await boom(Object.assign(new Error("noi bo"), { name: "CastError" }));
  assert.equal(cast.statusCode, 400);
  assert.equal((await boom(new HttpError(418, "Thong bao rieng"))).body.message, "Thong bao rieng");

  const original = console.error;
  console.error = () => {};
  const generic = await boom(new Error("mongodb://user:matkhau@host/db that bai"));
  console.error = original;
  assert.equal(generic.statusCode, 500);
  assert.equal(generic.body.message, "Lỗi server");
  assert.ok(!JSON.stringify(generic.body).includes("matkhau"));
});
