import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { sendVerificationCodeEmail } from "@/lib/email";
import bcrypt from "bcrypt";

/**
 * POST /api/educator/change-password
 *
 * Step 1 (action: "send-code"):
 *   Validates current password, sends verification code to educator's email.
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
    if (user.role !== "EDUCATOR") {
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

    // Get educator name for email
    const educator = await prisma.educator.findUnique({
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

      // Invalidate any existing unused codes for this user/purpose
      await prisma.verificationCode.updateMany({
        where: {
          userId: dbUser.id,
          purpose: "password-change",
          used: false,
        },
        data: { used: true },
      });

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Store code in database with 10-minute expiry
      await prisma.verificationCode.create({
        data: {
          userId: dbUser.id,
          code,
          purpose: "password-change",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Store the new password hash temporarily in the User token field
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          token: newPasswordHash,
          tokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Send verification email
      const emailResult = await sendVerificationCodeEmail(
        dbUser.email,
        code,
        educator?.fullName || "Educator",
        "password-change"
      );

      if (!emailResult.success) {
        const errMsg = emailResult.error instanceof Error ? emailResult.error.message : String(emailResult.error);
        console.error("Failed to send verification email:", errMsg);
        return NextResponse.json(
          { error: `Failed to send verification email: ${errMsg}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Verification code sent to ${dbUser.email}`,
      });
    }

    if (action === "verify-and-change") {
      const { verificationCode } = body;

      if (!verificationCode) {
        return NextResponse.json(
          { error: "Verification code is required" },
          { status: 400 }
        );
      }

      // Find matching verification code in database
      const storedCode = await prisma.verificationCode.findFirst({
        where: {
          userId: dbUser.id,
          code: verificationCode,
          purpose: "password-change",
          used: false,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!storedCode) {
        return NextResponse.json(
          { error: "Invalid verification code. Please request a new one." },
          { status: 400 }
        );
      }

      if (storedCode.expiresAt < new Date()) {
        await prisma.verificationCode.update({
          where: { id: storedCode.id },
          data: { used: true },
        });
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      // Retrieve the stored new password hash from the User token field
      const currentUser = await prisma.user.findUnique({
        where: { id: dbUser.id },
        select: { token: true, tokenExpiry: true },
      });

      if (!currentUser?.token || !currentUser.tokenExpiry || currentUser.tokenExpiry < new Date()) {
        return NextResponse.json(
          { error: "Password change session expired. Please start over." },
          { status: 400 }
        );
      }

      // Code is valid — change the password
      await prisma.$transaction([
        prisma.user.update({
          where: { id: dbUser.id },
          data: {
            password: currentUser.token,
            token: null,
            tokenExpiry: null,
          },
        }),
        prisma.verificationCode.update({
          where: { id: storedCode.id },
          data: { used: true },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Password changed successfully!",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Educator change password error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
