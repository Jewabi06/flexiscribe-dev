import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Get student leaderboard
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

    if (user.role !== "EDUCATOR") {
      return NextResponse.json(
        { error: "Unauthorized. Educator access only." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");

    // Resolve the educator record for the current user
    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!educator) {
      return NextResponse.json({ error: "Educator profile not found" }, { status: 404 });
    }

    // Get all class IDs belonging to this educator
    const educatorClasses = await prisma.class.findMany({
      where: { educatorId: educator.id },
      select: { id: true },
    });

    const classIds = educatorClasses.map((c) => c.id);

    // Only return students who are enrolled in one of this educator's classes
    const students = await prisma.student.findMany({
      where: classIds.length > 0
        ? { classes: { some: { classId: { in: classIds } } } }
        : { id: "__none__" },
      orderBy: { xp: "desc" },
      ...(limit && { take: parseInt(limit) }),
      select: {
        id: true,
        fullName: true,
        username: true,
        xp: true,
        avatar: true,
        section: true,
        yearLevel: true,
      },
    });

    return NextResponse.json({ students }, { status: 200 });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
