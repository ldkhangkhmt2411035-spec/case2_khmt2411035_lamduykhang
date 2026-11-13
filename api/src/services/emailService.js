const nodemailer = require("nodemailer");
const EmailLog = require("../models/EmailLog");

const MAX_ATTEMPTS = 3; // so lan thu gui toi da cho 1 email
const RETRY_DELAY_MS = 1500;

let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Du lieu do nguoi dung nhap (tieu de cong viec, ten...) phai duoc escape truoc khi dua vao HTML
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

// Noi dung email dang HTML don gian
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

// Gui email va ghi EmailLog. KHONG nem loi ra ngoai: loi gui email khong duoc lam hong API chinh.
async function sendEmail({ taskId = null, recipientId = null, to, eventType, subject, html }) {
  let log;
  try {
    log = await EmailLog.create({
      taskId,
      recipientId,
      recipientEmail: to,
      eventType,
      subject,
      status: "pending",
    });

    if (!isConfigured()) {
      log.status = "failed";
      log.errorMessage = "SMTP chưa được cấu hình (SMTP_HOST, SMTP_USER, SMTP_PASS)";
      await log.save();
      return log;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      log.attempts = attempt;
      try {
        await getTransporter().sendMail({
          from: process.env.MAIL_FROM || process.env.SMTP_USER,
          to,
          subject,
          html,
        });
        log.status = "sent";
        log.sentAt = new Date();
        log.errorMessage = "";
        break;
      } catch (err) {
        log.status = "failed";
        log.errorMessage = err.message;
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      }
    }
    await log.save();
  } catch (err) {
    console.error("sendEmail loi:", err.message);
  }
  return log;
}

module.exports = { sendEmail, renderEmail, escapeHtml, formatDateTime, isConfigured };
