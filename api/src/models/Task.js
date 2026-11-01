const mongoose = require("mongoose");

// Nguoi duoc giao viec (co the giao cho nhieu nguoi, 1 nguoi la phu trach chinh)
const assigneeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

// Nguoi duoc chia se xem/sua cong viec
const sharedWithSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    assignees: { type: [assigneeSchema], default: [] },
    sharedWith: { type: [sharedWithSchema], default: [] },
  },
  { timestamps: true }
);

// Tang toc cac truy van liet ke / tim kiem cong viec lien quan den 1 nguoi dung
taskSchema.index({ createdBy: 1 });
taskSchema.index({ "assignees.user": 1 });
taskSchema.index({ "sharedWith.user": 1 });
taskSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Task", taskSchema);
