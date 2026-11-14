const Task = require("../models/Task");
const notify = require("../services/notificationService");
const { logActivity, ROLE_LABEL } = require("../services/activityService");
const { populateTask, formatTask, findUsers } = require("../services/taskService");
const { parseShareBody, parsePermissionBody } = require("../validators/taskValidator");
const { idOf } = require("../utils/taskAccess");

// Danh sach chia se dang gon theo dung cau truc "task_shares" trong de:
// { shareId, taskId, userId, user, permission, sharedBy, createdAt }
function shareList(populatedTask) {
  return (populatedTask.sharedWith || []).map((s) => ({
    shareId: idOf(s._id),
    taskId: idOf(populatedTask._id),
    userId: idOf(s.user),
    user: s.user,
    permission: s.role,
    sharedBy: s.sharedBy || null,
    createdAt: s.createdAt,
  }));
}

// Tim 1 muc chia se theo shareId, hoac (dang cu) theo id nguoi dung
function findShare(task, idParam) {
  return task.sharedWith.find((s) => idOf(s._id) === idParam) || task.sharedWith.find((s) => idOf(s.user) === idParam);
}

async function respond(req, res, message, extra = {}) {
  const populated = await populateTask(Task.findById(req.task._id));
  res.status(200).json({
    message,
    task: formatTask(populated, req.userId),
    shares: shareList(populated),
    ...extra,
  });
}

// GET /api/tasks/:id/shares   (quyen xem)
exports.getShares = async (req, res) => {
  const populated = await populateTask(Task.findById(req.task._id));
  res.status(200).json({ shares: shareList(populated) });
};

// POST /api/tasks/:id/shares   (chi nguoi tao) - chia se cho 1 hoac nhieu nguoi
// body: { shares: [{ userId|email, permission }] }  hoac  { emails, userIds, permission }  hoac dang cu { email, role }
exports.addShares = async (req, res) => {
  const parsed = parseShareBody(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const { users, notFound } = await findUsers({
    emails: parsed.entries.filter((e) => e.email).map((e) => e.email),
    userIds: parsed.entries.filter((e) => e.userId).map((e) => e.userId),
  });
  if (users.length === 0) {
    return res.status(404).json({ message: "Không tìm thấy người dùng nào để chia sẻ", notFound });
  }

  const task = req.task;
  const created = [];
  const updated = [];
  const skipped = [];

  for (const entry of parsed.entries) {
    const user = users.find((u) => (entry.email ? u.email === entry.email : String(u._id) === entry.userId));
    if (!user) continue; // da nam trong notFound

    const label = user.email;
    if (String(user._id) === String(req.userId)) {
      skipped.push(label); // khong the tu chia se cho chinh minh
      continue;
    }

    const existing = task.sharedWith.find((s) => idOf(s.user) === String(user._id));
    if (existing) {
      if (existing.role !== entry.permission) {
        existing.role = entry.permission;
        updated.push({ user, permission: entry.permission });
      }
    } else {
      task.sharedWith.push({ user: user._id, role: entry.permission, sharedBy: req.userId, createdAt: new Date() });
      created.push({ user, permission: entry.permission });
    }
  }

  if (created.length === 0 && updated.length === 0) {
    return res.status(400).json({
      message: "Không có thay đổi nào: những người này đã được chia sẻ với quyền tương ứng, hoặc là chính bạn",
      notFound,
      skipped,
    });
  }

  await task.save();

  const actor = await notify.getActor(req.userId);
  for (const { user, permission } of created) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "shared",
      details: `Chia sẻ cho ${user.fullName || user.email} (quyền ${ROLE_LABEL[permission]})`,
      meta: { userId: String(user._id), permission },
    });
    await notify.notifyShared(task, actor, user, permission);
  }
  for (const { user, permission } of updated) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "share_updated",
      details: `Đổi quyền của ${user.fullName || user.email} thành ${ROLE_LABEL[permission]}`,
      meta: { userId: String(user._id), permission },
    });
    await notify.notifyShareUpdated(task, actor, user, permission);
  }

  await respond(req, res, "Chia sẻ thành công", {
    results: {
      created: created.map((c) => c.user.email),
      updated: updated.map((u) => u.user.email),
      skipped,
      notFound,
    },
  });
};

// PATCH (hoac PUT dang cu) /api/tasks/:id/shares/:shareId   body: { permission }   (chi nguoi tao)
exports.updateShare = async (req, res) => {
  const parsed = parsePermissionBody(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const task = req.task;
  const entry = findShare(task, req.params.shareId);
  if (!entry) return res.status(404).json({ message: "Không tìm thấy mục chia sẻ" });

  if (entry.role !== parsed.permission) {
    entry.role = parsed.permission;
    await task.save();

    const [actor, target] = await Promise.all([notify.getActor(req.userId), notify.findUserSafe(idOf(entry.user))]);
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "share_updated",
      details: `Đổi quyền của ${target ? target.fullName || target.email : "một người"} thành ${ROLE_LABEL[parsed.permission]}`,
      meta: { userId: idOf(entry.user), permission: parsed.permission },
    });
    if (target) await notify.notifyShareUpdated(task, actor, target, parsed.permission);
  }

  await respond(req, res, "Cập nhật quyền thành công");
};

// DELETE /api/tasks/:id/shares/:shareId   (chi nguoi tao) - thu hoi quyen chia se
exports.revokeShare = async (req, res) => {
  const task = req.task;
  const entry = findShare(task, req.params.shareId);
  if (!entry) return res.status(404).json({ message: "Không tìm thấy mục chia sẻ" });

  const targetId = idOf(entry.user);
  const entryId = idOf(entry._id);
  task.sharedWith = task.sharedWith.filter((s) => idOf(s._id) !== entryId);
  await task.save();

  const [actor, target] = await Promise.all([notify.getActor(req.userId), notify.findUserSafe(targetId)]);
  await logActivity({
    taskId: task._id,
    userId: req.userId,
    action: "share_revoked",
    details: `Thu hồi quyền chia sẻ của ${target ? target.fullName || target.email : "một người"}`,
    meta: { userId: targetId },
  });
  if (target) await notify.notifyShareRevoked(task, actor, target);

  await respond(req, res, "Đã thu hồi quyền chia sẻ");
};
