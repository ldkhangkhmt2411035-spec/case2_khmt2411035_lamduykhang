const mongoose = require("mongoose");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const TaskActivity = require("../models/TaskActivity");
const notify = require("../services/notificationService");
const { logActivity, fmtDate, STATUS_LABEL } = require("../services/activityService");
const { populateTask, formatTask, sortTasks, escapeRegex } = require("../services/taskService");
const { validateTaskFields, STATUSES, PRIORITIES } = require("../validators/taskValidator");

// Phan quyen (xem / sua / chu so huu) duoc kiem tra o permissionMiddleware truoc khi vao cac handler duoi day.
// Loi bat ngo trong handler (async) duoc errorMiddleware xu ly tap trung.

// POST /api/tasks
exports.createTask = async (req, res) => {
  const { title, description, status, priority, startDate, dueDate } = req.body;

  const task = await Task.create({
    title: title.trim(),
    description: typeof description === "string" ? description : "",
    status: status || "todo",
    priority: priority || "medium",
    startDate: startDate ? new Date(startDate) : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    createdBy: req.userId,
    assignees: [],
    sharedWith: [],
  });

  await logActivity({
    taskId: task._id,
    userId: req.userId,
    action: "created",
    details: `Tạo công việc "${task.title}"`,
  });

  const populated = await populateTask(Task.findById(task._id));
  res.status(201).json({ message: "Tạo công việc thành công", task: formatTask(populated, req.userId) });
};

// GET /api/tasks?scope=all|created|assigned|shared&status=&priority=&assigneeId=&q=&sortBy=&order=
// (chap nhan them: scope=mine tuong duong created, search tuong duong q)
exports.getTasks = async (req, res) => {
  const { status, priority, sortBy, order, assigneeId } = req.query;
  const scope = req.query.scope || "all";
  const search = req.query.q !== undefined ? req.query.q : req.query.search;
  const userId = req.userId;

  const scopeConditions = {
    created: { createdBy: userId },
    mine: { createdBy: userId },
    assigned: { "assignees.user": userId },
    shared: { "sharedWith.user": userId },
    all: {
      $or: [{ createdBy: userId }, { "assignees.user": userId }, { "sharedWith.user": userId }],
    },
  };
  if (!Object.prototype.hasOwnProperty.call(scopeConditions, scope)) {
    return res.status(400).json({ message: "scope không hợp lệ (all, created, assigned, shared)" });
  }

  const filter = { $and: [scopeConditions[scope]] };

  if (status) {
    if (!STATUSES.includes(status)) return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    filter.$and.push({ status });
  }
  if (priority) {
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: "Mức ưu tiên không hợp lệ" });
    filter.$and.push({ priority });
  }
  if (assigneeId) {
    if (!mongoose.isValidObjectId(assigneeId)) {
      return res.status(400).json({ message: "assigneeId không hợp lệ" });
    }
    filter.$and.push({ "assignees.user": assigneeId });
  }
  if (search !== undefined) {
    if (typeof search !== "string") return res.status(400).json({ message: "Từ khóa tìm kiếm không hợp lệ" });
    if (search.trim()) {
      filter.$and.push({ title: { $regex: escapeRegex(search.trim()), $options: "i" } });
    }
  }

  // priority va dueDate duoc sap bang sortTasks(); cac truong con lai sap bang MongoDB
  const sortOrder = order === "asc" ? 1 : -1;
  const dbSortable = ["startDate", "title", "createdAt"].includes(sortBy);
  const found = await populateTask(
    Task.find(filter).sort({ [dbSortable ? sortBy : "createdAt"]: dbSortable ? sortOrder : -1 })
  );
  const tasks = sortTasks(found, sortBy, order);

  res.status(200).json({ tasks: tasks.map((t) => formatTask(t, userId)) });
};

// GET /api/tasks/:id   (quyen xem)
exports.getTaskById = async (req, res) => {
  const task = await populateTask(Task.findById(req.task._id));
  res.status(200).json({ task: formatTask(task, req.userId) });
};

// PUT /api/tasks/:id   (quyen sua)
exports.updateTask = async (req, res) => {
  const task = req.task;
  const { title, description, status, priority, startDate, dueDate } = req.body;

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return res.status(400).json({ message: "Tiêu đề không được để trống" });
  }
  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ message: "Mô tả không hợp lệ" });
  }
  const finalStart = startDate !== undefined ? startDate : task.startDate;
  const finalDue = dueDate !== undefined ? dueDate : task.dueDate;
  const fieldError = validateTaskFields({ status, priority, startDate: finalStart, dueDate: finalDue });
  if (fieldError) return res.status(400).json({ message: fieldError });

  const prevStatus = task.status;
  const prevDue = task.dueDate ? task.dueDate.getTime() : null;
  const before = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    startDate: task.startDate ? task.startDate.getTime() : null,
    dueDate: task.dueDate,
  };

  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
  if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;

  const newDue = task.dueDate ? task.dueDate.getTime() : null;
  const dueChanged = prevDue !== newDue;
  if (dueChanged) task.reminderSent = false; // doi han -> cho phep nhac lai theo han moi

  await task.save();

  // Ghi lich su hoat dong
  const changedFields = [];
  if (task.title !== before.title) changedFields.push("tiêu đề");
  if (task.description !== before.description) changedFields.push("mô tả");
  if (task.priority !== before.priority) changedFields.push("mức ưu tiên");
  if ((task.startDate ? task.startDate.getTime() : null) !== before.startDate) changedFields.push("ngày bắt đầu");
  if (changedFields.length > 0) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "updated",
      details: `Cập nhật ${changedFields.join(", ")}`,
      meta: { fields: changedFields },
    });
  }
  if (task.status !== prevStatus) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "status_changed",
      details: `Đổi trạng thái: ${STATUS_LABEL[prevStatus]} → ${STATUS_LABEL[task.status]}`,
      meta: { from: prevStatus, to: task.status },
    });
  }
  if (dueChanged) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "due_date_changed",
      details: `Đổi hạn hoàn thành: ${fmtDate(before.dueDate)} → ${fmtDate(task.dueDate)}`,
      meta: { from: before.dueDate, to: task.dueDate },
    });
  }

  // Thong bao cac su kien quan trong (khong lam hong request neu that bai)
  const justCompleted = task.status === "completed" && prevStatus !== "completed";
  if (dueChanged || justCompleted) {
    const actor = await notify.getActor(req.userId);
    if (dueChanged) await notify.notifyDueDateChanged(task, actor);
    if (justCompleted) await notify.notifyCompleted(task, actor);
  }

  const populated = await populateTask(Task.findById(task._id));
  res.status(200).json({ message: "Cập nhật thành công", task: formatTask(populated, req.userId) });
};

// DELETE /api/tasks/:id   (chi nguoi tao)
exports.deleteTask = async (req, res) => {
  const task = req.task;
  await task.deleteOne();
  await Notification.deleteMany({ taskId: task._id }); // thong bao cua task da xoa khong con y nghia
  await TaskActivity.deleteMany({ taskId: task._id });
  res.status(200).json({ message: "Xóa công việc thành công" });
};

// PATCH /api/tasks/:id/status   body: { status }   (quyen sua)
exports.updateStatus = async (req, res) => {
  const task = req.task;
  const { status } = req.body;

  const prevStatus = task.status;
  task.status = status;
  await task.save();

  if (status !== prevStatus) {
    await logActivity({
      taskId: task._id,
      userId: req.userId,
      action: "status_changed",
      details: `Đổi trạng thái: ${STATUS_LABEL[prevStatus]} → ${STATUS_LABEL[status]}`,
      meta: { from: prevStatus, to: status },
    });
  }

  if (status === "completed" && prevStatus !== "completed") {
    const actor = await notify.getActor(req.userId);
    await notify.notifyCompleted(task, actor);
  }

  const populated = await populateTask(Task.findById(task._id));
  res.status(200).json({ message: "Cập nhật trạng thái thành công", task: formatTask(populated, req.userId) });
};
