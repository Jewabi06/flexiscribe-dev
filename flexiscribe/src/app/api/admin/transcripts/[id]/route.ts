import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// DELETE /api/admin/transcripts/[id] — Delete a transcript
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.transcription.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    await prisma.transcription.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        action: "TRANSCRIPT_DELETED",
        description: `Deleted transcript "${existing.title}" (${existing.course})`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "TRANSCRIPT_DELETED",
        details: `Deleted transcript "${existing.title}" (${existing.course})`,
        userRole: "ADMIN",
        userName: "Admin",
        userId: user.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transcript:", error);
    return NextResponse.json(
      { error: "Failed to delete transcript" },
      { status: 500 }
    );
  }
}
