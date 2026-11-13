const mongoose = require("mongoose");

// Nhat ky gui email: moi lan gui (thanh cong hay that bai) deu duoc ghi lai
const emailLogSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    recipientEmail: { type: String, required: true },
    eventType: { type: String, required: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailLogSchema.index({ taskId: 1, createdAt: -1 });
emailLogSchema.index({ status: 1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
