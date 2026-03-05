import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";

/**
 * POST /api/auth/password-request
 * Submit a password reset request (forgot password flow - unauthenticated).
 * The admin will be notified and can approve/deny.
 * Body: { email, newPassword, reason? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword, reason } = body;

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email and new password are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { student: true, educator: true },
    });

    // Always return success even if user doesn't exist (security best practice)
    if (!user) {
      return NextResponse.json(
        { message: "If an account with that email exists, your password reset request has been submitted to the admin for review." },
        { status: 200 }
      );
    }

    // Check for existing pending request
    const existingRequest = await prisma.passwordRequest.findFirst({
      where: { userId: user.id, status: "pending" },
    });

    if (existingRequest) {
      return NextResponse.json(
        { message: "You already have a pending password request. Please wait for the admin to review it." },
        { status: 200 }
      );
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Create password request
    await prisma.passwordRequest.create({
      data: {
        userId: user.id,
        type: "reset",
        newPasswordHash,
        reason: reason || "Forgot password",
      },
    });

    // Get user display name
    let userName = user.email;
    if (user.student) userName = user.student.fullName;
    else if (user.educator) userName = user.educator.fullName;

    // Create notification for all admins
    const admins = await prisma.admin.findMany({ select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          title: "Password Reset Request",
          message: `${userName} (${user.role}) has requested a password reset.`,
          type: "password-request",
          adminId: admin.id,
        })),
      });
    }

    return NextResponse.json(
      { message: "Your password reset request has been submitted. The admin will review and process it shortly." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password request error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/password-request?email=...
 * Check if there's a pending request for this email (for UI status display)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ status: null }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ status: null }, { status: 200 });
    }

    const latestRequest = await prisma.passwordRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, adminNote: true, createdAt: true },
    });

    return NextResponse.json(
      { requestStatus: latestRequest?.status || null, adminNote: latestRequest?.adminNote || null },
      { status: 200 }
    );
  } catch (error) {
    console.error("Check password request error:", error);
    return NextResponse.json({ status: null }, { status: 200 });
  }
}
