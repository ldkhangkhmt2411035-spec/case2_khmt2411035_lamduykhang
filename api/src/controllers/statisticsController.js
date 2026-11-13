const Task = require("../models/Task");

const UPCOMING_DAYS = 3; // "sap den han" = trong 3 ngay toi

// Cong viec nguoi dung co lien quan: tu tao, duoc giao, hoac duoc chia se
const relatedFilter = (userId) => ({
  $or: [{ createdBy: userId }, { "assignees.user": userId }, { "sharedWith.user": userId }],
});

// GET /api/statistics/tasks  -> thong ke theo trang thai / muc uu tien
exports.getTaskStats = async (req, res) => {
  try {
    const base = relatedFilter(req.userId);
    const count = (extra) => Task.countDocuments({ $and: [base, extra] });

    const [total, todo, inProgress, completed, low, medium, high] = await Promise.all([
      Task.countDocuments(base),
      count({ status: "todo" }),
      count({ status: "in_progress" }),
      count({ status: "completed" }),
      count({ priority: "low" }),
      count({ priority: "medium" }),
      count({ priority: "high" }),
    ]);

    res.status(200).json({
      total,
      byStatus: { todo, in_progress: inProgress, completed },
      byPriority: { low, medium, high },
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// GET /api/statistics/assignments  -> thong ke giao viec / chia se
exports.getAssignmentStats = async (req, res) => {
  try {
    const uid = req.userId;
    const [createdByMe, assignedToMe, primaryForMe, sharedWithMe, assignedByMeToOthers] = await Promise.all([
      Task.countDocuments({ createdBy: uid }),
      Task.countDocuments({ "assignees.user": uid }),
      Task.countDocuments({ assignees: { $elemMatch: { user: uid, isPrimary: true } } }),
      Task.countDocuments({ "sharedWith.user": uid }),
      Task.countDocuments({ createdBy: uid, "assignees.0": { $exists: true } }),
    ]);

    res.status(200).json({ createdByMe, assignedToMe, primaryForMe, sharedWithMe, assignedByMeToOthers });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// GET /api/statistics/deadlines  -> cong viec sap den han va qua han (chua hoan thanh)
exports.getDeadlineStats = async (req, res) => {
  try {
    const base = relatedFilter(req.userId);
    const now = new Date();
    const soon = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
    const fields = "title dueDate status priority";

    const overdueFilter = { $and: [base, { status: { $ne: "completed" } }, { dueDate: { $ne: null, $lt: now } }] };
    const upcomingFilter = {
      $and: [base, { status: { $ne: "completed" } }, { dueDate: { $gte: now, $lte: soon } }],
    };

    const [overdue, overdueCount, upcoming, upcomingCount] = await Promise.all([
      Task.find(overdueFilter).select(fields).sort({ dueDate: 1 }).limit(20),
      Task.countDocuments(overdueFilter),
      Task.find(upcomingFilter).select(fields).sort({ dueDate: 1 }).limit(20),
      Task.countDocuments(upcomingFilter),
    ]);

    res.status(200).json({ upcomingDays: UPCOMING_DAYS, overdueCount, overdue, upcomingCount, upcoming });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};
