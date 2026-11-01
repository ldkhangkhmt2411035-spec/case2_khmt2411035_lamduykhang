const Task = require("../models/Task");
const User = require("../models/User");
const { getRoleOf, canView, canEdit, isOwner } = require("../utils/taskAccess");

const USER_FIELDS = "fullName email avatarUrl";

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
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// GET /api/tasks?scope=all|mine|assigned|shared&status=&priority=&search=&sortBy=&order=
exports.getTasks = async (req, res) => {
  try {
    const { scope = "all", status, priority, search, sortBy, order } = req.query;
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

    if (status) filter.$and.push({ status });
    if (priority) filter.$and.push({ priority });
    if (search && search.trim()) {
      filter.$and.push({ title: { $regex: search.trim(), $options: "i" } });
    }

    const sortField = ["dueDate", "priority", "createdAt", "startDate", "title"].includes(sortBy)
      ? sortBy
      : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    const tasks = await populateTask(
      Task.find(filter).sort({ [sortField]: sortOrder })
    );

    res.status(200).json({
      tasks: tasks.map((t) => formatTask(t, userId)),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
