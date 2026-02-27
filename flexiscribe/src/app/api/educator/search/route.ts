import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/educator/search?q=keyword
 * Search across transcriptions that belong to the educator's classes.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "EDUCATOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
    });

    if (!educator) {
      return NextResponse.json({ error: "Educator not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Search transcriptions belonging to this educator
    const transcriptions = await prisma.transcription.findMany({
      where: {
        educatorId: educator.id,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { course: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        course: true,
        date: true,
        status: true,
        class: {
          select: {
            subject: true,
            section: true,
          },
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    // Build results array
    const results = transcriptions.map((t) => ({
      id: t.id,
      type: "transcription",
      title: t.title,
      subject: t.course + (t.class ? ` • Section ${t.class.section}` : ""),
      link: `/educator/transcriptions`,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Educator search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
