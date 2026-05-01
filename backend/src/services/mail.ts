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

export async function sendPasswordResetOtp(email: string, otp: string) {
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
        to: [email],
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
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        `Resend email failed (${res.status}): ${JSON.stringify(data)}`,
      );
    }

    console.log("Password reset OTP email sent with Resend", data);
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
    to: email,
    subject: "Password reset OTP",
    text: `Your password reset OTP is ${otp}.\nThis code expires in 10 minutes.`,
  });

  console.log("Password reset OTP email sent", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    pending: info.pending,
  });
}
