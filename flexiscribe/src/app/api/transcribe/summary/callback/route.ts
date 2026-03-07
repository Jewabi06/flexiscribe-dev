import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const CALLBACK_SECRET = process.env.FLEXISCRIBE_CALLBACK_SECRET || "fls-cb-s3cr3t-k7m9x2";

/**
 * POST /api/transcribe/summary/callback
 *
 * Called by the FastAPI backend when the final Cornell/MOTM summary has
 * finished generating asynchronously.  This endpoint:
 *   1. Updates the Transcription record with the final summary
 *   2. Creates a Lesson (reviewer) from Cornell Notes
 *   3. Notifies enrolled students and the educator
 */
export async function POST(request: NextRequest) {
  try {
    // Verify callback secret
    if (CALLBACK_SECRET) {
      const secret = request.headers.get("x-callback-secret");
      if (secret !== CALLBACK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { session_id, transcription_id, final_summary } = await request.json();

    if (!transcription_id) {
      return NextResponse.json(
        { error: "transcription_id is required" },
        { status: 400 }
      );
    }

    if (!final_summary) {
      return NextResponse.json(
        { error: "final_summary is required" },
        { status: 400 }
      );
    }

    // 1. Update the transcription with the final summary
    const transcription = await prisma.transcription.update({
      where: { id: transcription_id },
      data: {
        summaryJson: final_summary,
        status: "COMPLETED",
      },
      include: {
        class: {
          select: { id: true, subject: true, section: true },
        },
      },
    });

    console.log(
      `[CALLBACK] Summary received for transcription ${transcription_id} (session ${session_id})`
    );

    // 2. Auto-create a Reviewer (Lesson) from Cornell Notes
    let createdLesson: { id: string; title: string } | null = null;
    const sType = transcription.sessionType || "lecture";

    // Extract the summary object — it may be wrapped in metadata
    const summaryObj = final_summary.title
      ? final_summary
      : final_summary.summary || final_summary;

    if (sType === "lecture" && summaryObj) {
      try {
        const keyConcepts = summaryObj.key_concepts || [];
        const notes = summaryObj.notes || [];
        const summary = summaryObj.summary || "";
        const reviewerContent = JSON.stringify({
          type: "cornell",
          title: summaryObj.title || transcription.title,
          summary,
          keyConcepts: Array.isArray(notes)
            ? notes.map(
                (n: { term?: string; definition?: string } | string, i: number) => {
                  if (typeof n === "object" && n.term) {
                    return { term: n.term, definition: n.definition || "" };
                  }
                  return {
                    term: keyConcepts[i] || `Concept ${i + 1}`,
                    definition: typeof n === "string" ? n : "",
                  };
                }
              )
            : [],
          importantFacts: Array.isArray(notes)
            ? notes.map((n: { term?: string; definition?: string } | string) =>
                typeof n === "object" ? `${n.term}: ${n.definition}` : n
              )
            : [],
          detailedContent: `${keyConcepts.join("\n")}\n\n${
            Array.isArray(notes)
              ? notes
                  .map((n: { term?: string; definition?: string } | string) =>
                    typeof n === "object"
                      ? `${n.term}: ${n.definition}`
                      : n
                  )
                  .join("\n")
              : ""
          }\n\n${Array.isArray(summary) ? summary.join("\n") : summary}`,
        });

        if (reviewerContent.length >= 200) {
          createdLesson = await prisma.lesson.create({
            data: {
              title: transcription.title,
              subject: transcription.course,
              content: reviewerContent,
            },
          });
          console.log(
            `[CALLBACK] Auto-created reviewer "${createdLesson.title}" (${createdLesson.id})`
          );
        }
      } catch (lessonErr) {
        console.error("[CALLBACK] Failed to auto-create reviewer:", lessonErr);
      }
    }

    // 3. Notify enrolled students
    if (transcription.classId) {
      try {
        const enrollments = await prisma.studentClass.findMany({
          where: { classId: transcription.classId },
          select: { studentId: true },
        });

        if (enrollments.length > 0) {
          const classSubject =
            transcription.class?.subject || transcription.course;
          const classSection = transcription.class?.section || "";

          const educator = await prisma.educator.findUnique({
            where: { id: transcription.educatorId },
            select: { fullName: true },
          });
          const educatorDisplayName = educator?.fullName || "Your professor";

          let notifMessage = `${educatorDisplayName} uploaded a new transcript and summary "${transcription.title}"`;
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
        console.error("[CALLBACK] Failed to create student notifications:", notifError);
      }
    }

    // 4. Notify the educator that summary + reviewer are ready
    try {
      const eduClassSubject =
        transcription.class?.subject || transcription.course;
      const eduClassSection = transcription.class?.section || "";
      let eduNotifMessage = `Your summary and reviewer for "${transcription.title}" are now ready`;
      if (eduClassSection) {
        eduNotifMessage += ` (${eduClassSubject} — Section ${eduClassSection}).`;
      } else {
        eduNotifMessage += `.`;
      }
      await prisma.notification.create({
        data: {
          title: "Summary & Reviewer Ready",
          message: eduNotifMessage,
          type: "transcript_summary",
          educatorId: transcription.educatorId,
        },
      });
    } catch (eduNotifErr) {
      console.error("[CALLBACK] Failed to create educator notification:", eduNotifErr);
    }

    return NextResponse.json({
      message: "Summary processed successfully",
      transcription_id,
      lesson_created: !!createdLesson,
      lesson_id: createdLesson?.id || null,
    });
  } catch (error) {
    console.error("[CALLBACK] Summary callback error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
