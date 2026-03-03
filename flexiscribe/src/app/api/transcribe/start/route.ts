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

    const { courseCode, title, sessionType } = await request.json();

    if (!courseCode) {
      return NextResponse.json({ error: "Course code is required" }, { status: 400 });
    }

    // Validate session type (default to "lecture")
    const validSessionType = ["lecture", "meeting"].includes(sessionType) ? sessionType : "lecture";

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
        title: title || `${courseCode} - ${validSessionType === "meeting" ? "Meeting" : "Lecture"}`,
        session_type: validSessionType,
      }),
    });

    if (!response.ok) {
      let errorMsg = "Failed to start transcription";
      try {
        const error = await response.json();
        errorMsg = error.detail?.message || error.detail || errorMsg;
      } catch {
        const text = await response.text().catch(() => "");
        errorMsg = text.slice(0, 200) || `FastAPI returned status ${response.status}`;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();

    // Create a PENDING transcription record in the database
    const transcription = await prisma.transcription.create({
      data: {
        title: title || `${courseCode} - ${validSessionType === "meeting" ? "Meeting" : "Lecture"} ${new Date().toLocaleDateString()}`,
        course: courseCode,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        duration: "0m 0s",
        content: "",
        status: "PENDING",
        sessionType: validSessionType,
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
    const message = error instanceof Error ? error.message : "An error occurred";
    // Give a clear message if FastAPI is unreachable
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("connect")) {
      return NextResponse.json(
        { error: `Cannot reach transcription backend (${process.env.FASTAPI_URL || "http://localhost:8000"}). Is the FastAPI server running?` },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
