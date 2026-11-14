// Cac ham dung chung de kiem tra quyen truy cap / chinh sua 1 cong viec.
// Vai tro cua 1 nguoi dung voi 1 task co the la:
//  - "owner"  : nguoi tao ra task  -> toan quyen (sua, xoa, giao viec, chia se)
//  - "editor" : phu trach chinh (isPrimary) hoac duoc chia se voi quyen editor -> duoc sua,
//               KHONG duoc xoa task hay quan ly chia se
//  - "viewer" : duoc giao (khong phai chinh) hoac duoc chia se voi quyen viewer -> chi xem
//  - null     : khong lien quan gi den task -> khong duoc truy cap

// Lay id dang chuoi, dung duoc ca khi truong da duoc populate (khi do la ca document User,
// String(document) khong phai la id) lan khi chi la ObjectId / chuoi.
function idOf(value) {
  if (value === null || value === undefined) return "";
  if (value._id !== undefined && value._id !== null) return String(value._id);
  return String(value);
}

function getRoleOf(task, userId) {
  const uid = idOf(userId);
  if (!uid) return null;

  if (idOf(task.createdBy) === uid) return "owner";

  const assignee = (task.assignees || []).find((a) => idOf(a.user) === uid);
  if (assignee) return assignee.isPrimary ? "editor" : "viewer";

  const shared = (task.sharedWith || []).find((s) => idOf(s.user) === uid);
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
  return idOf(task.createdBy) === idOf(userId);
}

module.exports = { idOf, getRoleOf, canView, canEdit, isOwner };
