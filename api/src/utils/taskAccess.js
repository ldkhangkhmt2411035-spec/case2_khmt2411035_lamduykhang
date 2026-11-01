// Cac ham dung chung de kiem tra quyen truy cap / chinh sua 1 cong viec.
// Vai tro cua 1 nguoi dung voi 1 task co the la:
//  - "owner"  : nguoi tao ra task  -> toan quyen (sua, xoa, giao viec, chia se)
//  - "editor" : phu trach chinh (isPrimary) hoac duoc chia se voi role editor -> duoc sua
//  - "viewer" : duoc giao (khong phai chinh) hoac duoc chia se voi role viewer -> chi xem
//  - null     : khong lien quan gi den task -> khong duoc truy cap

function getRoleOf(task, userId) {
  const uid = String(userId);

  if (String(task.createdBy) === uid) return "owner";

  const assignee = (task.assignees || []).find((a) => String(a.user) === uid);
  if (assignee) return assignee.isPrimary ? "editor" : "viewer";

  const shared = (task.sharedWith || []).find((s) => String(s.user) === uid);
  if (shared) return shared.role === "editor" ? "editor" : "viewer";

  return null;
}

function canView(task, userId) {
  return getRoleOf(task, userId) !== null;
}

function canEdit(task, userId) {
  const role = getRoleOf(task, userId);
  return role === "owner" || role === "editor";
}

function isOwner(task, userId) {
  return String(task.createdBy) === String(userId);
}

module.exports = { getRoleOf, canView, canEdit, isOwner };
