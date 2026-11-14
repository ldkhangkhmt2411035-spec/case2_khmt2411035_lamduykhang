const Task = require("../models/Task");
const notify = require("../services/notificationService");
const { logActivity } = require("../services/activityService");
const { populateTask, formatTask, findUsers } = require("../services/taskService");
const { parseAssignBody } = require("../validators/taskValidator");
const { idOf } = require("../utils/taskAccess");

// Danh sach nguoi duoc giao (da populate) dang gon, kem id de client dung truc tiep
function assigneeList(populatedTask) {
  return (populatedTask.assignees || []).map((a) => ({
    userId: idOf(a.user),
    user: a.user,
    isPrimary: !!a.isPrimary,
  }));
}

async function respondWithTask(req, res, message) {
  const populated = await populateTask(Task.findById(req.task._id));
  const task = formatTask(populated, req.userId);
  return { populated, task, body: { message, task, assignees: assigneeList(populated) } };
}

// GET /api/tasks/:id/assignees   (quyen xem)
exports.getAssignees = async (req, res) => {
  const populated = await populateTask(Task.findById(req.task._id));
  const task = formatTask(populated, req.userId);
  res.status(200).json({
    assignees: assigneeList(populated),
    assigneeIds: task.assigneeIds,
    primaryAssigneeId: task.primaryAssigneeId,
  });
};

// POST /api/tasks/:id/assignees   (quyen sua)
// body: { userIds?: [], emails?: [], primaryUserId?, primaryEmail? }   (dang cu /assign: { emails, primaryEmail })
exports.addAssignees = async (req, res) => {
  const parsed = parseAssignBody(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const { users, notFound } = await findUsers({ emails: parsed.emails, userIds: parsed.userIds });
  if (users.length === 0) {
    return res.status(404).json({
      message: "Không tìm thấy người dùng nào với thông tin đã nhập",
      notFound,
      notFoundEmails: notFound,
    });
  }

  const task = req.task;
  const newUsers = []; // chi nhung nguoi MOI duoc them moi nhan thong bao / email
  for (const user of users) {
    const exists = task.assignees.find((a) => idOf(a.user) === String(user._id));
    if (!exists) {
      task.assignees.push({ user: user._id, isPrimary: false });
      newUsers.push(user);
    }
  }

  // Chon nguoi phu trach chinh (neu co) trong so nhung nguoi vua gui len
  const primaryUser = users.find(
    (u) =>
      (parsed.primaryUserId && String(u._id) === parsed.primaryUserId) ||
      (parsed.primaryEmail && u.email === parsed.primaryEmail)
  );
  if (primaryUser) {
    task.assignees.forEach((a) => {
      a.isPrimary = idOf(a.user) === String(primaryUser._id);
    });
  }

  await task.save();

  if (newUsers.length > 0) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "assigned",
      details: `Giao việc cho ${newUsers.map((u) => u.fullName || u.email).join(", ")}`,
      meta: { userIds: newUsers.map((u) => String(u._id)) },
    });
    const actor = await notify.getActor(req.userId);
    await notify.notifyAssigned(task, actor, newUsers);
  }

  const result = await respondWithTask(req, res, "Giao việc thành công");
  res.status(200).json({ ...result.body, notFound, notFoundEmails: notFound });
};

// PATCH /api/tasks/:id/assignees/:userId   body: { isPrimary?: boolean }  (mac dinh true)   (quyen sua)
exports.setPrimaryAssignee = async (req, res) => {
  const { isPrimary = true } = req.body;
  if (typeof isPrimary !== "boolean") {
    return res.status(400).json({ message: "isPrimary phải là true hoặc false" });
  }

  const task = req.task;
  const entry = task.assignees.find((a) => idOf(a.user) === req.params.userId);
  if (!entry) return res.status(404).json({ message: "Người này chưa được giao công việc" });

  task.assignees.forEach((a) => {
    if (a === entry) a.isPrimary = isPrimary;
    else if (isPrimary) a.isPrimary = false; // chi 1 nguoi la phu trach chinh
  });
  await task.save();

  const target = await notify.findUserSafe(req.params.userId);
  const who = target ? target.fullName || target.email : "một người";
  await logActivity({
    taskId: task._id,
    userId: req.userId,
    action: "updated",
    details: isPrimary ? `Đặt ${who} làm người phụ trách chính` : `Bỏ vai trò phụ trách chính của ${who}`,
    meta: { userId: req.params.userId, isPrimary },
  });

  const result = await respondWithTask(req, res, "Cập nhật người phụ trách chính thành công");
  res.status(200).json(result.body);
};

// DELETE /api/tasks/:id/assignees/:userId   (quyen sua)
exports.removeAssignee = async (req, res) => {
  const task = req.task;
  const had = task.assignees.some((a) => idOf(a.user) === req.params.userId);
  if (!had) return res.status(404).json({ message: "Người này chưa được giao công việc" });

  task.assignees = task.assignees.filter((a) => idOf(a.user) !== req.params.userId);
  await task.save();

  const removed = await notify.findUserSafe(req.params.userId);
  await logActivity({
    taskId: task._id,
    userId: req.userId,
    action: "unassigned",
    details: `Gỡ ${removed ? removed.fullName || removed.email : "một người"} khỏi danh sách phụ trách`,
    meta: { userId: req.params.userId },
  });

  const result = await respondWithTask(req, res, "Đã gỡ người phụ trách");
  res.status(200).json(result.body);
};
