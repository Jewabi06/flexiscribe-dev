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

export default function FillInQuiz({ quiz, questions }) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
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
  const inputRef = useRef(null);

  // Auto-focus the answer input when the question changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentQuestionIndex]);

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
      // Set the user answer for current question if it exists
      if (parsedAnswers[currentQuestionIndex] !== undefined) {
        setUserAnswer(parsedAnswers[currentQuestionIndex]);
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
      setUserAnswer(nextAnswer !== undefined ? nextAnswer : "");    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      // Load the answer for the previous question
      const prevAnswer = answers[currentQuestionIndex - 1];
      setUserAnswer(prevAnswer !== undefined ? prevAnswer : "");
    }
  };

  const handleAnswerChange = (value) => {
    setUserAnswer(value);
    // Save the answer
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: value
    }));
  };

  const handleBack = () => {
    router.push("/student/quizzes");
  };

  // Split the question by the blank (represented by __________)
  const renderQuestion = () => {
    const parts = currentQuestion.question.split("__________");
    return (
      <div className="fill-in-question">
        {parts[0]}
        <input
          ref={inputRef}
          type="text"
          className="fill-in-input"
          value={userAnswer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Type your answer"
        />
        {parts[1]}
      </div>
    );
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
              <span className="quiz-type-icon">✏️</span>
              <span className="quiz-type-text">Fill-in</span>
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

          {/* Fill-in Container */}
          <div className="fillin-container">
            {/* Question Card */}
            <div className="fillin-question-card">
              {renderQuestion()}
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
                        localStorage.removeItem(`quiz-answers-${quiz.id}`);
                        localStorage.removeItem(`quiz-progress-${quiz.id}`);
                        setAnswers({});
                        setUserAnswer("");
                        setCurrentQuestionIndex(0);
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
          quizType="FILL_IN_BLANK"
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
