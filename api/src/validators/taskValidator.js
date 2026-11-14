const mongoose = require("mongoose");

const STATUSES = ["todo", "in_progress", "completed"];
const PRIORITIES = ["low", "medium", "high"];
const PERMISSIONS = ["viewer", "editor"];
const MAX_PEOPLE_PER_REQUEST = 50;

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// Kiem tra trang thai / uu tien / ngay thang. Tra ve thong bao loi hoac null.
function validateTaskFields({ status, priority, startDate, dueDate }) {
  if (status !== undefined && !STATUSES.includes(status)) {
    return "Trạng thái không hợp lệ (todo, in_progress, completed)";
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return "Mức ưu tiên không hợp lệ (low, medium, high)";
  }
  for (const [name, value] of [
    ["Ngày bắt đầu", startDate],
    ["Hạn hoàn thành", dueDate],
  ]) {
    if (value && isNaN(new Date(value).getTime())) {
      return `${name} không hợp lệ`;
    }
  }
  if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
    return "Hạn hoàn thành phải sau hoặc bằng ngày bắt đầu";
  }
  return null;
}

function validateCreateTask(body) {
  if (!isNonEmptyString(body.title)) return "Thiếu tiêu đề công việc";
  return validateTaskFields(body);
}

function validateStatusBody(body) {
  if (!STATUSES.includes(body.status)) {
    return "Trạng thái không hợp lệ (todo, in_progress, completed)";
  }
  return null;
}

// ---------- Giao viec ----------
// Body: { userIds?: [id], emails?: [email], primaryUserId?, primaryEmail? }
function parseAssignBody(body) {
  const emails = body.emails === undefined ? [] : body.emails;
  const userIds = body.userIds === undefined ? [] : body.userIds;
  if (!Array.isArray(emails) || !Array.isArray(userIds)) {
    return { error: "emails và userIds phải là danh sách" };
  }
  if (![...emails, ...userIds].every(isNonEmptyString)) {
    return { error: "Danh sách người được giao chứa giá trị không hợp lệ" };
  }
  if (emails.length + userIds.length === 0) {
    return { error: "Cần ít nhất 1 người để giao việc" };
  }
  if (emails.length + userIds.length > MAX_PEOPLE_PER_REQUEST) {
    return { error: `Mỗi lần chỉ giao tối đa ${MAX_PEOPLE_PER_REQUEST} người` };
  }
  for (const key of ["primaryUserId", "primaryEmail"]) {
    if (body[key] !== undefined && body[key] !== null && !isNonEmptyString(body[key])) {
      return { error: `${key} không hợp lệ` };
    }
  }
  return {
    emails: emails.map((e) => e.trim().toLowerCase()),
    userIds: userIds.map((i) => i.trim()),
    primaryUserId: body.primaryUserId ? body.primaryUserId.trim() : null,
    primaryEmail: body.primaryEmail ? body.primaryEmail.trim().toLowerCase() : null,
  };
}

// ---------- Chia se ----------
// Chap nhan 3 dang body:
//  1) { shares: [{ userId?|email?, permission }] }
//  2) { emails: [...], userIds: [...], permission }       (cung 1 quyen cho nhieu nguoi)
//  3) { email, role|permission }                            (dang cu, 1 nguoi)
// Tra ve { entries: [{ email?, userId?, permission }] } hoac { error }.
function parseShareBody(body) {
  const readPermission = (obj) => {
    const value = obj.permission !== undefined ? obj.permission : obj.role;
    return value === undefined ? "viewer" : value;
  };

  let raw = [];
  if (body.shares !== undefined) {
    if (!Array.isArray(body.shares)) return { error: "shares phải là danh sách" };
    raw = body.shares.map((s) => ({
      email: s && s.email,
      userId: s && s.userId,
      permission: s ? readPermission(s) : undefined,
    }));
  } else {
    const permission = readPermission(body);
    const emails = Array.isArray(body.emails) ? body.emails : body.email !== undefined ? [body.email] : [];
    const userIds = Array.isArray(body.userIds) ? body.userIds : body.userId !== undefined ? [body.userId] : [];
    raw = [
      ...emails.map((email) => ({ email, permission })),
      ...userIds.map((userId) => ({ userId, permission })),
    ];
  }

  if (raw.length === 0) return { error: "Cần ít nhất 1 người để chia sẻ" };
  if (raw.length > MAX_PEOPLE_PER_REQUEST) {
    return { error: `Mỗi lần chỉ chia sẻ tối đa ${MAX_PEOPLE_PER_REQUEST} người` };
  }

  const entries = [];
  for (const item of raw) {
    const hasEmail = isNonEmptyString(item.email);
    const hasId = isNonEmptyString(item.userId);
    if (hasEmail === hasId) return { error: "Mỗi người cần đúng một trong hai: email hoặc userId" };
    if (!PERMISSIONS.includes(item.permission)) {
      return { error: "Quyền chia sẻ không hợp lệ (viewer hoặc editor)" };
    }
    if (hasId && !mongoose.isValidObjectId(item.userId.trim())) {
      return { error: "userId không hợp lệ" };
    }
    entries.push({
      email: hasEmail ? item.email.trim().toLowerCase() : null,
      userId: hasId ? item.userId.trim() : null,
      permission: item.permission,
    });
  }
  return { entries };
}

function parsePermissionBody(body) {
  const value = body.permission !== undefined ? body.permission : body.role;
  if (!PERMISSIONS.includes(value)) return { error: "Quyền chia sẻ không hợp lệ (viewer hoặc editor)" };
  return { permission: value };
}

module.exports = {
  STATUSES,
  PRIORITIES,
  PERMISSIONS,
  validateTaskFields,
  validateCreateTask,
  validateStatusBody,
  parseAssignBody,
  parseShareBody,
  parsePermissionBody,
};
