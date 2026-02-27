import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/students/streak — Get current streak data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: { streakCount: true, lastActivityDate: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const today = new Date().toISOString().split("T")[0];
    let count = student.streakCount;
    let isActive = false;

    if (student.lastActivityDate) {
      const lastDate = new Date(student.lastActivityDate);
      const currentDate = new Date(today);
      const daysDiff = Math.floor(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        isActive = true;
      } else if (daysDiff === 1) {
        isActive = false;
      } else {
        // Streak broken
        count = 0;
      }
    }

    return NextResponse.json({
      streak: {
        count,
        isActive,
        lastActivityDate: student.lastActivityDate,
      },
    });
  } catch (error) {
    console.error("Error fetching streak:", error);
    return NextResponse.json(
      { error: "Failed to fetch streak" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students/streak — Record activity and update streak
 * Body: { activityType: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityType } = body;

    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      select: { id: true, streakCount: true, lastActivityDate: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const today = new Date().toISOString().split("T")[0];
    let newCount = student.streakCount;
    let isActive = false;

    if (student.lastActivityDate === today) {
      // Already active today — keep count, mark active
      newCount = student.streakCount;
      isActive = true;
    } else if (student.lastActivityDate) {
      const lastDate = new Date(student.lastActivityDate);
      const currentDate = new Date(today);
      const daysDiff = Math.floor(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        // Consecutive day — increment
        newCount = student.streakCount + 1;
        isActive = true;
      } else if (daysDiff > 1) {
        // Streak broken — restart
        newCount = 1;
        isActive = true;
      }
    } else {
      // First activity ever
      newCount = 1;
      isActive = true;
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        streakCount: newCount,
        lastActivityDate: today,
      },
    });

    return NextResponse.json({
      streak: {
        count: newCount,
        isActive,
        lastActivityDate: today,
      },
    });
  } catch (error) {
    console.error("Error updating streak:", error);
    return NextResponse.json(
      { error: "Failed to update streak" },
      { status: 500 }
    );
  }
}
