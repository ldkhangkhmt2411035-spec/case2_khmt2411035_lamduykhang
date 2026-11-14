const EmailLog = require("../models/EmailLog");
const Task = require("../models/Task");
const { retryEmail } = require("../services/emailService");
const { MAX_TOTAL_ATTEMPTS } = require("../config/email");
const { isOwner } = require("../utils/taskAccess");

// Bo noi dung email (body) khoi phan hoi
function publicLog(log) {
  const obj = typeof log.toObject === "function" ? log.toObject() : { ...log };
  delete obj.body;
  return obj;
}

// GET /api/tasks/:id/email-logs   (chi nguoi tao: log chua dia chi email cua nhung nguoi khac)
exports.getTaskEmailLogs = async (req, res) => {
  const logs = await EmailLog.find({ taskId: req.task._id }).sort({ createdAt: -1 }).limit(100);
  res.status(200).json({ logs });
};

// POST /api/email-logs/:id/retry   - gui lai 1 email da that bai (chi nguoi tao cong viec)
exports.retryEmailLog = async (req, res) => {
  const log = await EmailLog.findById(req.params.id);
  const task = log && log.taskId ? await Task.findById(log.taskId) : null;

  // Cung 1 thong bao cho "khong ton tai" va "khong co quyen" de khong lo su ton tai cua log
  if (!log || !task || !isOwner(task, req.userId)) {
    return res.status(403).json({ message: "Bạn không có quyền gửi lại email này" });
  }
  if (log.status === "sent") {
    return res.status(409).json({ message: "Email đã được gửi thành công, không cần gửi lại" });
  }
  if (log.status === "pending") {
    return res.status(409).json({ message: "Email đang được gửi, vui lòng chờ" });
  }
  if (log.attempts >= MAX_TOTAL_ATTEMPTS) {
    return res.status(409).json({ message: "Đã vượt quá số lần gửi lại cho phép" });
  }

  // "Giu cho" nguyen tu: chi 1 yeu cau duoc chuyen failed -> pending, tranh gui trung khi bam nhieu lan
  const claimed = await EmailLog.findOneAndUpdate(
    { _id: log._id, status: "failed", attempts: { $lt: MAX_TOTAL_ATTEMPTS } },
    { $set: { status: "pending" } },
    { new: true }
  ).select("+body");
  if (!claimed) {
    return res.status(409).json({ message: "Email đang được xử lý hoặc không thể gửi lại" });
  }

  if (!claimed.body) {
    claimed.status = "failed";
    await claimed.save();
    return res.status(409).json({ message: "Email cũ không lưu nội dung nên không thể gửi lại" });
  }

  const result = await retryEmail(claimed);
  res.status(200).json({
    message: result.status === "sent" ? "Đã gửi lại email thành công" : "Gửi lại email thất bại",
    log: publicLog(result),
  });
};
