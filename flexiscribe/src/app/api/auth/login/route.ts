import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, role } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, password, and role are required" },
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
        educator: {
          include: {
            department: true,
          },
        },
        student: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify role matches
    if (user.role !== role) {
      return NextResponse.json(
        { error: "Invalid credentials for this role" },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Prepare response based on role
    let userData: any = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    if (user.role === "EDUCATOR" && user.educator) {
      userData.educator = {
        id: user.educator.id,
        username: user.educator.username,
        fullName: user.educator.fullName,
        gender: user.educator.gender,
        department: {
          id: user.educator.department.id,
          name: user.educator.department.name,
        },
      };
    } else if (user.role === "STUDENT" && user.student) {
      userData.student = {
        id: user.student.id,
        studentNumber: user.student.studentNumber,
        fullName: user.student.fullName,
        yearLevel: user.student.yearLevel,
        section: user.student.section,
        program: user.student.program,
        gender: user.student.gender,
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Calculate token expiry (7 days from now)
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7);

    // Update user with token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        token,
        tokenExpiry,
      },
    });

    // Create response
    const response = NextResponse.json(
      {
        message: "Login successful",
        user: userData,
        token,
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie on the response
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
