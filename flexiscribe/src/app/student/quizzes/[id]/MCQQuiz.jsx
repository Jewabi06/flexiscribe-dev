"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import UserMenu from "@/components/student/ui/UserMenu";
import NotificationMenu from "@/components/student/ui/NotificationMenu";
import SearchBar from "@/components/student/ui/SearchBar";
import MessageModal from "@/components/shared/MessageModal";
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
      <div className="dashboard-container">
        <aside className="sidebar">
          <div className="logo-section">
            <img src="/img/fLexiScribe-logo.png" alt="Logo" className="h-16 w-16" />
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-bold">fLexiScribe</h1>
              <p className="text-xs font-normal">Your Note-Taking Assistant</p>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();

  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const dateString = currentTime.toLocaleDateString('en-US', {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={`dashboard-container ${!sidebarOpen ? 'sidebar-hidden' : ''}`}>
      {/* Sidebar Toggle Button - Now visible on all screen sizes */}
      <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="logo-section">
          <div className="logo-content">
            <img src="/img/fLexiScribe-logo.png" alt="Logo" className="h-16 w-16" />
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-bold">fLexiScribe</h1>
              <p className="text-xs font-normal">Your Note-Taking Assistant</p>
            </div>
          </div>
        </div>

        <nav className="nav-menu">
          <div className="nav-item" onClick={() => router.push('/student/dashboard')}>
            <FaHome className="nav-icon" />
            <span>Dashboard</span>
          </div>
          <div className="nav-item" onClick={() => router.push('/student/reviewers')}>
            <FaBook className="nav-icon" />
            <span>Reviewers</span>
          </div>
          <div className="nav-item active" onClick={() => router.push('/student/quizzes')}>
            <FaGamepad className="nav-icon" />
            <span>Quizzes</span>
          </div>
          <div className="nav-item" onClick={() => router.push('/student/leaderboard')}>
            <FaTrophy className="nav-icon" />
            <span>Leaderboard</span>
          </div>
        </nav>

        <div className="clock-widget">
          <svg className="clock-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
              <line
                key={angle}
                x1="50"
                y1="10"
                x2="50"
                y2="15"
                stroke="white"
                strokeWidth="2"
                transform={`rotate(${angle} 50 50)`}
              />
            ))}
            <line
              className="hour-hand"
              x1="50"
              y1="50"
              x2="50"
              y2="30"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${hourAngle} 50 50)`}
            />
            <line
              className="minute-hand"
              x1="50"
              y1="50"
              x2="50"
              y2="20"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${minuteAngle} 50 50)`}
            />
            <line
              className="second-hand"
              x1="50"
              y1="50"
              x2="50"
              y2="15"
              stroke="var(--accent-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${secondAngle} 50 50)`}
            />
            <circle cx="50" cy="50" r="3" fill="white" />
          </svg>
          <div className="clock-time">{timeString}</div>
          <div className="clock-date">{dateString}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content flex flex-col justify-between min-h-screen">
        {/* Header */}
        <header className="dashboard-header">
          <SearchBar />
          <div className="header-actions">
            <button className="theme-toggle-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            <NotificationMenu />
            <UserMenu userName={studentProfile?.username || 'Student'} userRole={studentProfile?.role || 'Student'} userAvatar={studentProfile?.avatar} />
          </div>
        </header>
        
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
          <h1 className="quiz-title">{quiz.lesson}</h1>

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
                    <span className="option-number">{index + 1}</span>
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
                        // Clear saved answers from localStorage
                        localStorage.removeItem(`quiz-answers-${quiz.id}`);
                        localStorage.removeItem(`quiz-progress-${quiz.id}`);
                        // Track activity for streak
                        trackActivity('quiz_completed');
                        const attemptLabel = data.attempt.isFirstAttempt ? '1st Attempt' : 'Retry (10% XP)';
                        setModalInfo({ isOpen: true, title: "Quiz Submitted!", message: `Score: ${data.attempt.score}/${data.attempt.totalQuestions} (${data.attempt.accuracy}%)\n${attemptLabel}\nXP Earned: +${data.attempt.xpEarned} XP`, type: "success" });
                        setShouldRedirect(true);
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
          if (shouldRedirect) router.push('/student/quizzes');
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}
