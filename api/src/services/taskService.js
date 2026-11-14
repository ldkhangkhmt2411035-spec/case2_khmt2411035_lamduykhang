const mongoose = require("mongoose");
const User = require("../models/User");
const { getRoleOf, idOf } = require("../utils/taskAccess");

const USER_FIELDS = "fullName email avatarUrl";
const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function populateTask(query) {
  return query
    .populate("createdBy", USER_FIELDS)
    .populate("assignees.user", USER_FIELDS)
    .populate("sharedWith.user", USER_FIELDS)
    .populate("sharedWith.sharedBy", USER_FIELDS);
}

// Dinh dang task tra ve cho client: kem vai tro cua nguoi dang dang nhap (myRole), danh sach id
// nguoi duoc giao (assigneeIds, primaryAssigneeId) va shareId/permission cua tung nguoi duoc chia se.
function formatTask(task, userId) {
  const obj = task.toObject({ virtuals: false });
  obj.myRole = getRoleOf(task, userId);

  const assignees = obj.assignees || [];
  obj.assigneeIds = assignees.map((a) => idOf(a.user));
  const primary = assignees.find((a) => a.isPrimary);
  obj.primaryAssigneeId = primary ? idOf(primary.user) : null;

  obj.sharedWith = (obj.sharedWith || []).map((s) => ({
    ...s,
    shareId: idOf(s._id),
    permission: s.role,
  }));
  return obj;
}

// Sap xep o phia server. priority: thap < trung binh < cao;
// dueDate: cong viec chua dat han luon nam cuoi.
function sortTasks(tasks, sortBy, order) {
  const dir = order === "asc" ? 1 : -1;
  if (sortBy === "priority") {
    return tasks.sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * dir);
  }
  if (sortBy === "dueDate") {
    return tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return (a.dueDate - b.dueDate) * dir;
    });
  }
  return tasks;
}

// Tim nguoi dung theo danh sach email va/hoac id. Tra ve { users (khong trung), notFound }.
async function findUsers({ emails = [], userIds = [] }) {
  const validIds = userIds.filter((id) => mongoose.isValidObjectId(id));
  const conditions = [];
  if (emails.length > 0) conditions.push({ email: { $in: emails } });
  if (validIds.length > 0) conditions.push({ _id: { $in: validIds } });

  const found = conditions.length > 0 ? await User.find({ $or: conditions }).select("fullName email avatarUrl") : [];
  const byId = new Map(found.map((u) => [String(u._id), u]));

  const notFound = [
    ...emails.filter((e) => !found.some((u) => u.email === e)),
    ...userIds.filter((i) => !byId.has(String(i))),
  ];
  return { users: [...byId.values()], notFound };
}

module.exports = {
  USER_FIELDS,
  escapeRegex,
  populateTask,
  formatTask,
  sortTasks,
  findUsers,
};
