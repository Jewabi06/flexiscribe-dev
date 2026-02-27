import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/students/transcriptions/[id]
 * Fetch a single transcription by ID, only if the student is enrolled in its class.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get student's enrolled class IDs
    const enrollments = await prisma.studentClass.findMany({
      where: { studentId: student.id },
      select: { classId: true },
    });
    const enrolledClassIds = enrollments.map((e) => e.classId);

    // Fetch the transcription
    const transcription = await prisma.transcription.findUnique({
      where: { id },
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
    });

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 }
      );
    }

    // Verify the student is enrolled in this transcription's class
    if (!enrolledClassIds.includes(transcription.class?.id ?? "")) {
      return NextResponse.json(
        { error: "Access denied. Not enrolled in this class." },
        { status: 403 }
      );
    }

    return NextResponse.json({ transcription }, { status: 200 });
  } catch (error) {
    console.error("Get student transcription error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
