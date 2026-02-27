import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import crypto from "crypto";

function generateClassCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. "A3F1B2"
}

const TIME_FORMAT_REGEX = /^(1[0-2]|[1-9]):([0-5]\d)\s(AM|PM)$/;

function isValidTimeFormat(time: string): boolean {
  return TIME_FORMAT_REGEX.test(time);
}

function timeToMinutes(time: string): number {
  const match = time.match(TIME_FORMAT_REGEX);
  if (!match) return -1;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3];
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// GET /api/admin/classes — List all classes with educator info
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const classes = await prisma.class.findMany({
      include: {
        educator: {
          include: { department: true },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const transformed = classes.map((c) => ({
      id: c.id,
      classCode: c.classCode,
      subject: c.subject,
      section: c.section,
      room: c.room,
      day: c.day,
      startTime: c.startTime,
      endTime: c.endTime,
      educatorId: c.educatorId,
      educatorName: c.educator.fullName,
      department: c.educator.department.name,
      enrolledStudents: c._count.enrollments,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ classes: transformed }, { status: 200 });
  } catch (error) {
    console.error("Get classes error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

// POST /api/admin/classes — Create a class and assign an educator
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, section, room, day, startTime, endTime, educatorId } = body;

    if (!subject || !section || !room || !day || !startTime || !educatorId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate time format
    if (!isValidTimeFormat(startTime)) {
      return NextResponse.json(
        { error: "Invalid start time format. Use format like '7:00 AM'" },
        { status: 400 }
      );
    }

    if (endTime && !isValidTimeFormat(endTime)) {
      return NextResponse.json(
        { error: "Invalid end time format. Use format like '9:00 AM'" },
        { status: 400 }
      );
    }

    if (endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // Verify educator exists
    const educator = await prisma.educator.findUnique({
      where: { id: educatorId },
    });

    if (!educator) {
      return NextResponse.json(
        { error: "Educator not found" },
        { status: 404 }
      );
    }

    const classCode = generateClassCode();

    const newClass = await prisma.class.create({
      data: {
        classCode,
        subject,
        section,
        room,
        day,
        startTime,
        endTime: endTime || null,
        educatorId,
      },
      include: {
        educator: { include: { department: true } },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: "CLASS_CREATED",
        description: `Created class ${subject} - Section ${section} assigned to ${educator.fullName}`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CLASS_CREATED",
        details: `Created class ${subject} - Section ${section}, Room ${room}, ${day} ${startTime}${endTime ? ` - ${endTime}` : ""}, assigned to ${educator.fullName}`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    // Notify the educator about the new class assignment
    try {
      await prisma.notification.create({
        data: {
          title: "New Class Assigned",
          message: `You have been assigned a new class: ${subject} — Section ${section}, ${day} ${startTime}${endTime ? ` - ${endTime}` : ""}.`,
          type: "class_assignment",
          educatorId: educatorId,
        },
      });
    } catch (notifErr) {
      console.error("Failed to create educator notification:", notifErr);
    }

    return NextResponse.json(
      {
        class: {
          ...newClass,
          educatorName: newClass.educator.fullName,
          department: newClass.educator.department.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
