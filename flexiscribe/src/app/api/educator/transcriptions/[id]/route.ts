import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const transcription = await prisma.transcription.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        course: true,
        date: true,
        duration: true,
        content: true,
        rawText: true,
        summaryJson: true,
        transcriptJson: true,
        status: true,
        createdAt: true,
        educatorId: true,
        class: {
          select: {
            id: true,
            classCode: true,
            subject: true,
            section: true,
          },
        },
      },
    });

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 }
      );
    }

    if (transcription.educatorId !== educator.id) {
      return NextResponse.json(
        { error: "Forbidden. You do not own this transcription." },
        { status: 403 }
      );
    }

    return NextResponse.json({ transcription }, { status: 200 });
  } catch (error) {
    console.error("Get educator transcription error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const transcription = await prisma.transcription.findUnique({
      where: { id },
    });

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { status: 404 }
      );
    }

    if (transcription.educatorId !== educator.id) {
      return NextResponse.json(
        { error: "Forbidden. You do not own this transcription." },
        { status: 403 }
      );
    }

    const {
      summaryJson,
      transcriptJson,
      rawText,
      content,
    } = await request.json();

    const updateData: any = {};

    if (summaryJson !== undefined) {
      updateData.summaryJson = summaryJson;
    }
    if (transcriptJson !== undefined) {
      updateData.transcriptJson = transcriptJson;
    }
    if (rawText !== undefined && rawText !== null) {
      updateData.rawText = rawText;
    }
    if (content !== undefined && content !== null) {
      updateData.content = content;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No update payload provided" },
        { status: 400 }
      );
    }

    const updatedTranscription = await prisma.transcription.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ transcription: updatedTranscription }, { status: 200 });
  } catch (error) {
    console.error("Update educator transcription error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
