import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/class-analytics - Get class analytics
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get quiz counts by type
    const [flashcards, mcqs, fitb] = await Promise.all([
      prisma.quiz.count({ where: { type: "FLASHCARD" } }),
      prisma.quiz.count({ where: { type: "MCQ" } }),
      prisma.quiz.count({ where: { type: "FILL_IN_BLANK" } }),
    ]);

    // Get class data
    const classes = await prisma.class.findMany({
      include: {
        educator: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Get student count (exclude ghost users so analytics reflect real students)
    const totalStudents = await prisma.student.count({
      where: { user: { isGhost: false } },
    });
    // Exclude ghost students' quiz attempts so analytics reflect real student performance
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: {
        student: { user: { isGhost: false } },
        totalQuestions: { gt: 0 }, // guard against division by zero
      },
      select: {
        score: true,
        totalQuestions: true,
      },
    });

    // Calculate average score
    let avgScore = 0;
    if (quizAttempts.length > 0) {
      const totalScore = quizAttempts.reduce((sum: number, attempt: { score: number; totalQuestions: number }) => {
        return sum + (attempt.score / attempt.totalQuestions) * 100;
      }, 0);
      avgScore = Math.round(totalScore / quizAttempts.length);
    }

    // Calculate engagement based on recent quiz attempts by non-ghost students
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAttempts = await prisma.quizAttempt.count({
      where: {
        student: { user: { isGhost: false } },
        completedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    const engagement = totalStudents > 0 
      ? recentAttempts / totalStudents > 0.5 
        ? "High" 
        : recentAttempts / totalStudents > 0.2 
          ? "Medium" 
          : "Low"
      : "Low";

    // Get total number of lessons (reviewers)
    const totalReviewers = await prisma.lesson.count();

    return NextResponse.json(
      {
        generatedContent: {
          flashcards,
          mcqs,
          fitb,
        },
        overview: {
          totalStudents,
          avgScore,
          engagement,
          totalReviewers, // Now correctly counts lessons
        },
        classes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get class analytics error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching class analytics" },
      { status: 500 }
    );
  }
}