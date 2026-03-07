import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateQuizWithGemma, getBestAvailableModel, cleanLessonForQuiz, expandKeyConcepts } from '@/lib/ollama';
import { verifyAuth } from '@/lib/auth';

// Allow up to 5 minutes for remote Ollama inference (batch quiz generation)
export const maxDuration = 300;

// Display-friendly labels for quiz types used in the formatted title
const QUIZ_TYPE_LABELS: Record<string, string> = {
  MCQ: 'MCQ',
  FILL_IN_BLANK: 'Fill-in-Blank',
  FLASHCARD: 'Flashcard',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lessonId, type, difficulty, count } = body;

    // Authenticate user and get student record
    const user = await verifyAuth(request);
    let studentId: string | null = null;
    if (user && user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: user.userId as string },
      });
      if (student) {
        studentId = student.id;
      }
    }

    // Validation
    if (!lessonId || !type || !difficulty || !count) {
      return NextResponse.json(
        { error: 'Missing required fields: lessonId, type, difficulty, count' },
        { status: 400 }
      );
    }

    const validTypes = ['MCQ', 'FILL_IN_BLANK', 'FLASHCARD'];
    const validDifficulties = ['EASY', 'MEDIUM', 'HARD'];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validDifficulties.includes(difficulty)) {
      return NextResponse.json(
        { error: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof count !== 'number' || count < 1 || count > 50) {
      return NextResponse.json(
        { error: 'Count must be a number between 1 and 50' },
        { status: 400 }
      );
    }

    // Single call: check availability + resolve best model in one /api/tags round-trip
    let resolvedModel: string;
    try {
      resolvedModel = await getBestAvailableModel();
    } catch {
      return NextResponse.json(
        { error: 'Ollama service is not available. Please ensure Ollama is running.' },
        { status: 503 }
      );
    }

    // Fetch the lesson
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      );
    }

    // Build quiz content from structured JSON reviewer data (preferred) or
    // fall back to plain text for backwards compatibility.
    let quizContent: string;
    let keyConcepts: { term: string; definition: string; example?: string }[] = [];
    let notes: { term: string; definition: string; example?: string }[] | undefined;
    try {
      const reviewerJson = JSON.parse(lesson.content);
      // Convert structured reviewer JSON into dense, quiz-optimized lesson content
      const parts: string[] = [];

      // Handle summary — may be a string or a string[] (Python format)
      if (reviewerJson.summary) {
        if (Array.isArray(reviewerJson.summary)) {
          parts.push(reviewerJson.summary.join('\n'));
        } else if (typeof reviewerJson.summary === 'string') {
          // Guard: skip if the summary string is itself a JSON blob
          const s = reviewerJson.summary.trim();
          const looksLikeJson = (s.startsWith('{') || s.startsWith('[')) &&
            (s.match(/"[a-z_]{1,30}"\s*:/gi) || []).length >= 3;
          if (!looksLikeJson) {
            parts.push(s);
          }
        }
      }

      // ── Extract keyConcepts from whichever format is present ──
      // Format 1 (callback-transformed): { keyConcepts: [{term, definition, example?}] }
      // Format 2 (raw Python):           { notes: [{term, definition, example?}], key_concepts: [string] }
      let rawConcepts: any[] | null = null;
      if (Array.isArray(reviewerJson.keyConcepts) && reviewerJson.keyConcepts.length > 0) {
        rawConcepts = reviewerJson.keyConcepts;
      } else if (Array.isArray(reviewerJson.notes) && reviewerJson.notes.length > 0) {
        // Fall back to Python `notes` format
        const keyConceptNames: string[] = Array.isArray(reviewerJson.key_concepts) ? reviewerJson.key_concepts : [];
        rawConcepts = reviewerJson.notes.map(
          (n: any, i: number) => {
            if (typeof n === 'object' && n.term) {
              return { term: n.term, definition: n.definition || '', ...(n.example ? { example: n.example } : {}) };
            }
            return { term: keyConceptNames[i] || `Concept ${i + 1}`, definition: typeof n === 'string' ? n : '' };
          }
        );
        console.log(`Quiz content: fell back to Python 'notes' format — found ${rawConcepts!.length} concepts`);
      }

      if (rawConcepts && rawConcepts.length > 0) {
        // Preserve structured keyConcepts for the generation pipeline
        keyConcepts = rawConcepts
          .filter((c: any) => c.term && c.definition)
          .map((c: any) => ({ term: String(c.term).trim(), definition: String(c.definition).trim(), ...(c.example ? { example: String(c.example).trim() } : {}) }));
        // Preserve the full notes array (with examples) for deterministic FIB and validation.
        // Include ALL notes that have a term — even those without definitions — so
        // note-example bypass in validateFillInBlankItem works for every note.
        notes = rawConcepts
          .filter((c: any) => c.term)
          .map((c: any) => ({ term: String(c.term).trim(), definition: String(c.definition || '').trim(), ...(c.example ? { example: String(c.example).trim() } : {}) }));

        // Build prose-format sentences from notes so both the deterministic FIB
        // and the LLM see natural language — NOT "Term: Definition" or JSON-like
        // format that causes the model to blank field names instead of concepts.
        const proseParts: string[] = [];
        for (const c of keyConcepts) {
          // Template 1: "Term refers to definition"
          if (c.definition.length > 15) {
            proseParts.push(`${c.term} refers to ${c.definition.charAt(0).toLowerCase()}${c.definition.slice(1)}`);
          }
          // Template 2: "An example of Term is example" (always includes the term)
          if (c.example && c.example.length > 10) {
            proseParts.push(`An example of ${c.term} is ${c.example.charAt(0).toLowerCase()}${c.example.slice(1)}`);
          }
          // Template 3: "Term is defined as definition"
          if (c.definition.length > 15) {
            proseParts.push(`${c.term} is defined as ${c.definition.charAt(0).toLowerCase()}${c.definition.slice(1)}`);
          }
        }
        if (proseParts.length > 0) {
          parts.push(proseParts.join('\n'));
        }
      }

      if (Array.isArray(reviewerJson.importantFacts)) {
        parts.push(reviewerJson.importantFacts.join('\n'));
      }
      // Guard: only include detailedContent if it is NOT a JSON blob.
      // Some lesson formats store the entire structured data here as a
      // stringified JSON object which would leak "term": / "definition":
      // syntax into the quiz content.
      if (reviewerJson.detailedContent && typeof reviewerJson.detailedContent === 'string') {
        const dc = reviewerJson.detailedContent.trim();
        const looksLikeJson = (dc.startsWith('{') || dc.startsWith('[')) &&
          (dc.match(/"[a-z_]{1,30}"\s*:/gi) || []).length >= 3;
        if (!looksLikeJson) {
          parts.push(dc);
        }
      }
      quizContent = parts.join('\n\n');
    } catch {
      // Not JSON — use content as-is (plain text lessons)
      quizContent = lesson.content;
    }

    // Clean the lesson content: strip greetings, conversational fillers, and meta-text
    // that would pollute fill-in-blank sentences if copied verbatim.
    quizContent = cleanLessonForQuiz(quizContent);
    console.log(`Quiz content built: ${quizContent.length} chars, ${keyConcepts.length} key concepts`);

    // Expand key concepts with variant terms found in the lesson content.
    // e.g. "JOIN Operation" → also adds "INNER JOIN", "LEFT JOIN" etc.
    // This lets the deterministic FIB generator produce items with correct,
    // verbatim answers instead of mismatching broad terms to specific sentences.
    // Keep the original (pre-expansion) list for Easy MCQ — expanded variants
    // produce fragment terms like "learning discovers" that are not valid concepts.
    const originalKeyConcepts = [...keyConcepts];
    if (keyConcepts.length > 0) {
      keyConcepts = expandKeyConcepts(keyConcepts, quizContent);
    }

    // Lesson content quality gate — short content produces hallucinated filler
    if (!quizContent || quizContent.trim().length < 200) {
      return NextResponse.json(
        { error: 'Reviewer content is too short to generate meaningful questions. The lesson needs at least 200 characters of content.' },
        { status: 422 }
      );
    }

    // Generate quiz — pass pre-resolved model to avoid redundant /api/tags calls
    console.log(`Generating ${type} quiz with ${count} questions at ${difficulty} difficulty using ${resolvedModel}...`);
    const generatedQuiz = await generateQuizWithGemma(
      quizContent,
      type as 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
      difficulty as 'EASY' | 'MEDIUM' | 'HARD',
      count,
      resolvedModel,
      keyConcepts,
      originalKeyConcepts,
      notes
    );

    // Guard: if the generator returned zero items, return a clear error
    // instead of creating a 0-question quiz in the database.
    if (!generatedQuiz.items || generatedQuiz.items.length === 0) {
      return NextResponse.json(
        {
          error: generatedQuiz.warning || 'Could not generate any valid quiz items from this lesson content.',
          stats: generatedQuiz.stats,
        },
        { status: 422 }
      );
    }

    // Compute the sequence number: count existing quizzes of the same lesson + type + student, then +1
    const existingCount = await prisma.quiz.count({
      where: {
        lessonId,
        type,
        ...(studentId ? { studentId } : {}),
      },
    });
    const sequenceNumber = existingCount + 1;

    // Build the formatted title: [Lesson Title] | [Difficulty] [Quiz Type] #N | [mm/dd/yyyy]
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${mm}/${dd}/${yyyy}`;
    const typeLabel = QUIZ_TYPE_LABELS[type] || type;
    const formattedTitle = `${lesson.title} | ${difficulty} ${typeLabel} #${sequenceNumber} | ${dateStr}`;

    // Save quiz to database (tied to the student for uniqueness)
    const quiz = await prisma.quiz.create({
      data: {
        lessonId,
        type,
        difficulty,
        title: formattedTitle,
        totalQuestions: generatedQuiz.items.length,
        ...(studentId ? { studentId } : {}),
        questions: {
          create: generatedQuiz.items.map((item: any, index: number) => ({
            questionText: item.question || item.sentence || item.front || '',
            questionData: item,
            orderIndex: index,
          })),
        },
      },
      include: {
        questions: true,
        lesson: {
          select: {
            title: true,
            subject: true,
          },
        },
      },
    });

    // Audit log - quiz generation
    try {
      const userName = user?.email || "Unknown";
      const userRole = user?.role || "STUDENT";
      await prisma.auditLog.create({
        data: {
          action: "Quiz Generated",
          details: `${type} quiz (${difficulty}, ${count} questions) generated from "${quiz.lesson.title}"`,
          userRole: userRole as any,
          userName,
          userId: user?.userId as string || undefined,
        },
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }

    // Create an in-app notification for the student
    if (studentId) {
      try {
        await prisma.notification.create({
          data: {
            title: 'Quiz Ready!',
            message: `Your ${difficulty} ${typeLabel} quiz "${lesson.title}" has been generated with ${generatedQuiz.items.length} questions.`,
            type: 'quiz_generated',
            studentId,
          },
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    }

    return NextResponse.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: formattedTitle,
        type: quiz.type,
        difficulty: quiz.difficulty,
        totalQuestions: quiz.totalQuestions,
        lessonTitle: quiz.lesson.title,
        subject: quiz.lesson.subject,
        questions: quiz.questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          data: q.questionData,
        })),
      },
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate quiz',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve available reviewers for quiz generation.
// Only returns Cornell Notes reviewers — MOTM records are excluded.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');

    const where = subject ? { subject } : {};

    const lessons = await prisma.lesson.findMany({
      where,
      select: {
        id: true,
        title: true,
        subject: true,
        content: true,
        createdAt: true,
        _count: {
          select: {
            quizzes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter out MOTM (meeting) records — only reviewers are quiz-eligible
    const reviewers = lessons.filter(l => {
      try {
        const parsed = JSON.parse(l.content);
        return parsed.type !== 'motm';
      } catch {
        return true; // plain-text lessons are also valid
      }
    });

    return NextResponse.json({
      success: true,
      lessons: reviewers.map(l => ({
        id: l.id,
        title: l.title,
        subject: l.subject,
        createdAt: l.createdAt,
        quizCount: l._count.quizzes,
      })),
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch lessons',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
