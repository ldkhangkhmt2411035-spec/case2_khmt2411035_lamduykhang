const Task = require("../models/Task");
const User = require("../models/User");
const { getRoleOf, canView, canEdit, isOwner } = require("../utils/taskAccess");

const mongoose = require("mongoose");

const USER_FIELDS = "fullName email avatarUrl";

const STATUSES = ["todo", "in_progress", "completed"];
const PRIORITIES = ["low", "medium", "high"];
const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

// Kiem tra trang thai / uu tien / ngay thang. Tra ve thong bao loi hoac null.
function validateTaskFields({ status, priority, startDate, dueDate }) {
  if (status !== undefined && !STATUSES.includes(status)) {
    return "Trạng thái không hợp lệ (todo, in_progress, completed)";
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return "Mức ưu tiên không hợp lệ (low, medium, high)";
  }
  for (const [name, value] of [["Ngày bắt đầu", startDate], ["Hạn hoàn thành", dueDate]]) {
    if (value && isNaN(new Date(value).getTime())) {
      return `${name} không hợp lệ`;
    }
  }
  if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
    return "Hạn hoàn thành phải sau hoặc bằng ngày bắt đầu";
  }
  return null;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Sap xep o phia server. priority sap theo thu tu thap < trung binh < cao;
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

function populateTask(query) {
  return query
    .populate("createdBy", USER_FIELDS)
    .populate("assignees.user", USER_FIELDS)
    .populate("sharedWith.user", USER_FIELDS);
}

// Dinh dang lai task tra ve cho client, kem theo vai tro cua nguoi dang dang nhap
function formatTask(task, userId) {
  const obj = task.toObject({ virtuals: false });
  obj.myRole = getRoleOf(task, userId);
  return obj;
}

// POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    const { title, description, status, priority, startDate, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Thiếu tiêu đề công việc" });
    }

    const fieldError = validateTaskFields({ status, priority, startDate, dueDate });
    if (fieldError) return res.status(400).json({ message: fieldError });

    const task = await Task.create({
      title: title.trim(),
      description: description || "",
      status: status || "todo",
      priority: priority || "medium",
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.userId,
      assignees: [],
      sharedWith: [],
    });

    const populated = await populateTask(Task.findById(task._id));
    res.status(201).json({ message: "Tạo công việc thành công", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// GET /api/tasks?scope=all|mine|assigned|shared&status=&priority=&search=&sortBy=&order=
exports.getTasks = async (req, res) => {
  try {
    const { scope = "all", status, priority, search, sortBy, order, assigneeId } = req.query;
    const userId = req.userId;

    const relatedConditions = [
      { createdBy: userId },
      { "assignees.user": userId },
      { "sharedWith.user": userId },
    ];

    let scopeCondition;
    if (scope === "mine") {
      scopeCondition = { createdBy: userId };
    } else if (scope === "assigned") {
      scopeCondition = { "assignees.user": userId };
    } else if (scope === "shared") {
      scopeCondition = { "sharedWith.user": userId };
    } else {
      scopeCondition = { $or: relatedConditions };
    }

    const filter = { $and: [scopeCondition] };

    if (status) {
      if (!STATUSES.includes(status)) return res.status(400).json({ message: "Trạng thái không hợp lệ" });
      filter.$and.push({ status });
    }
    if (priority) {
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: "Mức ưu tiên không hợp lệ" });
      filter.$and.push({ priority });
    }
    // Loc theo nguoi phu trach
    if (assigneeId) {
      if (!mongoose.isValidObjectId(assigneeId)) {
        return res.status(400).json({ message: "assigneeId không hợp lệ" });
      }
      filter.$and.push({ "assignees.user": assigneeId });
    }
    if (search && search.trim()) {
      filter.$and.push({ title: { $regex: escapeRegex(search.trim()), $options: "i" } });
    }

    const sortOrder = order === "asc" ? 1 : -1;
    // priority va dueDate duoc sap bang sortTasks(); cac truong con lai sap bang MongoDB
    const dbSortField = ["startDate", "title", "createdAt"].includes(sortBy) ? sortBy : "createdAt";
    const dbSortOrder = ["startDate", "title", "createdAt"].includes(sortBy) ? sortOrder : -1;

    const found = await populateTask(
      Task.find(filter).sort({ [dbSortField]: dbSortOrder })
    );
    const tasks = sortTasks(found, sortBy, order);

    res.status(200).json({
      tasks: tasks.map((t) => formatTask(t, userId)),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!canView(task, req.userId)) {
      return res.status(403).json({ message: "Bạn không có quyền xem công việc này" });
    }

    res.status(200).json({ task: formatTask(task, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!canEdit(task, req.userId)) {
      return res.status(403).json({ message: "Bạn không có quyền sửa công việc này" });
    }

    const { title, description, status, priority, startDate, dueDate } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ message: "Tiêu đề không được để trống" });
    }
    const finalStart = startDate !== undefined ? startDate : task.startDate;
    const finalDue = dueDate !== undefined ? dueDate : task.dueDate;
    const fieldError = validateTaskFields({ status, priority, startDate: finalStart, dueDate: finalDue });
    if (fieldError) return res.status(400).json({ message: fieldError });

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({ message: "Cập nhật thành công", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// DELETE /api/tasks/:id   (chi nguoi tao moi duoc xoa)
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!isOwner(task, req.userId)) {
      return res.status(403).json({ message: "Chỉ người tạo công việc mới được xóa" });
    }

    await task.deleteOne();
    res.status(200).json({ message: "Xóa công việc thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// PATCH /api/tasks/:id/status   body: { status }   (owner hoac editor)
exports.updateStatus = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!canEdit(task, req.userId)) {
      return res.status(403).json({ message: "Bạn không có quyền đổi trạng thái công việc này" });
    }

    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ (todo, in_progress, completed)" });
    }

    task.status = status;
    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({ message: "Cập nhật trạng thái thành công", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// POST /api/tasks/:id/assign   body: { emails: ["a@x.com", ...], primaryEmail?: "a@x.com" }
exports.assignTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!canEdit(task, req.userId)) {
      return res.status(403).json({ message: "Bạn không có quyền giao việc này" });
    }

    const { emails, primaryEmail } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "Cần ít nhất 1 email để giao việc" });
    }

    const users = await User.find({ email: { $in: emails.map((e) => e.toLowerCase()) } });
    if (users.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng nào với các email đã nhập" });
    }

    const notFound = emails.filter(
      (e) => !users.some((u) => u.email === e.toLowerCase())
    );

    for (const user of users) {
      const exists = task.assignees.find((a) => String(a.user) === String(user._id));
      if (!exists) {
        task.assignees.push({ user: user._id, isPrimary: false });
      }
    }

    if (primaryEmail) {
      const primaryUser = users.find((u) => u.email === primaryEmail.toLowerCase());
      if (primaryUser) {
        task.assignees.forEach((a) => {
          a.isPrimary = String(a.user) === String(primaryUser._id);
        });
      }
    }

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({
      message: "Giao việc thành công",
      task: formatTask(populated, req.userId),
      notFoundEmails: notFound,
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// DELETE /api/tasks/:id/assign/:userId
exports.removeAssignee = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!canEdit(task, req.userId)) {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này" });
    }

    task.assignees = task.assignees.filter(
      (a) => String(a.user) !== String(req.params.userId)
    );
    await task.save();

    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({ message: "Đã gỡ người phụ trách", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// POST /api/tasks/:id/share   body: { email, role: "viewer"|"editor" }   (chi owner)
exports.shareTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!isOwner(task, req.userId)) {
      return res.status(403).json({ message: "Chỉ người tạo công việc mới được chia sẻ" });
    }

    const { email, role } = req.body;
    if (!email) return res.status(400).json({ message: "Thiếu email để chia sẻ" });

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng với email này" });
    }

    if (String(targetUser._id) === String(req.userId)) {
      return res.status(400).json({ message: "Không thể tự chia sẻ cho chính mình" });
    }

    const finalRole = role === "editor" ? "editor" : "viewer";
    const existing = task.sharedWith.find((s) => String(s.user) === String(targetUser._id));
    if (existing) {
      existing.role = finalRole;
    } else {
      task.sharedWith.push({ user: targetUser._id, role: finalRole });
    }

    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({ message: "Chia sẻ thành công", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// PUT /api/tasks/:id/share/:userId   body: { role }   (chi owner)
exports.updateShareRole = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!isOwner(task, req.userId)) {
      return res.status(403).json({ message: "Chỉ người tạo công việc mới được đổi quyền" });
    }

    const { role } = req.body;
    const entry = task.sharedWith.find((s) => String(s.user) === String(req.params.userId));
    if (!entry) return res.status(404).json({ message: "Người này chưa được chia sẻ công việc" });

    entry.role = role === "editor" ? "editor" : "viewer";
    await task.save();

    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({ message: "Cập nhật quyền thành công", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// DELETE /api/tasks/:id/share/:userId   (chi owner - thu hoi quyen chia se)
exports.revokeShare = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!isOwner(task, req.userId)) {
      return res.status(403).json({ message: "Chỉ người tạo công việc mới được thu hồi quyền" });
    }

    task.sharedWith = task.sharedWith.filter(
      (s) => String(s.user) !== String(req.params.userId)
    );
    await task.save();

    const populated = await populateTask(Task.findById(task._id));
    res.status(200).json({ message: "Đã thu hồi quyền chia sẻ", task: formatTask(populated, req.userId) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};
