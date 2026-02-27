"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlashcardQuiz from "./FlashcardQuiz";
import MCQQuiz from "./MCQQuiz";
import FillInQuiz from "./FillInQuiz";
import LoadingScreen from "@/components/shared/LoadingScreen";

export default function TestViewPage() {
  const router = useRouter();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState(null);

  useEffect(() => {
    // Get generated quiz from localStorage
    const savedQuiz = localStorage.getItem('generated-test-quiz');
    
    if (!savedQuiz) {
      alert('No quiz found. Please generate a quiz first from the test page.');
      router.push("/student/quizzes/test");
      return;
    }

    try {
      const quizData = JSON.parse(savedQuiz);
      
      // Transform generated quiz data to match the expected format
      const transformedQuiz = {
        id: 'test-quiz',
        lesson: `Generated ${quizData.type.toUpperCase()} Quiz - ${quizData.difficulty.charAt(0).toUpperCase() + quizData.difficulty.slice(1)} Difficulty`,
        quizType: quizData.type === 'mcq' ? 'MCQ' : quizData.type === 'fill_blank' ? 'Fill-in' : 'Flashcard',
        totalQuestions: quizData.totalQuestions,
        difficulty: quizData.difficulty,
      };

      // Transform questions based on type
      let transformedQuestions = { questions: [] };
      
      if (quizData.type === 'mcq') {
        transformedQuestions.questions = quizData.questions.map((q, idx) => ({
          id: idx + 1,
          question: q.question,
          options: q.choices,
          correctAnswer: q.answerIndex,
          hint: q.explanation || 'No hint available',
          explanation: q.explanation,
        }));
      } else if (quizData.type === 'fill_blank') {
        transformedQuestions.questions = quizData.questions.map((q, idx) => ({
          id: idx + 1,
          question: q.sentence,
          correctAnswer: q.answer,
          hint: `The answer is related to: ${q.answer.slice(0, 2)}...`,
          distractors: q.distractors || [],
        }));
      } else if (quizData.type === 'flashcard') {
        transformedQuestions.questions = quizData.questions.map((q, idx) => ({
          id: idx + 1,
          front: q.front,
          back: q.back,
          hint: 'Click to flip the card',
        }));
      }

      setQuiz(transformedQuiz);
      setQuestions(transformedQuestions);
    } catch (error) {
      console.error('Error parsing quiz data:', error);
      alert('Error loading quiz. Please generate a new quiz.');
      router.push("/student/quizzes/test");
    }
  }, [router]);

  if (!quiz || !questions) {
    return <LoadingScreen />;
  }

  // Render the appropriate quiz type component
  switch (quiz.quizType) {
    case "Flashcard":
      return <FlashcardQuiz quiz={quiz} questions={questions} />;
    case "MCQ":
      return <MCQQuiz quiz={quiz} questions={questions} />;
    case "Fill-in":
      return <FillInQuiz quiz={quiz} questions={questions} />;
    default:
      return <div>Unknown quiz type</div>;
  }
}
