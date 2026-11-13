const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendEmail, renderEmail, formatDateTime } = require("./emailService");

const ROLE_LABEL = { viewer: "chỉ xem", editor: "chỉnh sửa" };

// Lay thong tin nguoi thuc hien hanh dong (de ghi "A da giao viec cho ban")
async function getActor(userId) {
  try {
    return await User.findById(userId).select("fullName email");
  } catch (_) {
    return null;
  }
}

async function findUserSafe(userId) {
  try {
    return await User.findById(userId).select("fullName email");
  } catch (_) {
    return null;
  }
}

// Moi nguoi lien quan den cong viec (chu so huu, nguoi duoc giao, nguoi duoc chia se), tru 1 nguoi
async function getRelatedUsers(task, excludeUserId) {
  const ids = new Set([
    String(task.createdBy),
    ...task.assignees.map((a) => String(a.user)),
    ...task.sharedWith.map((s) => String(s.user)),
  ]);
  if (excludeUserId) ids.delete(String(excludeUserId));
  if (ids.size === 0) return [];
  return User.find({ _id: { $in: [...ids] } }).select("fullName email");
}

// Tao thong bao trong app + gui email cho tung nguoi nhan.
// Ham nay khong bao gio nem loi: thong bao that bai khong duoc anh huong thao tac chinh.
async function notifyUsers({ recipients, task, type, title, message, actorId = null, sendMail = true }) {
  try {
    const unique = new Map();
    for (const u of recipients || []) {
      if (!u || !u._id) continue;
      if (actorId && String(u._id) === String(actorId)) continue; // khong thong bao cho chinh minh
      unique.set(String(u._id), u);
    }
    const users = [...unique.values()];
    if (users.length === 0) return;

    await Notification.insertMany(
      users.map((u) => ({ userId: u._id, taskId: task._id, type, title, message }))
    );

    if (sendMail) {
      const html = renderEmail({ title, message, taskTitle: task.title, dueDate: task.dueDate });
      for (const u of users) {
        // Khong await: gui email chay ngam, ket qua duoc ghi vao EmailLog
        sendEmail({
          taskId: task._id,
          recipientId: u._id,
          to: u.email,
          eventType: type,
          subject: `[Task Manager] ${title}`,
          html,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("notifyUsers loi:", err.message);
  }
}

const nameOf = (actor) => (actor && actor.fullName) || "Một thành viên";

exports.getActor = getActor;
exports.findUserSafe = findUserSafe;
exports.getRelatedUsers = getRelatedUsers;
exports.notifyUsers = notifyUsers;

// Giao viec: thong bao cho nhung nguoi MOI duoc them vao
exports.notifyAssigned = (task, actor, newUsers) =>
  notifyUsers({
    recipients: newUsers,
    task,
    type: "task_assigned",
    title: "Bạn được giao một công việc mới",
    message: `${nameOf(actor)} đã giao cho bạn công việc "${task.title}".`,
    actorId: actor && actor._id,
  });

// Chia se cong viec (moi hoac doi quyen)
exports.notifyShared = (task, actor, user, role) =>
  notifyUsers({
    recipients: [user],
    task,
    type: "task_shared",
    title: "Có công việc được chia sẻ với bạn",
    message: `${nameOf(actor)} đã chia sẻ công việc "${task.title}" với bạn (quyền ${ROLE_LABEL[role]}).`,
    actorId: actor && actor._id,
  });

exports.notifyShareUpdated = (task, actor, user, role) =>
  notifyUsers({
    recipients: [user],
    task,
    type: "task_share_updated",
    title: "Quyền truy cập công việc đã thay đổi",
    message: `${nameOf(actor)} đã đổi quyền của bạn với công việc "${task.title}" thành ${ROLE_LABEL[role]}.`,
    actorId: actor && actor._id,
  });

exports.notifyShareRevoked = (task, actor, user) =>
  notifyUsers({
    recipients: [user],
    task,
    type: "task_share_revoked",
    title: "Quyền truy cập công việc đã bị thu hồi",
    message: `${nameOf(actor)} đã thu hồi quyền chia sẻ công việc "${task.title}" của bạn.`,
    actorId: actor && actor._id,
  });

// Doi han hoan thanh: bao cho moi nguoi lien quan
exports.notifyDueDateChanged = async (task, actor) => {
  const recipients = await getRelatedUsers(task, actor && actor._id);
  const due = task.dueDate ? formatDateTime(task.dueDate) : "không có hạn";
  return notifyUsers({
    recipients,
    task,
    type: "due_date_changed",
    title: "Hạn hoàn thành công việc đã thay đổi",
    message: `${nameOf(actor)} đã đổi hạn hoàn thành của công việc "${task.title}" thành ${due}.`,
    actorId: actor && actor._id,
  });
};

// Hoan thanh cong viec: bao cho moi nguoi lien quan
exports.notifyCompleted = async (task, actor) => {
  const recipients = await getRelatedUsers(task, actor && actor._id);
  return notifyUsers({
    recipients,
    task,
    type: "task_completed",
    title: "Công việc đã hoàn thành",
    message: `${nameOf(actor)} đã đánh dấu hoàn thành công việc "${task.title}".`,
    actorId: actor && actor._id,
  });
};

// Nhac viec sap den han (do job dinh ky goi)
exports.notifyReminder = (task, recipients) =>
  notifyUsers({
    recipients,
    task,
    type: "task_reminder",
    title: "Công việc sắp đến hạn",
    message: `Công việc "${task.title}" sẽ đến hạn vào ${formatDateTime(task.dueDate)}.`,
  });
