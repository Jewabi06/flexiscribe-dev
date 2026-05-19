import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: { sessionId: string } | Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "EDUCATOR") {
      return NextResponse.json({ error: "Educator access only" }, { status: 403 });
    }

    const params = await context.params;
    const { sessionId } = params;
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const transcription = await prisma.transcription.findFirst({
      where: { sessionId },
      select: {
        id: true,
        sessionId: true,
        status: true,
        summaryJson: true,
      },
    });

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found for session", status: "not_found" },
        { status: 404 }
      );
    }

    if (transcription.status === "ERROR") {
      return NextResponse.json({ status: "error", error: "Summary generation failed." });
    }

    if (transcription.summaryJson) {
      return NextResponse.json({
        status: "ready",
        final_summary: transcription.summaryJson,
        transcription_id: transcription.id,
        session_id: transcription.sessionId,
      });
    }

    return NextResponse.json({
      status: "pending",
      message: "Final summary is still being generated.",
      transcription_id: transcription.id,
      session_id: transcription.sessionId,
    });
  } catch (error) {
    console.error("Summary status error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
