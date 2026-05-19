import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export const maxDuration = 60;

/**
 * POST /api/transcribe/stop
 * Stop a running transcription session.
 * FastAPI now returns final summary synchronously.
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // Longer timeout for summary generation

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

    // Build content string from transcript chunks
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

    if (transcriptionId) {
      const updatedTranscription = await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          content: contentHtml,
          rawText: rawText,
          duration: data.duration || "0m 0s",
          status: "COMPLETED",                               // ✅ immediately completed
          transcriptJson: data.transcript || null,
          summaryJson: data.minute_summaries || null,
          finalSummaryJson: data.final_summary || null,      // ✅ store final summary
        },
        include: {
          class: {
            select: { id: true, subject: true, section: true },
          },
        },
      });

      // ─── Create Lesson (reviewer) from Cornell Notes ────────────────
      if (data.final_summary && data.final_summary.title) {
        try {
          const summaryObj = data.final_summary;
          const keyConcepts = summaryObj.key_concepts || [];
          const notes = summaryObj.notes || [];
          const summary = summaryObj.summary || "";

          const reviewerContent = JSON.stringify({
            type: "cornell",
            title: summaryObj.title || updatedTranscription.title,
            summary,
            keyConcepts: Array.isArray(notes)
              ? notes.map(
                  (n: { term?: string; definition?: string; example?: string } | string, i: number) => {
                    if (typeof n === "object" && n.term) {
                      return { term: n.term, definition: n.definition || "", ...(n.example ? { example: n.example } : {}) };
                    }
                    return {
                      term: keyConcepts[i] || `Concept ${i + 1}`,
                      definition: typeof n === "string" ? n : "",
                    };
                  }
                )
              : [],
            importantFacts: Array.isArray(notes)
              ? notes.map((n: { term?: string; definition?: string; example?: string } | string) =>
                  typeof n === "object"
                    ? n.example
                      ? `${n.term}: ${n.definition} (Example: ${n.example})`
                      : `${n.term}: ${n.definition}`
                    : n
                )
              : [],
            detailedContent: `${keyConcepts.join("\n")}\n\n${
              Array.isArray(notes)
                ? notes
                    .map((n: { term?: string; definition?: string; example?: string } | string) =>
                      typeof n === "object"
                        ? n.example
                          ? `${n.term}: ${n.definition}. Example: ${n.example}`
                          : `${n.term}: ${n.definition}`
                        : n
                    )
                    .join("\n")
                : ""
            }\n\n${Array.isArray(summary) ? summary.join("\n") : summary}`,
          });

          if (reviewerContent.length >= 200) {
            await prisma.lesson.create({
              data: {
                title: updatedTranscription.title,
                subject: updatedTranscription.course,
                content: reviewerContent,
              },
            });
            console.log(`[STOP] Auto-created reviewer for transcription ${transcriptionId}`);
          }
        } catch (lessonErr) {
          console.error("[STOP] Failed to auto-create reviewer:", lessonErr);
        }
      }

      // ─── Notifications ─────────────────────────────────────────────
      // Notify educator that everything is ready
      try {
        const eduClassSubject = updatedTranscription.class?.subject || updatedTranscription.course;
        const eduClassSection = updatedTranscription.class?.section || "";
        let eduNotifMessage = `Your transcription "${updatedTranscription.title}" is complete. Summary and reviewer are ready.`;
        if (eduClassSection) {
          eduNotifMessage += ` (${eduClassSubject} — Section ${eduClassSection})`;
        }
        await prisma.notification.create({
          data: {
            title: "Transcription Complete",
            message: eduNotifMessage,
            type: "transcript_summary",
            educatorId: updatedTranscription.educatorId,
          },
        });
      } catch (eduNotifErr) {
        console.error("Failed to create educator notification:", eduNotifErr);
      }

      // Notify enrolled students
      if (updatedTranscription.classId) {
        try {
          const enrollments = await prisma.studentClass.findMany({
            where: { classId: updatedTranscription.classId },
            select: { studentId: true },
          });

          if (enrollments.length > 0) {
            const classSubject = updatedTranscription.class?.subject || updatedTranscription.course;
            const classSection = updatedTranscription.class?.section || "";
            const educator = await prisma.educator.findUnique({
              where: { id: updatedTranscription.educatorId },
              select: { fullName: true },
            });
            const educatorDisplayName = educator?.fullName || "Your professor";

            let notifMessage = `${educatorDisplayName} uploaded a new transcript and summary "${updatedTranscription.title}"`;
            if (classSection) {
              notifMessage += ` for ${classSubject} — Section ${classSection}.`;
            } else {
              notifMessage += ` for ${classSubject}.`;
            }

            await prisma.notification.createMany({
              data: enrollments.map((e) => ({
                title: "New Transcript & Summary Available",
                message: notifMessage,
                type: "transcript_summary",
                studentId: e.studentId,
              })),
            });
          }
        } catch (notifError) {
          console.error("Failed to create student notifications:", notifError);
        }
      }
    }

    // Tell FastAPI to mark files for deletion
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
        status: "COMPLETED",
        duration: data.duration,
        chunks_count: chunks.length,
        has_summary: true,
        summary_pending: false,
        final_summary: data.final_summary,
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