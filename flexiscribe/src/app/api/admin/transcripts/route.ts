import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/transcripts — List all transcriptions with class info
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transcriptions = await prisma.transcription.findMany({
      include: {
        class: {
          select: { section: true, subject: true },
        },
        educator: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = transcriptions.map((t) => ({
      id: t.id,
      course: t.course,
      title: t.title,
      date: t.date,
      duration: t.duration,
      section: t.class?.section || "—",
      content: t.content,
      rawText: t.rawText || "",
      educatorName: t.educator?.fullName ?? "Unknown",
      status: t.status,
      createdAt: t.createdAt,
    }));

    // Extract unique courses and sections for filter dropdowns
    const courses = [...new Set(formatted.map((t) => t.course))].sort();
    const sections = [
      ...new Set(formatted.map((t) => t.section).filter((s) => s !== "—")),
    ].sort();

    return NextResponse.json({ transcripts: formatted, courses, sections });
  } catch (error) {
    console.error("Error fetching transcripts:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    );
  }
}
