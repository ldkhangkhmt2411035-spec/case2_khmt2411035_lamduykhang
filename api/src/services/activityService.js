const TaskActivity = require("../models/TaskActivity");

const STATUS_LABEL = {
  todo: "Chưa thực hiện",
  in_progress: "Đang thực hiện",
  completed: "Đã hoàn thành",
};

const ROLE_LABEL = { viewer: "chỉ xem", editor: "chỉnh sửa" };

function fmtDate(date) {
  if (!date) return "không có";
  return new Date(date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

// Ghi 1 dong lich su. details la cau mo ta de hien thi, meta la du lieu kem theo (tu/den, quyen...).
// Luu dang object: { message, ...meta }. Khong bao gio nem loi de khong lam hong thao tac chinh.
async function logActivity({ taskId, userId, action, details = "", meta = {} }) {
  try {
    await TaskActivity.create({ taskId, userId, action, details: { message: details, ...meta } });
  } catch (err) {
    console.error("logActivity loi:", err.message);
  }
}

module.exports = { logActivity, fmtDate, STATUS_LABEL, ROLE_LABEL };
