const test = require("node:test");
const assert = require("node:assert/strict");
const { src } = require("./helpers/env");

const auth = src("validators", "authValidator.js");
const task = src("validators", "taskValidator.js");

test("dang ky: kiem tra ho ten, email, mat khau", () => {
  assert.equal(auth.validateRegister({ fullName: "A", email: "a@b.com", password: "123456" }), null);
  assert.match(auth.validateRegister({ fullName: " ", email: "a@b.com", password: "123456" }), /họ tên/);
  assert.match(auth.validateRegister({ fullName: "A", email: "a@b", password: "123456" }), /Email không hợp lệ/);
  assert.match(auth.validateRegister({ fullName: "A", email: "a@b.com", password: "123" }), /ít nhất 6/);
});

test("dang nhap: chan du lieu khong phai chuoi (NoSQL injection)", () => {
  assert.ok(auth.validateLogin({ email: { $gt: "" }, password: "x" }));
  assert.equal(auth.validateLogin({ email: "a@b.com", password: "x" }), null);
});

test("doi mat khau: mat khau moi phai khac cu va du dai", () => {
  assert.ok(auth.validateChangePassword({ oldPassword: "123456", newPassword: "123456" }));
  assert.ok(auth.validateChangePassword({ oldPassword: "123456", newPassword: "12" }));
  assert.equal(auth.validateChangePassword({ oldPassword: "123456", newPassword: "abcdef" }), null);
});

test("cong viec: trang thai, uu tien, ngay thang", () => {
  assert.equal(task.validateTaskFields({ status: "completed", priority: "high" }), null);
  assert.ok(task.validateTaskFields({ status: "done" }));
  assert.ok(task.validateTaskFields({ priority: "urgent" }));
  assert.ok(task.validateTaskFields({ dueDate: "khong-phai-ngay" }));
  assert.match(
    task.validateTaskFields({ startDate: "2026-12-10", dueDate: "2026-12-01" }),
    /sau hoặc bằng ngày bắt đầu/
  );
  assert.ok(task.validateCreateTask({ title: "   " }));
  assert.equal(task.validateCreateTask({ title: "Viec" }), null);
});

test("giao viec: nhan userIds hoac emails, chuan hoa email, gioi han so luong", () => {
  const ok = task.parseAssignBody({ emails: [" A@X.com "], userIds: ["a".repeat(24)], primaryEmail: "A@x.com" });
  assert.deepEqual(ok.emails, ["a@x.com"]);
  assert.equal(ok.primaryEmail, "a@x.com");
  assert.ok(task.parseAssignBody({}).error);
  assert.ok(task.parseAssignBody({ emails: "a@x.com" }).error);
  assert.ok(task.parseAssignBody({ emails: [123] }).error);
  assert.ok(task.parseAssignBody({ emails: Array.from({ length: 51 }, (_, i) => `u${i}@x.com`) }).error);
});

test("chia se: 3 dang body deu duoc chap nhan", () => {
  const id = "b".repeat(24);
  const a = task.parseShareBody({ shares: [{ email: "A@x.com", permission: "editor" }, { userId: id, permission: "viewer" }] });
  assert.equal(a.entries.length, 2);
  assert.equal(a.entries[0].email, "a@x.com");

  const b = task.parseShareBody({ emails: ["a@x.com", "b@x.com"], permission: "editor" });
  assert.deepEqual(b.entries.map((e) => e.permission), ["editor", "editor"]);

  const legacy = task.parseShareBody({ email: "a@x.com", role: "viewer" });
  assert.equal(legacy.entries[0].permission, "viewer");

  assert.equal(task.parseShareBody({ emails: ["a@x.com"] }).entries[0].permission, "viewer"); // mac dinh
});

test("chia se: tu choi du lieu sai", () => {
  assert.ok(task.parseShareBody({}).error);
  assert.ok(task.parseShareBody({ emails: ["a@x.com"], permission: "owner" }).error);
  assert.ok(task.parseShareBody({ shares: [{ email: "a@x.com", userId: "b".repeat(24), permission: "viewer" }] }).error);
  assert.ok(task.parseShareBody({ shares: [{ userId: "khong-hop-le", permission: "viewer" }] }).error);
  assert.ok(task.parsePermissionBody({ permission: "admin" }).error);
  assert.equal(task.parsePermissionBody({ role: "editor" }).permission, "editor");
});
