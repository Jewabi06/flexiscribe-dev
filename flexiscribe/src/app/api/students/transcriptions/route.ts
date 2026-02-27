import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/students/transcriptions?course=CPP117
 * Fetch transcriptions available to the student based on their enrolled classes.
 * Students can view COMPLETED transcriptions for courses they are linked to.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Unauthorized. Student access only." },
        { status: 403 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const course = searchParams.get("course");
    const classCode = searchParams.get("classCode");

    // Get student's enrolled class IDs
    const enrollments = await prisma.studentClass.findMany({
      where: { studentId: student.id },
      select: { classId: true },
    });
    const enrolledClassIds = enrollments.map((e) => e.classId);

    // Resolve classId filter from classCode if provided
    let classIdFilter: string | undefined;
    if (classCode) {
      const cls = await prisma.class.findUnique({
        where: { classCode },
        select: { id: true },
      });
      if (cls && enrolledClassIds.includes(cls.id)) {
        classIdFilter = cls.id;
      } else {
        return NextResponse.json(
          { transcriptions: [], courses: [] },
          { status: 200 }
        );
      }
    }

    // Fetch completed transcriptions only for student's enrolled classes
    const transcriptions = await prisma.transcription.findMany({
      where: {
        status: "COMPLETED",
        classId: classIdFilter
          ? classIdFilter
          : { in: enrolledClassIds.length > 0 ? enrolledClassIds : ["__none__"] },
        ...(course && { course }),
      },
      select: {
        id: true,
        title: true,
        course: true,
        date: true,
        duration: true,
        content: true,
        transcriptJson: true,
        summaryJson: true,
        status: true,
        createdAt: true,
        educator: {
          select: {
            fullName: true,
          },
        },
        class: {
          select: {
            id: true,
            classCode: true,
            subject: true,
            section: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get unique courses for tab navigation
    const courses = [...new Set(transcriptions.map((t) => t.course))];

    return NextResponse.json(
      { transcriptions, courses },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get student transcriptions error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
