import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Get unique courses from transcriptions
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

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
    });

    if (!educator) {
      return NextResponse.json(
        { error: "Educator profile not found" },
        { status: 404 }
      );
    }

    const classCourses = await prisma.class.findMany({
      where: { educatorId: educator.id },
      select: { subject: true },
      distinct: ["subject"],
      orderBy: { subject: "asc" },
    });

    const courses = classCourses.map((cls) => cls.subject);

    return NextResponse.json({ courses }, { status: 200 });
  } catch (error) {
    console.error("Get courses error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
