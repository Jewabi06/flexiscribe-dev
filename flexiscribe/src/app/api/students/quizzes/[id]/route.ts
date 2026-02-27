import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

// XP awarded per correct answer based on difficulty
// HARD 30 questions perfect = 300 XP
const XP_PER_CORRECT: Record<string, number> = {
  EASY: 5,
  MEDIUM: 7,
  HARD: 10,
};

// XP per flashcard reviewed, scaled by difficulty
const FLASHCARD_XP_PER_CARD: Record<string, number> = {
  EASY: 2,
  MEDIUM: 3,
  HARD: 5,
};

// Map DB quiz type enum to display-friendly label
function mapQuizType(type: string): string {
  switch (type) {
    case 'MCQ': return 'MCQ';
    case 'FILL_IN_BLANK': return 'Fill-in';
    case 'FLASHCARD': return 'Flashcard';
    default: return type;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: quizId } = await params;

    // Get the student record for ownership check
    let studentId: string | null = null;
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: user.userId as string },
      });
      if (student) {
        studentId = student.id;
      }
    }

    // Fetch quiz with questions and lesson info
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: {
          select: {
            title: true,
            subject: true,
          },
        },
        questions: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Ensure the quiz belongs to the requesting student (self-paced, unique per student)
    if (studentId && quiz.studentId && quiz.studentId !== studentId) {
      return NextResponse.json({ error: 'Access denied – this quiz belongs to another student' }, { status: 403 });
    }

    const displayType = mapQuizType(quiz.type);

    // Transform questions to the format expected by the quiz components
    const transformedQuestions = quiz.questions.map((q, index) => {
      const data = q.questionData as any;

      switch (quiz.type) {
        case 'MCQ':
          return {
            id: index + 1,
            question: data.question || q.questionText,
            options: data.choices || data.options || [],
            correctAnswer: typeof data.answerIndex === 'number'
              ? data.answerIndex
              : typeof data.correctAnswer === 'number'
                ? data.correctAnswer
                : (data.choices || data.options || []).indexOf(data.answer || data.correctAnswer),
            hint: data.hint || data.explanation || 'No hint available.',
          };

        case 'FILL_IN_BLANK':
          // The sentence has [blank] markers; convert to __________
          const sentence = (data.sentence || q.questionText || '').replace(/\[blank\]/gi, '__________');
          return {
            id: index + 1,
            question: sentence,
            correctAnswer: data.answer || data.correctAnswer || '',
            hint: data.hint || 'No hint available.',
          };

        case 'FLASHCARD':
          return {
            id: index + 1,
            front: data.front || q.questionText,
            back: data.back || '',
            hint: data.hint || 'No hint available.',
          };

        default:
          return {
            id: index + 1,
            question: q.questionText,
            hint: data.hint || 'No hint available.',
          };
      }
    });

    // Fetch the student's latest attempt for this quiz (if any)
    let latestAttempt: any = null;
    if (studentId) {
      latestAttempt = await prisma.quizAttempt.findFirst({
        where: { quizId, studentId },
        orderBy: { completedAt: 'desc' },
      });
    }

    return NextResponse.json({
      success: true,
      quiz: {
        id: quiz.id,
        lesson: quiz.lesson.title,
        subject: quiz.lesson.subject,
        quizType: displayType,
        numQuestions: quiz.totalQuestions,
        difficulty: quiz.difficulty,
      },
      questions: {
        quizType: displayType,
        questions: transformedQuestions,
      },
      latestAttempt: latestAttempt ? {
        id: latestAttempt.id,
        score: latestAttempt.score,
        totalQuestions: latestAttempt.totalQuestions,
        accuracy: Math.round((latestAttempt.score / latestAttempt.totalQuestions) * 100),
        completedAt: latestAttempt.completedAt.toISOString(),
        answers: latestAttempt.answers,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quiz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students/quizzes/[id]
 * Submit a quiz attempt – calculates score, awards XP, persists QuizAttempt.
 *
 * Body: { answers: Record<string, any> }
 *   MCQ      → { "0": 2, "1": 0, ... }          (index of chosen option)
 *   FILL_IN  → { "0": "polymorphism", ... }      (text answer)
 *   FLASHCARD → {} (no scoring – flat XP)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id: quizId } = await params;
    const body = await request.json();
    const submittedAnswers: Record<string, any> = body.answers ?? {};
    const startedAt: string | null = body.startedAt ?? null;

    // Get the student record
    const student = await prisma.student.findUnique({
      where: { userId: user.userId as string },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch quiz + questions
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        lesson: { select: { title: true, subject: true } },
      },
    });
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const totalQuestions = quiz.questions.length;
    let correctCount = 0;
    const answerResults: Array<{
      index: number;
      correct: boolean;
      userAnswer: any;
      correctAnswer: any;
    }> = [];

    // ----- Score calculation per quiz type -----
    if (quiz.type === 'FLASHCARD') {
      // Flashcards have no right/wrong – award flat XP
      correctCount = totalQuestions; // treat all as "completed"
      quiz.questions.forEach((_, index) => {
        answerResults.push({ index, correct: true, userAnswer: null, correctAnswer: null });
      });
    } else {
      quiz.questions.forEach((q, index) => {
        const data = q.questionData as any;
        const userAnswer = submittedAnswers[String(index)];

        if (userAnswer === undefined || userAnswer === null) {
          // unanswered — mark as incorrect
          if (quiz.type === 'MCQ') {
            const correctIndex =
              typeof data.answerIndex === 'number'
                ? data.answerIndex
                : typeof data.correctAnswer === 'number'
                  ? data.correctAnswer
                  : (data.choices || data.options || []).indexOf(data.answer || data.correctAnswer);
            answerResults.push({ index, correct: false, userAnswer: null, correctAnswer: correctIndex });
          } else {
            answerResults.push({ index, correct: false, userAnswer: null, correctAnswer: data.answer || data.correctAnswer || '' });
          }
          return;
        }

        if (quiz.type === 'MCQ') {
          const correctIndex =
            typeof data.answerIndex === 'number'
              ? data.answerIndex
              : typeof data.correctAnswer === 'number'
                ? data.correctAnswer
                : (data.choices || data.options || []).indexOf(data.answer || data.correctAnswer);
          const isCorrect = Number(userAnswer) === correctIndex;
          if (isCorrect) correctCount++;
          answerResults.push({ index, correct: isCorrect, userAnswer: Number(userAnswer), correctAnswer: correctIndex });
        } else if (quiz.type === 'FILL_IN_BLANK') {
          const correctText = (data.answer || data.correctAnswer || '').toString().trim().toLowerCase();
          const userText = userAnswer.toString().trim().toLowerCase();
          const isCorrect = userText === correctText;
          if (isCorrect) correctCount++;
          answerResults.push({ index, correct: isCorrect, userAnswer: userAnswer, correctAnswer: data.answer || data.correctAnswer || '' });
        }
      });
    }

    // ----- XP calculation -----
    const baseXpPerCorrect = XP_PER_CORRECT[quiz.difficulty] ?? XP_PER_CORRECT.MEDIUM;
    let baseXpEarned: number;

    if (quiz.type === 'FLASHCARD') {
      const xpPerCard = FLASHCARD_XP_PER_CARD[quiz.difficulty] ?? FLASHCARD_XP_PER_CARD.MEDIUM;
      baseXpEarned = totalQuestions * xpPerCard;
    } else {
      baseXpEarned = correctCount * baseXpPerCorrect;
    }

    // Check if this is the first attempt or a retry
    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: { quizId: quiz.id, studentId: student.id },
    });
    const isFirstAttempt = !existingAttempt;

    // 1st take = 100% XP, retries = 10% XP (always rounded up, no decimals)
    let xpEarned: number;
    if (isFirstAttempt) {
      xpEarned = baseXpEarned;
    } else {
      xpEarned = Math.ceil(baseXpEarned * 0.10);
    }

    // Create the quiz attempt with answer results
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        score: correctCount,
        totalQuestions,
        answers: { submitted: submittedAnswers, results: answerResults },
        startedAt: startedAt ? new Date(startedAt) : null,
      },
    });

    // Award XP to the student
    await prisma.student.update({
      where: { id: student.id },
      data: { xp: { increment: xpEarned } },
    });

    const newXp = student.xp + xpEarned;

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        score: correctCount,
        totalQuestions,
        accuracy: Math.round((correctCount / totalQuestions) * 100),
        xpEarned,
        isFirstAttempt,
        newXp,
        results: answerResults,
      },
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit quiz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
