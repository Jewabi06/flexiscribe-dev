import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// GET /api/students/classes — Get student's enrolled classes
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const enrollments = await prisma.studentClass.findMany({
      where: { studentId: student.id },
      include: {
        class: {
          include: {
            educator: {
              include: { department: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const classes = enrollments.map((e) => ({
      id: e.class.id,
      classCode: e.class.classCode,
      subject: e.class.subject,
      section: e.class.section,
      room: e.class.room,
      day: e.class.day,
      startTime: e.class.startTime,
      endTime: e.class.endTime,
      educatorName: e.class.educator.fullName,
      department: e.class.educator.department.name,
      joinedAt: e.joinedAt,
    }));

    return NextResponse.json({ classes }, { status: 200 });
  } catch (error) {
    console.error("Get student classes error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

// POST /api/students/classes — Join a class by class code
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const body = await request.json();
    const { classCode } = body;

    if (!classCode) {
      return NextResponse.json(
        { error: "Class code is required" },
        { status: 400 }
      );
    }

    // Find class by code
    const classToJoin = await prisma.class.findUnique({
      where: { classCode: classCode.toUpperCase() },
      include: {
        educator: { include: { department: true } },
      },
    });

    if (!classToJoin) {
      return NextResponse.json(
        { error: "Invalid class code. Please check and try again." },
        { status: 404 }
      );
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.studentClass.findUnique({
      where: {
        studentId_classId: {
          studentId: student.id,
          classId: classToJoin.id,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "You are already enrolled in this class" },
        { status: 409 }
      );
    }

    // Enroll student
    await prisma.studentClass.create({
      data: {
        studentId: student.id,
        classId: classToJoin.id,
      },
    });

    // Update student count on the class
    await prisma.class.update({
      where: { id: classToJoin.id },
      data: { students: { increment: 1 } },
    });

    return NextResponse.json(
      {
        message: "Successfully joined class",
        class: {
          id: classToJoin.id,
          subject: classToJoin.subject,
          section: classToJoin.section,
          room: classToJoin.room,
          day: classToJoin.day,
          startTime: classToJoin.startTime,
          educatorName: classToJoin.educator.fullName,
          department: classToJoin.educator.department.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Join class error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
