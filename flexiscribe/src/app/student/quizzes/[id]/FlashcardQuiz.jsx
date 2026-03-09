"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import MessageModal from "@/components/shared/MessageModal";
import FlashcardReviewModal from "@/components/shared/FlashcardReviewModal";
import "../../dashboard/styles.css";
import "./quiz-styles.css";
import { trackActivity } from "../../../../utils/student";

export default function FlashcardQuiz({ quiz, questions }) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [flippedStates, setFlippedStates] = useState({});
  const [studentProfile, setStudentProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [quizStartedAt] = useState(() => new Date().toISOString());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [attemptData, setAttemptData] = useState(null);

  const currentQuestion = questions.questions[currentQuestionIndex];
  const totalQuestions = questions.questions.length;
  const flippedStatesRef = useRef(flippedStates);

  // Keep ref in sync for unmount/tab-change saves
  useEffect(() => { flippedStatesRef.current = flippedStates; }, [flippedStates]);

  // Save progress on page unload, tab switch, or navigation away
  useEffect(() => {
    const saveProgress = () => {
      const currentStates = flippedStatesRef.current;
      if (Object.keys(currentStates).length > 0) {
        localStorage.setItem(`quiz-flipped-${quiz.id}`, JSON.stringify(currentStates));
        localStorage.setItem(`quiz-progress-${quiz.id}`, JSON.stringify({
          quizId: quiz.id,
          lesson: quiz.lesson,
          quizType: quiz.quizType,
          totalQuestions,
          answeredCount: Object.keys(currentStates).length,
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

  // Load saved flipped states from localStorage (only on mount / quiz change)
  useEffect(() => {
    const savedStates = localStorage.getItem(`quiz-flipped-${quiz.id}`);
    if (savedStates) {
      setFlippedStates(JSON.parse(savedStates));
    }
  }, [quiz.id]);

  // Reset flip to front whenever the card index changes
  useEffect(() => {
    setIsFlipped(false);
  }, [currentQuestionIndex]);

  // Save flipped states to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(flippedStates).length > 0) {
      localStorage.setItem(`quiz-flipped-${quiz.id}`, JSON.stringify(flippedStates));
      // Save progress metadata for Jump Back In
      const progress = {
        quizId: quiz.id,
        lesson: quiz.lesson,
        quizType: quiz.quizType,
        totalQuestions: totalQuestions,
        answeredCount: Object.keys(flippedStates).length,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`quiz-progress-${quiz.id}`, JSON.stringify(progress));
    }
  }, [flippedStates, quiz.id]);

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
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleFlip = () => {
    const newFlippedState = !isFlipped;
    setIsFlipped(newFlippedState);
    // Save the flipped state
    setFlippedStates(prev => ({
      ...prev,
      [currentQuestionIndex]: newFlippedState
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
              <span className="quiz-type-icon">🃏</span>
              <span className="quiz-type-text">Flashcards</span>
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

          {/* Flashcard Container */}
          <div className="flashcard-container">
            {/* Flashcard */}
            <div 
              className={`flashcard ${isFlipped ? 'flipped' : ''}`}
              onClick={handleFlip}
            >
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="flashcard-content">
                    {currentQuestion.front}
                  </div>
                  <div className="flashcard-flip-instruction">
                    Click card to flip.
                  </div>
                </div>
                <div className="flashcard-back">
                  <div className="flashcard-content">
                    {currentQuestion.back}
                  </div>
                  <div className="flashcard-flip-instruction">
                    Click card to flip.
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flashcard-navigation">
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
                        body: JSON.stringify({ answers: {}, startedAt: quizStartedAt }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        localStorage.removeItem(`quiz-flipped-${quiz.id}`);
                        localStorage.removeItem(`quiz-progress-${quiz.id}`);
                        setFlippedStates({});
                        setIsFlipped(false);
                        setCurrentQuestionIndex(0);
                        trackActivity('flashcard_session');
                        setAttemptData(data.attempt);
                        setShowReviewModal(true);
                      } else {
                        setModalInfo({ isOpen: true, title: "Error", message: data.error || 'Failed to submit review.', type: "error" });
                        setSubmitting(false);
                      }
                    } catch (err) {
                      console.error('Submit error:', err);
                      setModalInfo({ isOpen: true, title: "Error", message: "Something went wrong. Please try again.", type: "error" });
                      setSubmitting(false);
                    }
                  }}
                >
                  {submitting ? 'Submitting...' : 'Complete Review'}
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

      <FlashcardReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          if (attemptData) {
            const attemptLabel = attemptData.isFirstAttempt ? '1st Attempt' : 'Retry (10% XP)';
            setModalInfo({ isOpen: true, title: "Flashcards Reviewed!", message: `${attemptLabel}\nXP Earned: +${attemptData.xpEarned} XP`, type: "success" });
            setShouldRedirect(true);
          }
        }}
        flashcards={questions.questions.map(q => ({ front: q.front, back: q.back }))}
        title={quiz.title || quiz.lesson}
      />

      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => {
          setModalInfo({ ...modalInfo, isOpen: false });
          if (shouldRedirect) router.push('/student/quizzes');
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}
