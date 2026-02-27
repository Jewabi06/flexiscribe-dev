import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Get educator's transcriptions
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (user.role !== "EDUCATOR") {
      return NextResponse.json(
        { error: "Unauthorized. Educator access only." },
        { status: 403 }
      );
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
    });

    if (!educator) {
      return NextResponse.json(
        { error: "Educator profile not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const course = searchParams.get("course");

    const transcriptions = await prisma.transcription.findMany({
      where: {
        educatorId: educator.id,
        ...(course && { course }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        class: {
          select: { id: true, subject: true, section: true },
        },
      },
    });

    return NextResponse.json({ transcriptions }, { status: 200 });
  } catch (error) {
    console.error("Get educator transcriptions error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Create a new transcription
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (user.role !== "EDUCATOR") {
      return NextResponse.json(
        { error: "Unauthorized. Educator access only." },
        { status: 403 }
      );
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
    });

    if (!educator) {
      return NextResponse.json(
        { error: "Educator profile not found" },
        { status: 404 }
      );
    }

    const {
      title,
      course,
      date,
      duration,
      content,
      rawText,
      transcriptJson,
      summaryJson,
      status,
      sessionId,
      classId,
    } = await request.json();

    const transcription = await prisma.transcription.create({
      data: {
        title,
        course,
        date,
        duration,
        content,
        rawText,
        transcriptJson: transcriptJson || undefined,
        summaryJson: summaryJson || undefined,
        status: status || "COMPLETED",
        sessionId: sessionId || undefined,
        classId: classId || undefined,
        educatorId: educator.id,
      },
    });

    // Notify enrolled students if this transcription is linked to a class
    if (classId && (status === "COMPLETED" || !status)) {
      try {
        const enrollments = await prisma.studentClass.findMany({
          where: { classId },
          select: { studentId: true },
        });

        if (enrollments.length > 0) {
          const classInfo = await prisma.class.findUnique({
            where: { id: classId },
            select: { subject: true, section: true },
          });

          const hasTranscript = !!rawText || !!transcriptJson;
          const hasSummary = !!summaryJson || (content && content.length > 0);
          let notifType = "transcript";
          let notifTitle = "New Transcript Available";
          let notifMessage = `A new transcript "${title}" has been uploaded`;
          
          if (hasSummary && hasTranscript) {
            notifType = "transcript_summary";
            notifTitle = "New Transcript & Summary Available";
            notifMessage = `A new transcript and summary "${title}" has been uploaded`;
          } else if (hasSummary) {
            notifType = "summary";
            notifTitle = "New Summary Available";
            notifMessage = `A new summary "${title}" has been uploaded`;
          }

          if (classInfo) {
            notifMessage += ` for ${classInfo.subject} — Section ${classInfo.section}.`;
          } else {
            notifMessage += ".";
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
        // Log but don't fail the transcription creation
        console.error("Failed to create student notifications:", notifError);
      }
    }

    // Notify the educator about the successful upload
    try {
      const hasSummary = !!summaryJson || (content && content.length > 0);
      const eduNotifTitle = hasSummary ? "Transcription & Summary Uploaded" : "Transcription Uploaded";
      let eduNotifMessage = hasSummary
        ? `Your transcription "${title}" and its summary have been uploaded successfully`
        : `Your transcription "${title}" has been uploaded successfully`;
      if (classId) {
        const classInfo2 = await prisma.class.findUnique({
          where: { id: classId },
          select: { subject: true, section: true },
        });
        if (classInfo2) {
          eduNotifMessage += ` for ${classInfo2.subject} — Section ${classInfo2.section}.`;
        } else {
          eduNotifMessage += ".";
        }
      } else {
        eduNotifMessage += ".";
      }
      await prisma.notification.create({
        data: {
          title: eduNotifTitle,
          message: eduNotifMessage,
          type: hasSummary ? "transcript_summary" : "transcript",
          educatorId: educator.id,
        },
      });
    } catch (eduNotifErr) {
      console.error("Failed to create educator notification:", eduNotifErr);
    }

    return NextResponse.json({ transcription }, { status: 201 });
  } catch (error) {
    console.error("Create transcription error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
