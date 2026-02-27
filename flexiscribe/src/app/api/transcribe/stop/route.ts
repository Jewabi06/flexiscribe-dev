import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

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
    const response = await fetch(`${FASTAPI_URL}/transcribe/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || "Failed to stop transcription" },
        { status: response.status }
      );
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

            let notifTitle = "New Transcript Available";
            let notifMessage = `A new transcript "${updatedTranscription.title}" has been uploaded`;
            let notifType = "transcript";

            if (hasSummary) {
              notifTitle = "New Transcript & Summary Available";
              notifMessage = `A new transcript and summary "${updatedTranscription.title}" has been uploaded`;
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
        transcript: data.transcript,
        final_summary: data.final_summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stop transcription error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
