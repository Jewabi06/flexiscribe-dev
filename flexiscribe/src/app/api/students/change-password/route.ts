import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import bcrypt from "bcrypt";

// In-memory store for verification codes (in production, use Redis or DB)
// Map<userId, { code: string, expiresAt: number, newPasswordHash: string }>
const verificationCodes = new Map<
  string,
  { code: string; expiresAt: number; currentPassword: string; newPasswordHash: string }
>();

/**
 * POST /api/students/change-password
 *
 * Step 1 (action: "send-code"):
 *   Validates current password, sends verification code to student's email.
 *   Body: { action: "send-code", currentPassword, newPassword }
 *
 * Step 2 (action: "verify-and-change"):
 *   Verifies the code and changes the password.
 *   Body: { action: "verify-and-change", verificationCode }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // Get user with password
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, password: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get student name for email
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: { fullName: true },
    });

    if (action === "send-code") {
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Current password and new password are required" },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
          { status: 400 }
        );
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, dbUser.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      // Check new password is different
      const isSamePassword = await bcrypt.compare(newPassword, dbUser.password);
      if (isSamePassword) {
        return NextResponse.json(
          { error: "New password must be different from current password" },
          { status: 400 }
        );
      }

      // Generate 4-digit verification code
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Store code with 10-minute expiry
      verificationCodes.set(dbUser.id, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        currentPassword,
        newPasswordHash,
      });

      // Send verification email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #8b5cf6; padding: 20px; background: #f0e6ff; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Change Verification</h1>
              </div>
              <div class="content">
                <p>Hello ${student?.fullName || "Student"},</p>
                <p>You requested to change your password on fLexiScribe. Please use the following verification code to confirm:</p>
                <div class="code">${code}</div>
                <p><strong>This code will expire in 10 minutes.</strong></p>
                <p>If you didn't request this change, please ignore this email and ensure your account is secure.</p>
                <p>Best regards,<br>The fLexiScribe Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email, please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const isDev = process.env.NODE_ENV !== "production";

      if (!isDev) {
        // Production: send email, fail if it doesn't work
        const emailResult = await sendEmail({
          to: dbUser.email,
          subject: "fLexiScribe - Password Change Verification Code",
          html: emailHtml,
        });

        if (!emailResult.success) {
          console.error("Failed to send verification email:", emailResult.error);
          return NextResponse.json(
            { error: "Failed to send verification email. Please try again." },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Verification code sent to ${dbUser.email}`,
        });
      } else {
        // Development: skip email, return code directly in response
        console.log(`[DEV] Verification code for ${dbUser.email}: ${code}`);

        // Still attempt email but don't block on failure
        sendEmail({
          to: dbUser.email,
          subject: "fLexiScribe - Password Change Verification Code",
          html: emailHtml,
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          message: `Verification code sent to ${dbUser.email}`,
          devCode: code, // Only included in development
        });
      }
    }

    if (action === "verify-and-change") {
      const { verificationCode } = body;

      if (!verificationCode) {
        return NextResponse.json(
          { error: "Verification code is required" },
          { status: 400 }
        );
      }

      const stored = verificationCodes.get(dbUser.id);

      if (!stored) {
        return NextResponse.json(
          { error: "No verification code found. Please request a new one." },
          { status: 400 }
        );
      }

      if (Date.now() > stored.expiresAt) {
        verificationCodes.delete(dbUser.id);
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      if (verificationCode !== stored.code) {
        return NextResponse.json(
          { error: "Invalid verification code" },
          { status: 400 }
        );
      }

      // Code is valid — change the password
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { password: stored.newPasswordHash },
      });

      // Clean up
      verificationCodes.delete(dbUser.id);

      return NextResponse.json({
        success: true,
        message: "Password changed successfully!",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
