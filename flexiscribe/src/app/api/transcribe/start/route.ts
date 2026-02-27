import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

/**
 * POST /api/transcribe/start
 * Start a live transcription session via FastAPI backend.
 * Requires educator auth + valid class with students.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "EDUCATOR") {
      return NextResponse.json({ error: "Educator access only" }, { status: 403 });
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
    });
    if (!educator) {
      return NextResponse.json({ error: "Educator profile not found" }, { status: 404 });
    }

    const { courseCode, title } = await request.json();

    if (!courseCode) {
      return NextResponse.json({ error: "Course code is required" }, { status: 400 });
    }

    // Verify the educator has this class with students
    const classRecord = await prisma.class.findFirst({
      where: {
        educatorId: educator.id,
        subject: courseCode,
        students: { gt: 0 },
      },
    });

    if (!classRecord) {
      return NextResponse.json(
        {
          error: "No class found with this course code and enrolled students. Please ensure the admin has added the class and students have joined.",
        },
        { status: 400 }
      );
    }

    // Call FastAPI backend to start transcription
    const response = await fetch(`${FASTAPI_URL}/transcribe/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_code: courseCode,
        educator_id: educator.id,
        title: title || `${courseCode} - Lecture`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail?.message || error.detail || "Failed to start transcription" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Create a PENDING transcription record in the database
    const transcription = await prisma.transcription.create({
      data: {
        title: title || `${courseCode} - Lecture ${new Date().toLocaleDateString()}`,
        course: courseCode,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        duration: "0m 0s",
        content: "",
        status: "PENDING",
        sessionId: data.session_id,
        classId: classRecord.id,
        educatorId: educator.id,
      },
    });

    return NextResponse.json(
      {
        ...data,
        transcription_id: transcription.id,
        class_id: classRecord.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Start transcription error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
