import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fullName,
      departmentId,
      dateOfBirth,
      gender,
      username,
      email,
      password,
    } = body;

    // Validate required fields
    if (
      !fullName ||
      !departmentId ||
      !dateOfBirth ||
      !gender ||
      !username ||
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

    // Check if username already exists
    const existingUserByUsername = await prisma.educator.findUnique({
      where: { username },
    });

    if (existingUserByUsername) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Invalid department" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Convert gender string to enum value
    const genderEnum = gender.toUpperCase().replace(/\s+/g, "_");

    // Create user and educator in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: "EDUCATOR",
        },
      });

      // Create educator profile
      const educator = await tx.educator.create({
        data: {
          username,
          fullName,
          gender: genderEnum as any,
          birthDate: new Date(dateOfBirth),
          departmentId,
          userId: user.id,
        },
      });

      return { user, educator };
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.user.id, email: result.user.email, role: result.user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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

    return NextResponse.json(
      {
        message: "Educator registered successfully",
        educator: {
          id: result.educator.id,
          username: result.educator.username,
          fullName: result.educator.fullName,
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