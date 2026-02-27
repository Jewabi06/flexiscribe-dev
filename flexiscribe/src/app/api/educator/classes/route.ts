import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import crypto from "crypto";

function generateClassCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
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

/**
 * Get educator's classes
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

    const classes = await prisma.class.findMany({
      where: { educatorId: educator.id },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ classes }, { status: 200 });
  } catch (error) {
    console.error("Get educator classes error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Create a new class
 */
export async function POST(request: NextRequest) {
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

    const { subject, section, room, day, startTime, endTime, students } =
      await request.json();

    // Validate time format
    if (startTime && !isValidTimeFormat(startTime)) {
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

    if (startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
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
        endTime,
        students: students || 0,
        educatorId: educator.id,
      },
    });

    return NextResponse.json({ class: newClass }, { status: 201 });
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
