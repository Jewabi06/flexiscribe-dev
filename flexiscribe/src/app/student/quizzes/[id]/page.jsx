"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FlashcardQuiz from "./FlashcardQuiz";
import MCQQuiz from "./MCQQuiz";
import FillInQuiz from "./FillInQuiz";
import LoadingScreen from "@/components/shared/LoadingScreen";

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchQuiz() {
      try {
        setLoading(true);
        const quizId = params.id;
        const response = await fetch(`/api/students/quizzes/${quizId}`);
        if (!response.ok) {
          setError('Quiz not found');
          router.push("/student/quizzes");
          return;
        }
        const data = await response.json();
        if (data.success) {
          setQuiz(data.quiz);
          setQuestions(data.questions);
        } else {
          setError(data.error || 'Failed to load quiz');
          router.push("/student/quizzes");
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz');
        router.push("/student/quizzes");
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [params.id, router]);

  if (loading || !quiz || !questions) {
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
      return <div>Unknown quiz type: {quiz.quizType}</div>;
  }
}
