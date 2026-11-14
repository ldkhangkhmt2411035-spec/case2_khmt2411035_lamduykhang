const test = require("node:test");
const assert = require("node:assert/strict");
const { src } = require("./helpers/env");

const { sortTasks, escapeRegex, formatTask } = src("services", "taskService.js");
const { renderEmail, escapeHtml } = src("utils", "emailTemplates.js");

const mk = (title, priority, dueDate) => ({ title, priority, dueDate });

test("sap xep uu tien theo thu tu thap < trung binh < cao (khong theo chu cai)", () => {
  const list = [mk("a", "low"), mk("b", "high"), mk("c", "medium")];
  assert.deepEqual(sortTasks([...list], "priority", "desc").map((t) => t.priority), ["high", "medium", "low"]);
  assert.deepEqual(sortTasks([...list], "priority", "asc").map((t) => t.priority), ["low", "medium", "high"]);
});

test("sap xep theo han: cong viec khong co han luon nam cuoi", () => {
  const d1 = new Date("2026-12-01");
  const d2 = new Date("2026-12-05");
  const list = [mk("khong han"), mk("muon", "low", d2), mk("som", "low", d1)];
  assert.deepEqual(sortTasks([...list], "dueDate", "asc").map((t) => t.title), ["som", "muon", "khong han"]);
  assert.deepEqual(sortTasks([...list], "dueDate", "desc").map((t) => t.title), ["muon", "som", "khong han"]);
});

test("escapeRegex vo hieu hoa ky tu dac biet", () => {
  assert.equal(new RegExp(escapeRegex("a.b(c)*")).test("xa.b(c)*"), true);
  assert.equal(new RegExp(escapeRegex("a.b")).test("axb"), false);
});

test("formatTask them myRole, assigneeIds, primaryAssigneeId, shareId/permission", () => {
  const task = {
    createdBy: "1".repeat(24),
    assignees: [{ user: "2".repeat(24), isPrimary: true }],
    sharedWith: [{ _id: "9".repeat(24), user: "3".repeat(24), role: "viewer" }],
    toObject() {
      return { assignees: this.assignees, sharedWith: this.sharedWith };
    },
  };
  const out = formatTask(task, "2".repeat(24));
  assert.equal(out.myRole, "editor");
  assert.deepEqual(out.assigneeIds, ["2".repeat(24)]);
  assert.equal(out.primaryAssigneeId, "2".repeat(24));
  assert.equal(out.sharedWith[0].shareId, "9".repeat(24));
  assert.equal(out.sharedWith[0].permission, "viewer");
});

test("noi dung email: escape HTML trong tieu de, thong diep va ten cong viec", () => {
  assert.equal(escapeHtml(`<b>"x"</b> & 'y'`), "&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;");
  const html = renderEmail({ title: "T", message: "<script>alert(1)</script>", taskTitle: "<img src=x>", dueDate: null });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x>"));
  assert.ok(html.includes("&lt;script&gt;"));
});
