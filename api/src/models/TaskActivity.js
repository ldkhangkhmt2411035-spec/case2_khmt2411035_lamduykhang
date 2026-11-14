const mongoose = require("mongoose");

// Lich su hoat dong cua cong viec (ai lam gi, luc nao)
const taskActivitySchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "status_changed",
        "due_date_changed",
        "assigned",
        "unassigned",
        "shared",
        "share_updated",
        "share_revoked",
      ],
      required: true,
    },
    // Chi tiet thay doi dang object: { message, ...du lieu kem theo (tu, den, quyen...) }
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

taskActivitySchema.index({ taskId: 1, createdAt: -1 });

module.exports = mongoose.model("TaskActivity", taskActivitySchema);
