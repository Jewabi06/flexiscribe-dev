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

    // Get student count and quiz attempt statistics
    const totalStudents = await prisma.student.count();
    const quizAttempts = await prisma.quizAttempt.findMany({
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

    // Calculate engagement based on recent quiz attempts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAttempts = await prisma.quizAttempt.count({
      where: {
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
          totalReviewers: totalStudents, // Assuming each student has access to reviewers
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
