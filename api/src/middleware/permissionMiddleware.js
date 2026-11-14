const Task = require("../models/Task");
const { canView, canEdit, isOwner } = require("../utils/taskAccess");

const RULES = {
  view: { check: canView, message: "Bạn không có quyền xem công việc này" },
  edit: { check: canEdit, message: "Bạn không có quyền chỉnh sửa công việc này" },
  owner: { check: isOwner, message: "Chỉ người tạo công việc mới được thực hiện thao tác này" },
};

// requireTaskAccess("view" | "edit" | "owner"): nap cong viec theo :id, kiem tra quyen o backend.
// Gan task vao req.task cho handler phia sau. 404 neu khong co task, 403 neu khong du quyen.
exports.requireTaskAccess = (level) => {
  const rule = RULES[level];
  if (!rule) throw new Error(`Muc quyen khong hop le: ${level}`);

  return async (req, res, next) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!rule.check(task, req.userId)) {
      return res.status(403).json({ message: rule.message });
    }
    req.task = task;
    next();
  };
};
