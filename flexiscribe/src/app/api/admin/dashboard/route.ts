import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/dashboard - Get dashboard statistics
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get counts
    const [totalStudents, totalEducators, totalQuizzes, recentActivities] = await Promise.all([
      prisma.student.count(),
      prisma.educator.count(),
      prisma.quiz.count(),
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Count active users (students + educators who have logged in within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUsers = await prisma.user.count({
      where: {
        role: {
          in: ["STUDENT", "EDUCATOR"],
        },
        updatedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Count quiz types
    const [flashcards, mcqs, fitb] = await Promise.all([
      prisma.quiz.count({ where: { type: "FLASHCARD" } }),
      prisma.quiz.count({ where: { type: "MCQ" } }),
      prisma.quiz.count({ where: { type: "FILL_IN_BLANK" } }),
    ]);

    // Build weekly quiz attempt counts (Sun-Sat of current week)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekAttempts = await prisma.quizAttempt.findMany({
      where: {
        completedAt: { gte: startOfWeek, lt: endOfWeek },
      },
      select: {
        completedAt: true,
        quiz: { select: { type: true } },
      },
    });

    // Bucket by day-of-week (0-6)
    const weeklyQuizData = Array.from({ length: 7 }, () => ({
      mcq: 0,
      fitb: 0,
      flashcards: 0,
    }));

    for (const a of weekAttempts) {
      const d = new Date(a.completedAt).getDay();
      if (a.quiz.type === "MCQ") weeklyQuizData[d].mcq++;
      else if (a.quiz.type === "FILL_IN_BLANK") weeklyQuizData[d].fitb++;
      else if (a.quiz.type === "FLASHCARD") weeklyQuizData[d].flashcards++;
    }

    return NextResponse.json(
      {
        stats: {
          totalStudents,
          totalEducators,
          activeUsers,
          totalQuizzes,
          flashcards,
          mcqs,
          fitb,
        },
        weeklyQuizData,
        recentActivities,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching dashboard data" },
      { status: 500 }
    );
  }
}
