import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Allow up to 3 minutes for stop — FastAPI must wait for Whisper to finish
// the current chunk, process remaining audio, summarise final text, and
// generate the Cornell summary (all on Jetson Orin Nano).
export const maxDuration = 180;

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
    // 3-minute timeout: Whisper finishes current chunk + remaining buffer,
    // then summarizer processes remaining text + Cornell summary on CPU.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    const response = await fetch(`${FASTAPI_URL}/transcribe/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
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

    // Track auto-created lesson for response
    let createdLesson: { id: string; title: string } | null = null;

    // Update the transcription record in the database with JSON data
    if (transcriptionId) {
      const updatedTranscription = await prisma.transcription.update({
        where: { id: transcriptionId },
        data: {
          content: contentHtml,
          rawText: rawText,
          duration: data.duration || "0m 0s",
          status: "COMPLETED",
          transcriptJson: data.transcript || null,
          summaryJson: data.final_summary || null,
        },
        include: {
          class: {
            select: { id: true, subject: true, section: true },
          },
        },
      });

      // ── Auto-create a Reviewer (Lesson record) from the completed summary ──
      // Only for LECTURES — the reviewer (Cornell Notes) feeds into Quiz generation.
      // MOTM (meeting minutes) are excluded from the quiz pipeline.
      const sType = updatedTranscription.sessionType || "lecture";
      if (data.final_summary && sType === "lecture") {
        try {
          const summaryObj = data.final_summary;
          const cueQuestions = summaryObj.cue_questions || [];
          const notes = summaryObj.notes || [];
          const summary = summaryObj.summary || "";
          const reviewerContent = JSON.stringify({
            type: "cornell",
            title: summaryObj.title || updatedTranscription.title,
            summary,
            keyConcepts: cueQuestions.map((q: string, i: number) => ({
              term: q,
              definition: notes[i] || "",
            })),
            importantFacts: notes,
            detailedContent: `${cueQuestions.join("\n")}\n\n${notes.join("\n")}\n\n${summary}`,
          });

          // Only create if we have enough content for quiz generation (≥200 chars)
          if (reviewerContent.length >= 200) {
            createdLesson = await prisma.lesson.create({
              data: {
                title: updatedTranscription.title,
                subject: updatedTranscription.course,
                content: reviewerContent,
              },
            });
            console.log(`Auto-created reviewer "${createdLesson.title}" (${createdLesson.id}) from transcription`);
          }
        } catch (lessonErr) {
          console.error("Failed to auto-create reviewer from transcription:", lessonErr);
        }
      }

      // Notify enrolled students about the new transcript/summary
      if (updatedTranscription.classId) {
        try {
          const enrollments = await prisma.studentClass.findMany({
            where: { classId: updatedTranscription.classId },
            select: { studentId: true },
          });

          if (enrollments.length > 0) {
            const hasSummary = !!data.final_summary;
            const classSubject = updatedTranscription.class?.subject || updatedTranscription.course;
            const classSection = updatedTranscription.class?.section || "";

            // Fetch educator name with prefix for notification
            const educator = await prisma.educator.findUnique({
              where: { id: updatedTranscription.educatorId },
              select: { fullName: true },
            });
            const educatorDisplayName = educator?.fullName || "Your professor";

            let notifTitle = "New Transcript Available";
            let notifMessage = `${educatorDisplayName} uploaded a new transcript "${updatedTranscription.title}"`;
            let notifType = "transcript";

            if (hasSummary) {
              notifTitle = "New Transcript & Summary Available";
              notifMessage = `${educatorDisplayName} uploaded a new transcript and summary "${updatedTranscription.title}"`;
              notifType = "transcript_summary";
            }

            if (classSection) {
              notifMessage += ` for ${classSubject} — Section ${classSection}.`;
            } else {
              notifMessage += ` for ${classSubject}.`;
            }

            await prisma.notification.createMany({
              data: enrollments.map((e) => ({
                title: notifTitle,
                message: notifMessage,
                type: notifType,
                studentId: e.studentId,
              })),
            });
          }
        } catch (notifError) {
          console.error("Failed to create student notifications:", notifError);
        }
      }

      // Notify the educator that their transcription is complete
      try {
        const eduHasSummary = !!data.final_summary;
        const eduClassSubject = updatedTranscription.class?.subject || updatedTranscription.course;
        const eduClassSection = updatedTranscription.class?.section || "";
        const eduNotifTitle = eduHasSummary ? "Transcription & Summary Ready" : "Transcription Completed";
        let eduNotifMessage = eduHasSummary
          ? `Your live transcription "${updatedTranscription.title}" and its summary are now ready`
          : `Your live transcription "${updatedTranscription.title}" has been completed`;
        if (eduClassSection) {
          eduNotifMessage += ` for ${eduClassSubject} — Section ${eduClassSection}.`;
        } else {
          eduNotifMessage += `.`;
        }
        await prisma.notification.create({
          data: {
            title: eduNotifTitle,
            message: eduNotifMessage,
            type: eduHasSummary ? "transcript_summary" : "transcript",
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
        status: "COMPLETED",
        duration: data.duration,
        chunks_count: chunks.length,
        has_summary: !!data.final_summary,
        lesson_created: !!createdLesson,
        lesson_id: createdLesson?.id || null,
        transcript: data.transcript,
        live_transcript: data.live_transcript || null,
        final_summary: data.final_summary,
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
