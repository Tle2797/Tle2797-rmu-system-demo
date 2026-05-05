import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 587);
const resendApiUrl = "https://api.resend.com/emails";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  requireTLS: smtpPort === 587,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getClientUrl() {
  return (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendMailMessage({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (process.env.RESEND_API_KEY) {
    const from = process.env.RESEND_FROM || process.env.MAIL_FROM;
    if (!from) {
      throw new Error("RESEND_FROM or MAIL_FROM is required");
    }

    const res = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        `Resend email failed (${res.status}): ${JSON.stringify(data)}`,
      );
    }

    console.log("Email sent with Resend", { subject, to, data });
    return;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP configuration is incomplete");
  }

  if (
    process.env.SMTP_USER === "your_email@gmail.com" ||
    process.env.SMTP_PASS === "your_app_password"
  ) {
    throw new Error("SMTP configuration is still using placeholder values");
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  console.log("Email sent", {
    subject,
    to,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    pending: info.pending,
  });
}

export async function sendPasswordResetOtp(email: string, otp: string) {
  await sendMailMessage({
    to: email,
    subject: "Password reset OTP",
    text: `Your password reset OTP is ${otp}.\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Password reset OTP</h2>
        <p>Your password reset OTP is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}

export async function sendUserApprovalEmail({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const loginUrl = `${getClientUrl()}/login`;
  const safeFullName = escapeHtml(fullName || "ผู้ใช้งาน");
  const safeLoginUrl = escapeHtml(loginUrl);
  const approvalMessage =
    "บัญชีผู้ใช้งานของคุณได้รับการอนุมัติให้เข้าใช้งานระบบประเมินความพึงพอใจ " +
    "การใช้บริการหน่วยงาน ภายในมหาวิทยาลัยราชภัฏมหาสารคาม โดยใช้เทคโนโลยีคิวอาร์โค้ด";
  const safeApprovalMessage = escapeHtml(approvalMessage);

  await sendMailMessage({
    to: email,
    subject: "บัญชีผู้ใช้งานได้รับการอนุมัติแล้ว",
    text:
      `เรียน ${fullName || "ผู้ใช้งาน"}\n\n` +
      `${approvalMessage}\n` +
      `เข้าสู่ระบบได้ที่: ${loginUrl}\n\n` +
      "ขอบคุณครับ/ค่ะ",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">บัญชีผู้ใช้งานได้รับการอนุมัติแล้ว</h2>
        <p>เรียน ${safeFullName}</p>
        <p>${safeApprovalMessage}</p>
        <p>
          <a
            href="${safeLoginUrl}"
            style="display: inline-block; border-radius: 12px; background: #0369a1; color: #ffffff; padding: 10px 16px; text-decoration: none; font-weight: 700;"
          >
            เข้าสู่ระบบ
          </a>
        </p>
        <p style="font-size: 13px; color: #475569;">
          หากปุ่มไม่สามารถเปิดได้ กรุณาเปิดลิงก์นี้ในเบราว์เซอร์:<br />
          <a href="${safeLoginUrl}" style="color: #0369a1;">${safeLoginUrl}</a>
        </p>
      </div>
    `,
  });
}
