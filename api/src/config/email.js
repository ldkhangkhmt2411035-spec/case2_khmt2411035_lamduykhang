const nodemailer = require("nodemailer");

// Cau hinh gui email qua SMTP. Thong tin ket noi lay tu bien moi truong (.env), khong viet vao ma nguon.
const MAX_ATTEMPTS = 3; // so lan thu gui toi da cho moi lan gui
const RETRY_DELAY_MS = Number(process.env.EMAIL_RETRY_DELAY_MS) || 1500; // cho giua 2 lan thu (ms)
const MAX_TOTAL_ATTEMPTS = 6; // tong so lan thu toi da (gom ca gui lai thu cong) - tranh gui trung

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

function getFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

module.exports = {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  MAX_TOTAL_ATTEMPTS,
  isConfigured,
  getTransporter,
  getFrom,
};
