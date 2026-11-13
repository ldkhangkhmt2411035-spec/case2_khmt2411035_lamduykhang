const mongoose = require("mongoose");
const Task = require("../models/Task");
const TaskActivity = require("../models/TaskActivity");
const { canView } = require("../utils/taskAccess");

// GET /api/tasks/:id/activities   (moi nguoi co quyen xem cong viec deu xem duoc)
exports.getTaskActivities = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã công việc không hợp lệ" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!canView(task, req.userId)) {
      return res.status(403).json({ message: "Bạn không có quyền xem công việc này" });
    }

    const activities = await TaskActivity.find({ taskId: task._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "fullName email");

    res.status(200).json({
      activities: activities.map((a) => ({
        _id: a._id,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt,
        user: a.userId ? { _id: a.userId._id, fullName: a.userId.fullName, email: a.userId.email } : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};
