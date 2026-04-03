import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized - student access only" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      include: {
        user: {
          select: { email: true, role: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    // Profile object
    const profile = {
      id: student.id,
      studentNumber: student.studentNumber,
      username: student.username || student.user.email.split("@")[0],
      fullName: student.fullName,
      yearLevel: student.yearLevel,
      section: student.section,
      program: student.program,
      gender: student.gender,
      birthDate: student.birthDate,
      xp: student.xp || 0,
      avatar: student.avatar || null,
      email: student.user.email,
      role: student.user.role,
    };

    // Streak
    const today = new Date().toISOString().split("T")[0];
    let streakCount = student.streakCount || 0;
    let streakActive = false;

    if (student.lastActivityDate) {
      const lastDate = new Date(student.lastActivityDate);
      const currentDate = new Date(today);
      const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        streakActive = true;
      } else {
        streakCount = 0;
      }
    }

    const streak = {
      count: streakCount,
      isActive: streakActive,
      lastActivityDate: student.lastActivityDate,
    };

    // Leaderboard (top students) - reduce payload
    const leaderboardStudents = await prisma.student.findMany({
      where: {
        user: { isGhost: false },
      },
      select: {
        id: true,
        studentNumber: true,
        username: true,
        fullName: true,
        xp: true,
        avatar: true,
        _count: { select: { quizAttempts: true } },
      },
      orderBy: { xp: "desc" },
      take: 20,
    });

    const leaderboard = leaderboardStudents.map((s, idx) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      username: s.username,
      fullName: s.fullName,
      xp: s.xp,
      avatar: s.avatar,
      rank: idx + 1,
      quizzesTaken: s._count.quizAttempts,
    }));

    // Student quizzes
    const quizzesRaw = await prisma.quiz.findMany({
      where: { studentId: student.id },
      include: {
        lesson: { select: { title: true, subject: true } },
        attempts: {
          where: { studentId: student.id },
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const quizzes = quizzesRaw.map((quiz) => {
      const latestAttempt = quiz.attempts[0] || null;
      const accuracy = latestAttempt ? Math.round((latestAttempt.score / latestAttempt.totalQuestions) * 100) : 0;
      return {
        id: quiz.id,
        lesson: quiz.title || quiz.lesson.title,
        lessonTitle: quiz.lesson.title,
        subject: quiz.lesson.subject,
        quizType: quiz.type,
        numQuestions: quiz.totalQuestions,
        accuracy,
        completedDate: latestAttempt?.completedAt ? latestAttempt.completedAt.toISOString() : null,
        lastAccessedDate: latestAttempt?.completedAt ? latestAttempt.completedAt.toISOString() : quiz.createdAt.toISOString(),
        score: latestAttempt?.score ?? null,
        totalScore: latestAttempt?.totalQuestions ?? quiz.totalQuestions,
        hasAttempt: !!latestAttempt,
      };
    });

    // Recent transcriptions (24h) for reviewer cards
    const enrollments = await prisma.studentClass.findMany({ where: { studentId: student.id }, select: { classId: true } });
    const enrolledClassIds = enrollments.map((e) => e.classId);

    const recentTranscriptions = await prisma.transcription.findMany({
      where: {
        status: "COMPLETED",
        classId: { in: enrolledClassIds.length > 0 ? enrolledClassIds : ["__none__"] },
      },
      select: {
        id: true,
        title: true,
        course: true,
        date: true,
        duration: true,
        sessionType: true,
        createdAt: true,
        educator: { select: { fullName: true } },
        class: { select: { classCode: true, subject: true, section: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    return NextResponse.json({ profile, streak, leaderboard, quizzes, recentReviewers: recentTranscriptions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching student dashboard data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
