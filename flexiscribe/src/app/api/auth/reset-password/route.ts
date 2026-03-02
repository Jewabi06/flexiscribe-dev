import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, password } = body;

    if (!email || !code || !password) {
      return NextResponse.json(
        { error: "Email, verification code, and new password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or verification code" },
        { status: 400 }
      );
    }

    // Find matching verification code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
        purpose: "password-reset",
        used: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verificationCode) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (verificationCode.expiresAt < new Date()) {
      // Mark as used since it's expired
      await prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { used: true },
      });
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and mark code as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          token: null,
          tokenExpiry: null,
        },
      }),
      prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { used: true },
      }),
    ]);

    // Audit log - password reset
    try {
      await prisma.auditLog.create({
        data: {
          action: "Password Reset",
          details: `${user.email} (${user.role}) reset their password`,
          userRole: user.role as any,
          userName: user.email,
          userId: user.id,
        },
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }

    return NextResponse.json(
      { message: "Password has been reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An error occurred resetting your password" },
      { status: 500 }
    );
  }
}
