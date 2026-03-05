import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// The stop endpoint now returns quickly (transcript + minute summaries).
// The final Cornell summary is generated asynchronously by FastAPI and
// delivered via a separate callback endpoint.
export const maxDuration = 60;

/**
 * POST /api/transcribe/stop
 * Stop a running transcription session.
 * Receives final transcript + summary JSON from FastAPI, saves to database.
 * Marks local files for deletion.
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

    const { sessionId, transcriptionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Call FastAPI backend to stop transcription
    // 60s timeout: Whisper finishes current chunk + remaining buffer,
    // then summarizer processes remaining text into minute summaries.
    // Final Cornell summary is generated asynchronously via callback.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(`${FASTAPI_URL}/transcribe/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        transcription_id: transcriptionId || null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let errorMsg = "Failed to stop transcription";
      try {
        const error = await response.json();
        errorMsg = error.detail || errorMsg;
      } catch {
        const text = await response.text().catch(() => "");
        errorMsg = text.slice(0, 200) || `FastAPI returned status ${response.status}`;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();

    // Build content string from transcript chunks for backward compatibility
    const chunks = data.transcript?.chunks || [];
    const contentHtml = chunks
      .map(
        (c: { minute: number; timestamp: string; text: string }) =>
          `<p><strong>[${c.timestamp}]</strong> ${c.text}</p>`
      )
      .join("\n");

    const rawText = chunks
      .map((c: { text: string }) => c.text)
      .join("\n");

    // Save transcript + minute summaries immediately.
    // The final Cornell summary will arrive asynchronously via the
    // /api/transcribe/summary/callback endpoint — at that point the
    // Lesson (reviewer) is created and students are notified.
    if (transcriptionId) {
      const updatedTranscription = await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          content: contentHtml,
          rawText: rawText,
          duration: data.duration || "0m 0s",
          status: data.summary_pending ? "SUMMARIZING" : "COMPLETED",
          transcriptJson: data.transcript || null,
          summaryJson: data.minute_summaries || null,
        },
        include: {
          class: {
            select: { id: true, subject: true, section: true },
          },
        },
      });

      // ── Lesson creation + full notifications happen later ──
      // The final Cornell summary is generated asynchronously by FastAPI.
      // When ready, it calls /api/transcribe/summary/callback which:
      //   1. Updates this transcription with summaryJson
      //   2. Creates the Lesson (reviewer)
      //   3. Notifies enrolled students and the educator

      // Send a lightweight "transcript saved" notification to the educator
      try {
        const eduClassSubject = updatedTranscription.class?.subject || updatedTranscription.course;
        const eduClassSection = updatedTranscription.class?.section || "";
        let eduNotifMessage = `Your live transcription "${updatedTranscription.title}" has been saved`;
        if (eduClassSection) {
          eduNotifMessage += ` for ${eduClassSubject} — Section ${eduClassSection}. Summary is being generated...`;
        } else {
          eduNotifMessage += `. Summary is being generated...`;
        }
        await prisma.notification.create({
          data: {
            title: "Transcription Saved",
            message: eduNotifMessage,
            type: "transcript",
            educatorId: updatedTranscription.educatorId,
          },
        });
      } catch (eduNotifErr) {
        console.error("Failed to create educator notification:", eduNotifErr);
      }
    }

    // Tell FastAPI to mark files for deletion since we saved to DB
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
        message: "Transcription saved successfully",
        session_id: sessionId,
        transcription_id: transcriptionId,
        status: data.summary_pending ? "SUMMARIZING" : "COMPLETED",
        duration: data.duration,
        chunks_count: chunks.length,
        has_summary: false,
        summary_pending: !!data.summary_pending,
        lesson_created: false,
        lesson_id: null,
        transcript: data.transcript,
        live_transcript: data.live_transcript || null,
        minute_summaries: data.minute_summaries || null,
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
