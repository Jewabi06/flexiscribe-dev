import { NextRequest, NextResponse } from 'next/server';
import { generateQuizWithGemma, getBestAvailableModel } from '@/lib/ollama';

// Allow up to 5 minutes for remote Ollama inference (batch quiz generation)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Start timing for performance tracking
  const startTime = Date.now();
  
  try {
    const body = await request.json();    
    const { content, type, difficulty, count } = body;

    if (!content || !type || !difficulty || !count) {
      return NextResponse.json(
        { error: 'Missing required fields: content, type, difficulty, count' },
        { status: 400 }
      );
    }

    const validTypes = ['MCQ', 'FILL_IN_BLANK', 'FLASHCARD'];
    const validDifficulties = ['EASY', 'MEDIUM', 'HARD'];

    if (!validTypes.includes(type)) {
      console.error(`❌ Validation failed: Invalid type "${type}"`);
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validDifficulties.includes(difficulty)) {
      console.error(`❌ Validation failed: Invalid difficulty "${difficulty}"`);
      return NextResponse.json(
        { error: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof count !== 'number' || count < 1 || count > 50) {
      console.error(`❌ Validation failed: Invalid count "${count}"`);
      return NextResponse.json(
        { error: 'Count must be a number between 1 and 50' },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      console.error('❌ Validation failed: Empty content');
      return NextResponse.json(
        { error: 'Content cannot be empty' },
        { status: 400 }
      );
    }

    // Lesson content quality gate — short content produces hallucinated filler
    if (content.trim().length < 200) {
      return NextResponse.json(
        { error: 'Content is too short to generate meaningful questions. Please provide at least 200 characters.' },
        { status: 422 }
      );
    }

    // Check Ollama availability and resolve model
    let resolvedModel: string;
    try {
      // Test direct Ollama connection first
      const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
      const testResponse = await fetch(`http://${OLLAMA_BASE_URL}:11434/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (testResponse.ok) {
        const models = await testResponse.json();
      } else {
        throw new Error(`Ollama returned ${testResponse.status}`);
      }
      
      resolvedModel = await getBestAvailableModel();
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Ollama service is not available. Please ensure Ollama is running with: ollama serve' },
        { status: 503 }
      );
    }
    
    const generationStartTime = Date.now();
    
    let generatedQuiz;
    try {
      generatedQuiz = await generateQuizWithGemma(
        content,
        type as 'MCQ' | 'FILL_IN_BLANK' | 'FLASHCARD',
        difficulty as 'EASY' | 'MEDIUM' | 'HARD',
        count,
        resolvedModel
      );
      
      const generationDuration = Date.now() - generationStartTime;
  
      
    } catch (error: any) {
      const generationDuration = Date.now() - generationStartTime;
      throw error; // Re-throw to be caught by outer catch
    }

    // Validate generated quiz
    if (!generatedQuiz) {
      throw new Error('Generated quiz is null or undefined');
    }

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      quiz: {
        type: generatedQuiz.type,
        difficulty: generatedQuiz.difficulty,
        totalQuestions: generatedQuiz.items.length,
        questions: generatedQuiz.items,
        rejectedItems: generatedQuiz.rejectedItems || [],
        stats: generatedQuiz.stats || {
          requested: count,
          generated: generatedQuiz.items.length,
          rejected: generatedQuiz.rejectedItems?.length || 0,
          attempts: 0
        }
      },
    });
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('='.repeat(50));
    console.error('❌ ERROR IN QUIZ GENERATION');
    console.error('='.repeat(50));
    console.error(`⏱️ Failed after: ${totalDuration}ms`);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    console.error('='.repeat(50));
    
    return NextResponse.json(
      {
        error: 'Failed to generate quiz',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}