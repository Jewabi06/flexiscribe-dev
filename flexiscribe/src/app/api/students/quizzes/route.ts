import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

// Map DB quiz type enum to display-friendly label
function mapQuizType(type: string): string {
  switch (type) {
    case 'MCQ': return 'MCQ';
    case 'FILL_IN_BLANK': return 'Fill-in';
    case 'FLASHCARD': return 'Flashcard';
    default: return type;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get the student record
    const student = await prisma.student.findUnique({
      where: { userId: user.userId as string },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch only quizzes that belong to this student (self-paced, unique per student)
    const quizzes = await prisma.quiz.findMany({
      where: {
        studentId: student.id,
      },
      include: {
        lesson: {
          select: {
            title: true,
            subject: true,
          },
        },
        attempts: {
          where: {
            studentId: student.id,
          },
          orderBy: {
            completedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedQuizzes = quizzes.map((quiz) => {
      const latestAttempt = quiz.attempts[0] || null;
      const accuracy = latestAttempt
        ? Math.round((latestAttempt.score / latestAttempt.totalQuestions) * 100)
        : null;

      return {
        id: quiz.id,
        lesson: quiz.lesson.title,
        subject: quiz.lesson.subject,
        quizType: mapQuizType(quiz.type),
        numQuestions: quiz.totalQuestions,
        accuracy: accuracy ?? 0,
        completedDate: latestAttempt?.completedAt?.toISOString() || null,
        lastAccessedDate: latestAttempt?.completedAt?.toISOString() || quiz.createdAt.toISOString(),
        score: latestAttempt?.score ?? null,
        totalScore: latestAttempt?.totalQuestions ?? quiz.totalQuestions,
        hasAttempt: !!latestAttempt,
      };
    });

    return NextResponse.json({
      success: true,
      quizzes: formattedQuizzes,
    });
  } catch (error) {
    console.error('Error fetching student quizzes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quizzes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
