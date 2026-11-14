// Mau noi dung email. Du lieu do nguoi dung nhap (tieu de cong viec, ten...) luon duoc escape.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function renderEmail({ title, message, taskTitle, dueDate }) {
  const due = dueDate ? `<p>Hạn hoàn thành: <b>${escapeHtml(formatDateTime(dueDate))}</b></p>` : "";
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:16px">
      <h2 style="color:#3949ab">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <p>Công việc: <b>${escapeHtml(taskTitle)}</b></p>
      ${due}
      <hr/>
      <p style="color:#888;font-size:12px">Email tự động từ ứng dụng Task Manager.</p>
    </div>`;
}

module.exports = { escapeHtml, formatDateTime, renderEmail };
