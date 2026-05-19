import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "EDUCATOR") {
      return NextResponse.json({ error: "Educator access only" }, { status: 403 });
    }

    let body: { sessionId?: string; transcriptionId?: string } = {};
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { sessionId, transcriptionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 270_000); // 4.5 minutes

    const response = await fetch(`${FASTAPI_URL}/transcribe/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        transcription_id: transcriptionId || null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawResponse = await response.text().catch(() => "");
    let data: any = null;
    try {
      data = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      let errorMsg = "Failed to stop transcription";
      if (data?.error) {
        errorMsg = data.error;
      } else if (data?.detail) {
        errorMsg = data.detail;
      } else if (rawResponse) {
        errorMsg = rawResponse.slice(0, 200);
      } else {
        errorMsg = `FastAPI returned status ${response.status}`;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    if (!data) {
      return NextResponse.json(
        {
          error: `Transcription backend returned invalid JSON: ${rawResponse.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    const duration = typeof data.duration === "string" ? data.duration : "0m 0s";
    const transcript = data.transcript && typeof data.transcript === "object" ? data.transcript : {};
    const liveTranscript = data.live_transcript && typeof data.live_transcript === "object" ? data.live_transcript : null;
    const minuteSummaries = Array.isArray(data.minute_summaries) ? data.minute_summaries : null;

    // Build content HTML from transcript chunks
    const chunks = Array.isArray(transcript.chunks) ? transcript.chunks : [];
    const contentHtml = chunks
      .map(
        (c: { minute: number; timestamp: string; text: string }) =>
          `<p><strong>[${c.timestamp}]</strong> ${c.text}</p>`
      )
      .join("\n");

    const rawText = chunks.map((c: { text: string }) => c.text).join("\n");

    // Always update transcription with transcript and minute summaries
    if (transcriptionId) {
      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          content: contentHtml,
          rawText: rawText,
          duration: duration,
          status: "PROCESSING",     // waiting for final summary callback
          transcriptJson: transcript,
          // summaryJson will be updated later via callback
        },
      });
    }

    // Tell FastAPI to mark files for deletion (transcript files are no longer needed)
    try {
      await fetch(`${FASTAPI_URL}/transcribe/upload-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          file_type: "all",
        }),
      });
    } catch (cleanupErr) {
      console.warn("File cleanup notification failed:", cleanupErr);
    }

    return NextResponse.json(
      {
        message: data.summary_pending
          ? "Transcript saved. Final summary will arrive via callback."
          : "Transcription saved successfully",
        session_id: sessionId,
        transcription_id: transcriptionId,
        status: "PROCESSING",
        duration,
        chunks_count: chunks.length,
        summary_pending: Boolean(data.summary_pending),
        transcript,
        live_transcript: liveTranscript,
        minute_summaries: minuteSummaries,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stop transcription error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("connect")) {
      return NextResponse.json(
        { error: `Cannot reach transcription backend (${process.env.FASTAPI_URL || "http://localhost:8000"}). Is the FastAPI server running?` },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}