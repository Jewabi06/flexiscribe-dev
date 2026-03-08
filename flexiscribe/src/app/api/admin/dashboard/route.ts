import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/dashboard - Get dashboard statistics
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    function calcPercentageOf(part: number, total: number): number {
      if (total === 0) return 0;
      return Math.round((part / total) * 1000) / 10;
    }

    // ── Core counts ──
    const [
      totalStudents,
      totalEducators,
      activeUsers,
      inactiveUsers,
      totalQuizzes,
      flashcards,
      mcqs,
      fitb,
      recentActivities,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.educator.count(),
      prisma.user.count({
        where: { role: { in: ["STUDENT", "EDUCATOR"] }, status: "Active" },
      }),
      prisma.user.count({
        where: { role: { in: ["STUDENT", "EDUCATOR"] }, status: { not: "Active" } },
      }),
      prisma.quiz.count(),
      prisma.quiz.count({ where: { type: "FLASHCARD" } }),
      prisma.quiz.count({ where: { type: "MCQ" } }),
      prisma.quiz.count({ where: { type: "FILL_IN_BLANK" } }),
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const totalUsers = totalStudents + totalEducators;
    const totalActiveInactive = activeUsers + inactiveUsers;

    // ── Snapshot from 7 days ago (counts BEFORE last 7 days) ──
    const [
      studentsBeforeWeek,
      educatorsBeforeWeek,
      activeBeforeWeek,
      inactiveBeforeWeek,
      totalQuizzesBeforeWeek,
      flashcardsBeforeWeek,
      mcqsBeforeWeek,
      fitbBeforeWeek,
    ] = await Promise.all([
      prisma.student.count({
        where: { user: { createdAt: { lt: sevenDaysAgo } } },
      }),
      prisma.educator.count({
        where: { user: { createdAt: { lt: sevenDaysAgo } } },
      }),
      prisma.user.count({
        where: {
          role: { in: ["STUDENT", "EDUCATOR"] },
          status: "Active",
          createdAt: { lt: sevenDaysAgo },
        },
      }),
      prisma.user.count({
        where: {
          role: { in: ["STUDENT", "EDUCATOR"] },
          status: { not: "Active" },
          createdAt: { lt: sevenDaysAgo },
        },
      }),
      prisma.quiz.count({ where: { createdAt: { lt: sevenDaysAgo } } }),
      prisma.quiz.count({
        where: { type: "FLASHCARD", createdAt: { lt: sevenDaysAgo } },
      }),
      prisma.quiz.count({
        where: { type: "MCQ", createdAt: { lt: sevenDaysAgo } },
      }),
      prisma.quiz.count({
        where: { type: "FILL_IN_BLANK", createdAt: { lt: sevenDaysAgo } },
      }),
    ]);

    const totalUsersBeforeWeek = studentsBeforeWeek + educatorsBeforeWeek;
    const totalActiveInactiveBeforeWeek = activeBeforeWeek + inactiveBeforeWeek;

    // ── Current proportions ──
    const studentsPct = calcPercentageOf(totalStudents, totalUsers);
    const educatorsPct = calcPercentageOf(totalEducators, totalUsers);
    const activePct = calcPercentageOf(activeUsers, totalActiveInactive);
    const flashcardsPct = calcPercentageOf(flashcards, totalQuizzes);
    const mcqsPct = calcPercentageOf(mcqs, totalQuizzes);
    const fitbPct = calcPercentageOf(fitb, totalQuizzes);

    // ── Previous week proportions ──
    const prevStudentsPct = calcPercentageOf(studentsBeforeWeek, totalUsersBeforeWeek);
    const prevEducatorsPct = calcPercentageOf(educatorsBeforeWeek, totalUsersBeforeWeek);
    const prevActivePct = calcPercentageOf(activeBeforeWeek, totalActiveInactiveBeforeWeek);
    const prevFlashcardsPct = calcPercentageOf(flashcardsBeforeWeek, totalQuizzesBeforeWeek);
    const prevMcqsPct = calcPercentageOf(mcqsBeforeWeek, totalQuizzesBeforeWeek);
    const prevFitbPct = calcPercentageOf(fitbBeforeWeek, totalQuizzesBeforeWeek);

    // ── Proportion shift (how much % increased or decreased) ──
    function proportionShift(current: number, previous: number): number {
      return Math.round((current - previous) * 10) / 10;
    }

    // ── Weekly quiz attempt chart data ──
    const dayOfWeek = now.getDay();
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
          inactiveUsers,
          totalUsers,
          totalQuizzes,
          flashcards,
          mcqs,
          fitb,
        },
        percentages: {
          studentsPercentage: studentsPct,
          educatorsPercentage: educatorsPct,
          activeUsersPercentage: activePct,
          flashcardsPercentage: flashcardsPct,
          mcqsPercentage: mcqsPct,
          fitbPercentage: fitbPct,
        },
        proportionChanges: {
          studentsChange: proportionShift(studentsPct, prevStudentsPct),
          educatorsChange: proportionShift(educatorsPct, prevEducatorsPct),
          activeUsersChange: proportionShift(activePct, prevActivePct),
          flashcardsChange: proportionShift(flashcardsPct, prevFlashcardsPct),
          mcqsChange: proportionShift(mcqsPct, prevMcqsPct),
          fitbChange: proportionShift(fitbPct, prevFitbPct),
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