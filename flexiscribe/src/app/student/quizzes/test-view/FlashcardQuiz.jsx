"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import "../../dashboard/styles.css";
import "./quiz-styles.css";

export default function FlashcardQuiz({ quiz, questions }) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions.questions[currentQuestionIndex];
  const totalQuestions = questions.questions.length;

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

    return () => clearInterval(timer);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => setIsFlipped(!isFlipped);
  const handleBack = () => router.push("/student/quizzes/test");

  const handleComplete = () => {
    setShowResults(true);
  };

  if (showResults) {
    return (
      <div className={`dashboard-container ${!sidebarOpen ? 'sidebar-hidden' : ''}`}>
        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>{sidebarOpen ? <FaTimes /> : <FaBars />}</button>
        {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
        
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
            <div className="nav-item" onClick={() => router.push('/student/dashboard')}><FaHome className="nav-icon" /><span>Dashboard</span></div>
            <div className="nav-item" onClick={() => router.push('/student/reviewers')}><FaBook className="nav-icon" /><span>Reviewers</span></div>
            <div className="nav-item active" onClick={() => router.push('/student/quizzes')}><FaGamepad className="nav-icon" /><span>Quizzes</span></div>
            <div className="nav-item" onClick={() => router.push('/student/leaderboard')}><FaTrophy className="nav-icon" /><span>Leaderboard</span></div>
          </nav>
          <div className="clock-widget">
            <svg className="clock-svg" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2" />
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
                <line key={angle} x1="50" y1="10" x2="50" y2="15" stroke="white" strokeWidth="2" transform={`rotate(${angle} 50 50)`} />
              ))}
              <line className="hour-hand" x1="50" y1="50" x2="50" y2="30" stroke="white" strokeWidth="3" strokeLinecap="round" transform={`rotate(${hourAngle} 50 50)`} />
              <line className="minute-hand" x1="50" y1="50" x2="50" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" transform={`rotate(${minuteAngle} 50 50)`} />
              <line className="second-hand" x1="50" y1="50" x2="50" y2="15" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${secondAngle} 50 50)`} />
              <circle cx="50" cy="50" r="3" fill="white" />
            </svg>
            <div className="clock-time">{timeString}</div>
            <div className="clock-date">{dateString}</div>
          </div>
        </aside>

        <main className="main-content flex flex-col justify-between min-h-screen">
          <header className="dashboard-header">
            <div style={{ flex: 1 }}></div>
            <div className="header-actions">
              <button className="theme-toggle-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                {darkMode ? <FaSun /> : <FaMoon />}
              </button>
            </div>
          </header>
          
          <div className="quiz-content-main">
            <div style={{textAlign: 'center', padding: '48px 24px'}}>
              <h1 style={{fontSize: '48px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--brand-primary)'}}>🎉 Review Complete!</h1>
              
              <div style={{background: 'linear-gradient(135deg, var(--brand-secondary) 0%, var(--brand-primary) 100%)', borderRadius: '24px', padding: '48px', marginBottom: '32px', color: 'white'}}>
                <div style={{fontSize: '72px', marginBottom: '16px'}}>🃏</div>
                <div style={{fontSize: '48px', fontWeight: 'bold', marginBottom: '16px'}}>{totalQuestions}</div>
                <div style={{fontSize: '24px', marginBottom: '8px'}}>Flashcards Reviewed</div>
                <div style={{fontSize: '20px', opacity: 0.9}}>🌟 Great work studying!</div>
              </div>

              <div style={{textAlign: 'left', maxWidth: '900px', margin: '0 auto'}}>
                <h2 style={{fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', color: 'var(--text-primary)'}}>Flashcard Summary</h2>
                {questions.questions.map((q, index) => (
                  <div key={index} style={{background: 'rgba(157, 138, 219, 0.1)', border: '2px solid var(--brand-primary)', borderRadius: '16px', padding: '24px', marginBottom: '16px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                      <span style={{fontSize: '24px'}}>🃏</span>
                      <span style={{fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)'}}>Card {index + 1}</span>
                    </div>
                    <div style={{marginLeft: '36px'}}>
                      <p style={{marginBottom: '12px', color: 'var(--text-primary)'}}>
                        <strong>Front:</strong> {q.front}
                      </p>
                      <p style={{marginBottom: '12px', color: 'var(--text-secondary)'}}>
                        <strong>Back:</strong> {q.back}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{marginTop: '48px', display: 'flex', gap: '16px', justifyContent: 'center'}}>
                <button className="submit-quiz-btn" onClick={handleBack} style={{background: 'var(--brand-primary)'}}>Back to Test Page</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!mounted || !currentTime) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;
  const timeString = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateString = currentTime.toLocaleDateString('en-US', { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className={`dashboard-container ${!sidebarOpen ? 'sidebar-hidden' : ''}`}>
      <button className="sidebar-toggle-btn" onClick={toggleSidebar}>{sidebarOpen ? <FaTimes /> : <FaBars />}</button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
      
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
          <div className="nav-item" onClick={() => router.push('/student/dashboard')}><FaHome className="nav-icon" /><span>Dashboard</span></div>
          <div className="nav-item" onClick={() => router.push('/student/reviewers')}><FaBook className="nav-icon" /><span>Reviewers</span></div>
          <div className="nav-item active" onClick={() => router.push('/student/quizzes')}><FaGamepad className="nav-icon" /><span>Quizzes</span></div>
          <div className="nav-item" onClick={() => router.push('/student/leaderboard')}><FaTrophy className="nav-icon" /><span>Leaderboard</span></div>
        </nav>
        <div className="clock-widget">
          <svg className="clock-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
              <line key={angle} x1="50" y1="10" x2="50" y2="15" stroke="white" strokeWidth="2" transform={`rotate(${angle} 50 50)`} />
            ))}
            <line className="hour-hand" x1="50" y1="50" x2="50" y2="30" stroke="white" strokeWidth="3" strokeLinecap="round" transform={`rotate(${hourAngle} 50 50)`} />
            <line className="minute-hand" x1="50" y1="50" x2="50" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" transform={`rotate(${minuteAngle} 50 50)`} />
            <line className="second-hand" x1="50" y1="50" x2="50" y2="15" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${secondAngle} 50 50)`} />
            <circle cx="50" cy="50" r="3" fill="white" />
          </svg>
          <div className="clock-time">{timeString}</div>
          <div className="clock-date">{dateString}</div>
        </div>
      </aside>

      <main className="main-content flex flex-col justify-between min-h-screen">
        <header className="dashboard-header">
          <div style={{ flex: 1 }}></div>
          <div className="header-actions">
            <button className="theme-toggle-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </header>
        
        <div className="quiz-content-main">
          <div className="quiz-header-section">
            <div className="quiz-type-dropdown"><span className="quiz-type-icon">🃏</span><span className="quiz-type-text">Flashcards</span></div>
            <div className="quiz-progress">{currentQuestionIndex + 1} / {totalQuestions}</div>
            <button className="quiz-back-btn" onClick={handleBack}>Back to Test</button>
          </div>

          <h1 className="quiz-title">{quiz.lesson}</h1>

          <div className="flashcard-container">
            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="flashcard-content">{currentQuestion.front}</div>
                  <div className="flashcard-flip-instruction">Click card to flip.</div>
                </div>
                <div className="flashcard-back">
                  <div className="flashcard-content">{currentQuestion.back}</div>
                  <div className="flashcard-flip-instruction">Click card to flip.</div>
                </div>
              </div>
            </div>

            <div className="flashcard-navigation">
              <button className="nav-button prev" onClick={handlePrevious} disabled={currentQuestionIndex === 0}><FaArrowLeft /></button>
              {currentQuestionIndex === totalQuestions - 1 ? (
                <button className="submit-quiz-btn" onClick={handleComplete}>
                  Complete Review
                </button>
              ) : (
                <button className="nav-button next" onClick={handleNext}><FaArrowRight /></button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
