import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/educator/classes/[classId]/students
 * Return enrolled students for a specific class belonging to the authenticated educator.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
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

    // Verify class belongs to this educator
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { educatorId: true },
    });

    if (!cls) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      );
    }

    if (cls.educatorId !== educator.id) {
      return NextResponse.json(
        { error: "Access denied. This class does not belong to you." },
        { status: 403 }
      );
    }

    // Fetch enrolled students via StudentClass join table
    const enrollments = await prisma.studentClass.findMany({
      where: { classId },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            fullName: true,
            username: true,
            yearLevel: true,
            section: true,
            program: true,
            xp: true,
            avatar: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const students = enrollments.map((e) => ({
      id: e.student.id,
      name: e.student.fullName,
      studentNo: e.student.studentNumber,
      username: e.student.username,
      yearLevel: e.student.yearLevel,
      section: e.student.section,
      program: e.student.program,
      xp: e.student.xp,
      avatar: e.student.avatar,
      joinedAt: e.joinedAt,
      status: "Active",
    }));

    return NextResponse.json({ students }, { status: 200 });
  } catch (error) {
    console.error("Get class students error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
