const mongoose = require("mongoose");

// Thong bao hien thi trong ung dung (moi dong = 1 thong bao cho 1 nguoi dung)
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    type: {
      type: String,
      enum: [
        "task_assigned",
        "task_shared",
        "task_share_updated",
        "task_share_revoked",
        "due_date_changed",
        "task_completed",
        "task_reminder",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Lay danh sach thong bao cua 1 nguoi, moi nhat truoc / dem so chua doc
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ taskId: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
