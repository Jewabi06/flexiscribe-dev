import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";

/**
 * POST /api/students/change-password
 *
 * Submits a password change request to the admin for approval.
 * Body: { currentPassword, newPassword }
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

    // Get user with password
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, password: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    // Check for existing pending request
    const existingRequest = await prisma.passwordRequest.findFirst({
      where: { userId: dbUser.id, status: "pending" },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending password change request. Please wait for admin approval." },
        { status: 400 }
      );
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Create password request
    await prisma.passwordRequest.create({
      data: {
        userId: dbUser.id,
        type: "change",
        newPasswordHash,
        reason: "Password change request",
      },
    });

    // Get student name
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: { fullName: true },
    });

    // Notify all admins
    const admins = await prisma.admin.findMany({ select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          title: "Password Change Request",
          message: `${student?.fullName || dbUser.email} (Student) has requested a password change.`,
          type: "password-request",
          adminId: admin.id,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Your password change request has been submitted to the admin for approval.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/students/change-password
 * Check status of latest password request
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latestRequest = await prisma.passwordRequest.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, adminNote: true, createdAt: true, type: true },
    });

    return NextResponse.json({
      request: latestRequest || null,
    });
  } catch (error) {
    console.error("Check password request error:", error);
    return NextResponse.json({ request: null }, { status: 200 });
  }
}
