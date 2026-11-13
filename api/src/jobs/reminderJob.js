const cron = require("node-cron");
const Task = require("../models/Task");
const User = require("../models/User");
const { notifyReminder } = require("../services/notificationService");

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // nhac truoc han 24 gio

// Quet cac cong viec sap den han (trong 24 gio toi), chua hoan thanh, chua nhac lan nao
async function runReminderJob() {
  const now = new Date();
  const limit = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const tasks = await Task.find({
    dueDate: { $gte: now, $lte: limit },
    status: { $ne: "completed" },
    reminderSent: { $ne: true },
  });

  for (const task of tasks) {
    // Nhac nguoi duoc giao; neu chua giao cho ai thi nhac chu so huu
    const ids = task.assignees.length > 0 ? task.assignees.map((a) => a.user) : [task.createdBy];
    const recipients = await User.find({ _id: { $in: ids } }).select("fullName email");

    await notifyReminder(task, recipients);
    task.reminderSent = true;
    await task.save();
  }
  return tasks.length;
}

// Chay moi gio (phut 0). Tat bang ENABLE_REMINDERS=false
function startReminderJob() {
  if (process.env.ENABLE_REMINDERS === "false") return;
  cron.schedule("0 * * * *", () => {
    runReminderJob().catch((err) => console.error("reminderJob loi:", err.message));
  });
  console.log("Da bat job nhac viec (moi gio)");
}

module.exports = { runReminderJob, startReminderJob };
