import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using Nodemailer + Brevo SMTP
 */
export async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const user = process.env.BREVO_SMTP_USER?.trim();
    const pass = process.env.BREVO_SMTP_PASS?.trim();
    if (!user || !pass) {
      throw new Error("BREVO_SMTP_USER and BREVO_SMTP_PASS environment variables must be set.");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    console.log("Attempting to send email to:", to);
    const info = await transporter.sendMail({
      from: `fLexiScribe <${user}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully:", info.messageId);
    return { success: true, data: { id: info.messageId } };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, error };
  }
}

/**
 * Generate a professional HTML email template
 */
function emailTemplate({
  title,
  body,
}: {
  title: string;
  body: string;
}): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${title}</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="background-color:#ffffff;padding:40px;">
                    ${body}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color:#fafafa;padding:24px 40px;text-align:center;border-top:1px solid #eee;">
                    <p style="margin:0 0 8px;font-size:13px;color:#999;">This is an automated message from fLexiScribe. Please do not reply to this email.</p>
                    <p style="margin:0;font-size:12px;color:#bbb;">&copy; ${new Date().getFullYear()} fLexiScribe. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Send a verification code email (used for forgot password & change password)
 */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  userName: string,
  purpose: "password-reset" | "password-change"
) {
  const purposeText =
    purpose === "password-reset"
      ? "reset your password"
      : "change your password";

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#333;">Hello <strong>${userName}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      We received a request to ${purposeText} for your fLexiScribe account. 
      Please use the verification code below to proceed:
    </p>
    <div style="text-align:center;margin:32px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%);border:2px solid #8b5cf6;border-radius:12px;padding:20px 40px;">
        <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#6d28d9;font-family:'Courier New',monospace;">${code}</span>
      </div>
    </div>
    <p style="margin:0 0 8px;font-size:14px;color:#555;">
      <strong style="color:#8b5cf6;">⏱ This code will expire in 10 minutes.</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#777;line-height:1.6;">
      If you didn't request this, please ignore this email. Your account remains secure.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">
      Best regards,<br/>
      <strong style="color:#6d28d9;">The fLexiScribe Team</strong>
    </p>
  `;

  const title =
    purpose === "password-reset"
      ? "Password Reset Verification"
      : "Password Change Verification";

  return sendEmail({
    to: email,
    subject: `fLexiScribe — ${title} Code`,
    html: emailTemplate({ title, body }),
  });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string,
  role: string
) {
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#333;">Hello <strong>${userName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
      Welcome to fLexiScribe! Your account has been successfully created as a <strong style="color:#6d28d9;">${role}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      You can now log in and start using the platform.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
      If you have any questions or need assistance, please don't hesitate to contact our support team.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">
      Best regards,<br/>
      <strong style="color:#6d28d9;">The fLexiScribe Team</strong>
    </p>
  `;

  return sendEmail({
    to: email,
    subject: "Welcome to fLexiScribe",
    html: emailTemplate({ title: "Welcome to fLexiScribe!", body }),
  });
}
