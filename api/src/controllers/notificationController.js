const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const EmailLog = require("../models/EmailLog");
const Task = require("../models/Task");
const { isOwner } = require("../utils/taskAccess");

// GET /api/notifications?unread=true&limit=50
exports.getNotifications = async (req, res) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.unread === "true") filter.isRead = false;

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
    const unreadCount = await Notification.countDocuments({ userId: req.userId, isRead: false });

    res.status(200).json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// GET /api/notifications/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.userId, isRead: false });
    res.status(200).json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
    res.status(200).json({ message: "Đã đánh dấu tất cả là đã đọc", unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã thông báo không hợp lệ" });
    }
    // Loc theo userId de khong ai doc/sua duoc thong bao cua nguoi khac
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Không tìm thấy thông báo" });

    res.status(200).json({ message: "Đã đánh dấu đã đọc", notification });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// GET /api/tasks/:id/email-logs   (chi nguoi tao: log chua dia chi email cua nhung nguoi khac)
exports.getTaskEmailLogs = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Mã công việc không hợp lệ" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy công việc" });

    if (!isOwner(task, req.userId)) {
      return res.status(403).json({ message: "Chỉ người tạo công việc mới xem được nhật ký email" });
    }

    const logs = await EmailLog.find({ taskId: task._id }).sort({ createdAt: -1 }).limit(100);
    res.status(200).json({ logs });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};
