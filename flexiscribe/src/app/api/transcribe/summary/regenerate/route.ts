import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const allowNoAuth = process.env.NODE_ENV !== "production" || process.env.FORCE_BYPASS_AUTH === "true";
    if (!user && !allowNoAuth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user && user.role !== "EDUCATOR") {
      return NextResponse.json({ error: "Educator access only" }, { status: 403 });
    }

    const { transcriptionId } = await request.json();
    if (!transcriptionId) {
      return NextResponse.json({ error: "transcriptionId is required" }, { status: 400 });
    }

    const transcription = await prisma.transcription.findUnique({
      where: { id: transcriptionId },
      select: { transcriptJson: true, summaryJson: true, sessionType: true, course: true },
    });

    if (!transcription) {
      return NextResponse.json({ error: "Transcription not found" }, { status: 404 });
    }

    if (!transcription.transcriptJson) {
      return NextResponse.json({ error: "No transcriptJson available" }, { status: 400 });
    }   

    let minuteSummaries: any = null;
    if (Array.isArray(transcription.summaryJson)) {
      minuteSummaries = transcription.summaryJson;
    }

    const resp = await fetch(`${FASTAPI_URL}/transcribe/summary/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcription_id: transcriptionId,
        transcript_json: transcription.transcriptJson,
        minute_summaries: minuteSummaries,
        session_type: transcription.sessionType || "lecture",
        course_code: transcription.course || "",
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json({ error: `Failed to regenerate summary: ${errorText}` }, { status: resp.status });
    }

    const data = await resp.json();
    if (!data?.final_summary) {
      return NextResponse.json({ error: "Regenerated summary is missing" }, { status: 500 });
    }

    const updated = await prisma.transcription.update({
      where: { id: transcriptionId },
      data: {
        summaryJson: data.final_summary,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      message: "Summary regenerated successfully",
      transcription_id: transcriptionId,
      summaryJson: updated.summaryJson,
    });
  } catch (error) {
    console.error("Regenerate summary error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
