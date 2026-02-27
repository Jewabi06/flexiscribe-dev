import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Get authenticated student's profile data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Unauthorized - Student access only" },
        { status: 403 }
      );
    }

    // Fetch student data with user information
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    // Format the response
    const profile = {
      id: student.id,
      studentNumber: student.studentNumber,
      username: student.username || student.user.email.split('@')[0],
      fullName: student.fullName,
      yearLevel: student.yearLevel,
      section: student.section,
      program: student.program,
      gender: student.gender,
      birthDate: student.birthDate,
      xp: student.xp || 0,
      avatar: student.avatar || null,
      email: student.user.email,
      role: student.user.role,
    };

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Get student profile error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching profile" },
      { status: 500 }
    );
  }
}

/**
 * Update authenticated student's profile data (avatar, XP, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Unauthorized - Student access only" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { avatar, xp } = body;

    // Update student data
    const updatedStudent = await prisma.student.update({
      where: { userId: user.userId },
      data: {
        ...(avatar !== undefined && { avatar }),
        ...(xp !== undefined && { xp }),
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    const profile = {
      id: updatedStudent.id,
      studentNumber: updatedStudent.studentNumber,
      username: updatedStudent.username || updatedStudent.user.email.split('@')[0],
      fullName: updatedStudent.fullName,
      yearLevel: updatedStudent.yearLevel,
      section: updatedStudent.section,
      program: updatedStudent.program,
      gender: updatedStudent.gender,
      birthDate: updatedStudent.birthDate,
      xp: updatedStudent.xp,
      avatar: updatedStudent.avatar,
      email: updatedStudent.user.email,
      role: updatedStudent.user.role,
    };

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Update student profile error:", error);
    return NextResponse.json(
      { error: "An error occurred while updating profile" },
      { status: 500 }
    );
  }
}
