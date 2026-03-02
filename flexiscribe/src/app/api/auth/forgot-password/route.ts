import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendVerificationCodeEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        student: true,
        educator: true,
      },
    });

    // Always return success even if user doesn't exist (security best practice)
    if (!user) {
      return NextResponse.json(
        {
          message:
            "If an account with that email exists, a verification code has been sent.",
        },
        { status: 200 }
      );
    }

    // Invalidate any existing unused codes for this user/purpose
    await prisma.verificationCode.updateMany({
      where: {
        userId: user.id,
        purpose: "password-reset",
        used: false,
      },
      data: { used: true },
    });

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save code to database
    await prisma.verificationCode.create({
      data: {
        userId: user.id,
        code,
        purpose: "password-reset",
        expiresAt,
      },
    });

    // Get user name based on role
    let userName = user.email;
    if (user.student) {
      userName = user.student.fullName;
    } else if (user.educator) {
      userName = user.educator.fullName;
    }

    // Send verification code email
    const emailResult = await sendVerificationCodeEmail(
      user.email,
      code,
      userName,
      "password-reset"
    );

    if (!emailResult.success) {
      console.error("Failed to send email:", emailResult.error);
      // Don't reveal email failure to user (security)
    }

    return NextResponse.json(
      {
        message:
          "If an account with that email exists, a verification code has been sent.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred processing your request" },
      { status: 500 }
    );
  }
}
