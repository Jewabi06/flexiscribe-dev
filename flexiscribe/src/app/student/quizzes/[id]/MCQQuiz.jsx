"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import MessageModal from "@/components/shared/MessageModal";
import AnswerReviewModal from "@/components/shared/AnswerReviewModal";
import "../../dashboard/styles.css";
import "./quiz-styles.css";
import { trackActivity } from "../../../../utils/student";

export default function MCQQuiz({ quiz, questions }) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [answers, setAnswers] = useState({});
  const [studentProfile, setStudentProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [quizStartedAt] = useState(() => new Date().toISOString());
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [quizResults, setQuizResults] = useState(null);

  const currentQuestion = questions.questions[currentQuestionIndex];
  const totalQuestions = questions.questions.length;
  const answersRef = useRef(answers);

  // Keep ref in sync for unmount/tab-change saves
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Save progress on page unload, tab switch, or navigation away
  useEffect(() => {
    const saveProgress = () => {
      const currentAnswers = answersRef.current;
      if (Object.keys(currentAnswers).length > 0) {
        localStorage.setItem(`quiz-answers-${quiz.id}`, JSON.stringify(currentAnswers));
        localStorage.setItem(`quiz-progress-${quiz.id}`, JSON.stringify({
          quizId: quiz.id,
          lesson: quiz.lesson,
          quizType: quiz.quizType,
          totalQuestions,
          answeredCount: Object.keys(currentAnswers).length,
          lastUpdated: new Date().toISOString(),
        }));
      }
    };
    const handleBeforeUnload = () => saveProgress();
    const handleVisibilityChange = () => { if (document.hidden) saveProgress(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      saveProgress();
    };
  }, [quiz.id, quiz.lesson, quiz.quizType, totalQuestions]);

  // Load saved answers from localStorage
  useEffect(() => {
    const savedAnswers = localStorage.getItem(`quiz-answers-${quiz.id}`);
    if (savedAnswers) {
      const parsedAnswers = JSON.parse(savedAnswers);
      setAnswers(parsedAnswers);
      // Set the selected answer for current question if it exists
      if (parsedAnswers[currentQuestionIndex] !== undefined) {
        setSelectedAnswer(parsedAnswers[currentQuestionIndex]);
      }
    }
  }, [quiz.id, currentQuestionIndex]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`quiz-answers-${quiz.id}`, JSON.stringify(answers));
      // Save progress metadata for Jump Back In
      const progress = {
        quizId: quiz.id,
        lesson: quiz.lesson,
        quizType: quiz.quizType,
        totalQuestions: totalQuestions,
        answeredCount: Object.keys(answers).length,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`quiz-progress-${quiz.id}`, JSON.stringify(progress));
    }
  }, [answers, quiz.id]);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    }

    // Fetch student profile
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/students/profile');
        if (res.ok) {
          const data = await res.json();
          setStudentProfile(data.profile);
        }
      } catch (err) {
        console.error('Error fetching student profile:', err);
      }
    };
    fetchProfile();

    return () => clearInterval(timer);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // Load the answer for the next question
      const nextAnswer = answers[currentQuestionIndex + 1];
      setSelectedAnswer(nextAnswer !== undefined ? nextAnswer : null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Load the answer for the previous question
      const prevAnswer = answers[currentQuestionIndex - 1];
      setSelectedAnswer(prevAnswer !== undefined ? prevAnswer : null);
    }
  };

  const handleAnswerSelect = (index) => {
    setSelectedAnswer(index);
    // Save the answer
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: index
    }));
  };

  const handleBack = () => {
    router.push("/student/quizzes");
  };

  if (!mounted || !currentTime) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${!sidebarOpen ? 'sidebar-hidden' : ''}`}>
      <StudentSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTime={currentTime}
      />

      {/* Main Content */}
      <main className="main-content flex flex-col justify-between min-h-screen">
        <StudentHeader darkMode={darkMode} setDarkMode={setDarkMode} studentProfile={studentProfile} />
        
        {/* Quiz Content */}
        <div className="quiz-content-main">
          {/* Quiz Header */}
          <div className="quiz-header-section">
            <div className="quiz-type-dropdown">
              <span className="quiz-type-icon">📝</span>
              <span className="quiz-type-text">MCQ</span>
            </div>
            <div className="quiz-progress">
              {currentQuestionIndex + 1} / {totalQuestions}
            </div>
            <button className="quiz-back-btn" onClick={handleBack}>
              Back
            </button>
          </div>

          {/* Quiz Title */}
          <h1 className="quiz-title">{quiz.title || quiz.lesson}</h1>

          {/* MCQ Container */}
          <div className="mcq-container">
            {/* Question Card */}
            <div className="mcq-question-card">
              <h2 className="mcq-question">{currentQuestion.question}</h2>
              
              {/* Options Grid */}
              <div className="mcq-options-grid">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    className={`mcq-option ${selectedAnswer === index ? 'selected' : ''}`}
                    onClick={() => handleAnswerSelect(index)}
                  >
                    <span className="option-number">{String.fromCharCode(65 + index)}</span>
                    <span className="option-text">{option}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="quiz-navigation">
              <button 
                className="nav-button prev"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                <FaArrowLeft />
              </button>
              {currentQuestionIndex === totalQuestions - 1 ? (
                <button 
                  className="submit-quiz-btn"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const res = await fetch(`/api/students/quizzes/${quiz.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ answers, startedAt: quizStartedAt }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        // Clear saved answers from localStorage and reset state for next attempt
                        localStorage.removeItem(`quiz-answers-${quiz.id}`);
                        localStorage.removeItem(`quiz-progress-${quiz.id}`);
                        setAnswers({});
                        setSelectedAnswer(null);
                        setCurrentQuestionIndex(0);
                        // Track activity for streak
                        trackActivity('quiz_completed');
                        const attemptLabel = data.attempt.isFirstAttempt ? '1st Attempt' : 'Retry (10% XP)';
                        // Store results for answer review modal
                        setQuizResults({
                          results: data.attempt.results,
                          score: data.attempt.score,
                          totalQuestions: data.attempt.totalQuestions,
                          accuracy: data.attempt.accuracy,
                          xpEarned: data.attempt.xpEarned,
                          attemptLabel,
                        });
                        // Show review modal first, then success message
                        setReviewModalOpen(true);
                      } else {
                        setModalInfo({ isOpen: true, title: "Error", message: data.error || 'Failed to submit quiz.', type: "error" });
                        setSubmitting(false);
                      }
                    } catch (err) {
                      console.error('Submit error:', err);
                      setModalInfo({ isOpen: true, title: "Error", message: "Something went wrong. Please try again.", type: "error" });
                      setSubmitting(false);
                    }
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              ) : (
                <button 
                  className="nav-button next"
                  onClick={handleNext}
                >
                  <FaArrowRight />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => {
          setModalInfo({ ...modalInfo, isOpen: false });
          if (shouldRedirect) {
            router.push('/student/quizzes');
          }
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />

      {quizResults && (
        <AnswerReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            // Show success message after review
            setModalInfo({
              isOpen: true,
              title: "Quiz Submitted!",
              message: `Score: ${quizResults.score}/${quizResults.totalQuestions} (${quizResults.accuracy}%)\n${quizResults.attemptLabel}\nXP Earned: +${quizResults.xpEarned} XP`,
              type: "success"
            });
            setShouldRedirect(true);
          }}
          quizType="MCQ"
          questions={questions.questions}
          results={quizResults.results}
          score={quizResults.score}
          totalQuestions={quizResults.totalQuestions}
          accuracy={quizResults.accuracy}
          xpEarned={quizResults.xpEarned}
          attemptLabel={quizResults.attemptLabel}
        />
      )}
    </div>
  );
}
