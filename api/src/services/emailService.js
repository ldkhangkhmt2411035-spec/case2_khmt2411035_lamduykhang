const EmailLog = require("../models/EmailLog");
const {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  isConfigured,
  getTransporter,
  getFrom,
} = require("../config/email");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gui email cho 1 EmailLog (toi da maxAttempts lan), cap nhat trang thai sent / failed va so lan thu.
async function deliver(log, html, maxAttempts) {
  if (!isConfigured()) {
    log.status = "failed";
    log.errorMessage = "SMTP chưa được cấu hình (SMTP_HOST, SMTP_USER, SMTP_PASS)";
    await log.save();
    return log;
  }

  for (let i = 0; i < maxAttempts; i++) {
    log.attempts += 1;
    try {
      await getTransporter().sendMail({
        from: getFrom(),
        to: log.recipientEmail,
        subject: log.subject,
        html,
      });
      log.status = "sent";
      log.sentAt = new Date();
      log.errorMessage = "";
      break;
    } catch (err) {
      log.status = "failed";
      log.errorMessage = err.message;
      if (i < maxAttempts - 1) await sleep(RETRY_DELAY_MS);
    }
  }
  await log.save();
  return log;
}

// Gui email va ghi EmailLog. KHONG nem loi ra ngoai: loi gui email khong duoc lam hong API chinh.
async function sendEmail({ taskId = null, recipientId = null, to, eventType, subject, html }) {
  let log = null;
  try {
    log = await EmailLog.create({
      taskId,
      recipientId,
      recipientEmail: to,
      eventType,
      subject,
      body: html,
      status: "pending",
    });
    return await deliver(log, html, MAX_ATTEMPTS);
  } catch (err) {
    console.error("sendEmail loi:", err.message);
    return log;
  }
}

// Gui lai 1 email that bai (1 lan thu moi lan bam). log phai duoc nap kem truong body.
async function retryEmail(log) {
  return deliver(log, log.body, 1);
}

module.exports = { sendEmail, retryEmail };
