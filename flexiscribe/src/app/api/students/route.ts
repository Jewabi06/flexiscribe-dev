import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { generateToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fullName,
      firstName,
      lastName,
      suffix,
      studentNumber,
      username,
      yearLevel,
      section,
      program,
      dateOfBirth,
      gender,
      email,
      password,
    } = body;

    // Validate required fields
    if (
      !fullName ||
      !firstName ||
      !lastName ||
      !studentNumber ||
      !username ||
      !yearLevel ||
      !section ||
      !program ||
      !dateOfBirth ||
      !gender ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        { error: "All fields are required" },
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

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Validate student number format
    if (studentNumber.length < 7) {
      return NextResponse.json(
        { error: "Invalid student number format" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Check if student number already exists
    const existingStudentByNumber = await prisma.student.findUnique({
      where: { studentNumber },
    });

    if (existingStudentByNumber) {
      return NextResponse.json(
        { error: "Student number already registered" },
        { status: 409 }
      );
    }

    // Check if username already exists
    const existingStudentByUsername = await prisma.student.findUnique({
      where: { username },
    });

    if (existingStudentByUsername) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Convert gender string to enum value
    const genderEnum = gender.toUpperCase().replace(/\s+/g, "_");

    // Assign a random default avatar
    const DEFAULT_AVATARS = [
      "/img/cat-pfp.png",
      "/img/bookworm-pfp.png",
      "/img/bee-pfp.png",
      "/img/beaver-pfp.png",
      "/img/bird-pfp.png",
      "/img/owl-pfp.png",
    ];
    const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

    // Create user and student in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: "STUDENT",
        },
      });

      // Create student profile
      const student = await tx.student.create({
        data: {
          studentNumber,
          username,
          fullName,
          firstName,
          lastName,
          suffix: suffix || null,
          yearLevel,
          section,
          program,
          gender: genderEnum as any,
          birthDate: new Date(dateOfBirth),
          avatar: randomAvatar,
          userId: user.id,
        },
      });

      return { user, student };
    });

    // Generate JWT token using shared auth lib (jose)
    const token = await generateToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role as "ADMIN" | "STUDENT" | "EDUCATOR",
    });

    // Calculate token expiry (7 days from now)
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7);

    // Update user with token
    await prisma.user.update({
      where: { id: result.user.id },
      data: {
        token,
        tokenExpiry,
      },
    });

    // Audit log - student registration
    try {
      await prisma.auditLog.create({
        data: {
          action: "Student Registration",
          details: `${fullName} (${email}) registered as a student`,
          userRole: "STUDENT",
          userName: fullName,
          userId: result.user.id,
        },
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }

    return NextResponse.json(
      {
        message: "Student registered successfully",
        student: {
          id: result.student.id,
          studentNumber: result.student.studentNumber,
          username: result.student.username,
          fullName: result.student.fullName,
          email: result.user.email,
        },
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
