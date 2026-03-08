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
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : NaN;

    // Resolve the educator record for the current user
    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!educator) {
      return NextResponse.json({ error: "Educator profile not found" }, { status: 404 });
    }

    // Single query: students enrolled in any of this educator's classes, non-ghost only
    const students = await prisma.student.findMany({
      where: {
        user: { isGhost: false },
        classes: { some: { class: { educatorId: educator.id } } },
      },
      orderBy: { xp: "desc" },
      ...(!isNaN(limit) && limit > 0 ? { take: limit } : {}),
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
