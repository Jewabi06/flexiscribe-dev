"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaChevronDown } from "react-icons/fa";
import UserMenu from "@/components/student/ui/UserMenu";
import NotificationMenu from "@/components/student/ui/NotificationMenu";
import SearchBar from "@/components/student/ui/SearchBar";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "../dashboard/styles.css";
import "./styles.css";

export default function QuizzesPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sortedQuizzes, setSortedQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState(null);
  
  // Quiz generation states
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState("");
  const [selectedQuizType, setSelectedQuizType] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedNumQuestions, setSelectedNumQuestions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dropdown states
  const [lessonDropdownOpen, setLessonDropdownOpen] = useState(false);
  const [quizTypeDropdownOpen, setQuizTypeDropdownOpen] = useState(false);
  const [difficultyDropdownOpen, setDifficultyDropdownOpen] = useState(false);
  const [numQuestionsDropdownOpen, setNumQuestionsDropdownOpen] = useState(false);
  
  // Refs for dropdowns
  const lessonDropdownRef = useRef(null);
  const quizTypeDropdownRef = useRef(null);
  const difficultyDropdownRef = useRef(null);
  const numQuestionsDropdownRef = useRef(null);
  
  const quizTypes = [
    { value: "MCQ", label: "Multiple Choice" },
    { value: "FILL_IN_BLANK", label: "Fill in the Blanks" },
    { value: "FLASHCARD", label: "Flashcards" }
  ];

  const difficulties = [
    { value: "EASY", label: "Easy" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HARD", label: "Hard" }
  ];
  
  const questionNumbers = [10, 15, 20, 25, 30];

  const [showGeneratedNotification, setShowGeneratedNotification] = useState(false);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [generatedQuizInfo, setGeneratedQuizInfo] = useState(null);
  const [hasEnrolledClasses, setHasEnrolledClasses] = useState(false);

  // Fetch available lessons
  useEffect(() => {
    async function fetchLessons() {
      try {
        const response = await fetch('/api/quizzes/generate');
        if (!response.ok) {
          console.error('Lessons fetch failed with status:', response.status);
          return;
        }
        const data = await response.json();
        if (data.success) {
          setLessons(data.lessons);
        }
      } catch (error) {
        console.error('Error fetching lessons:', error);
      }
    }
    fetchLessons();
  }, []);

  // Check if student has enrolled classes
  useEffect(() => {
    async function checkEnrollment() {
      try {
        const response = await fetch('/api/students/classes');
        if (response.ok) {
          const data = await response.json();
          setHasEnrolledClasses(data.classes && data.classes.length > 0);
        }
      } catch (error) {
        console.error('Error checking enrollment:', error);
      }
    }
    checkEnrollment();
  }, []);

  // Fetch real quizzes from API
  useEffect(() => {
    async function fetchQuizzes() {
      try {
        setQuizzesLoading(true);
        const response = await fetch('/api/students/quizzes');
        if (!response.ok) {
          console.error('Quizzes fetch failed with status:', response.status);
          setQuizzesLoading(false);
          return;
        }
        const data = await response.json();
        if (data.success) {
          // Merge with localStorage access times and sort
          const savedAccessTimes = JSON.parse(localStorage.getItem('quizAccessTimes') || '{}');
          const quizzesWithTimes = data.quizzes.map(quiz => ({
            ...quiz,
            lastAccessedDate: savedAccessTimes[quiz.id] || quiz.lastAccessedDate
          }));
          const sorted = [...quizzesWithTimes].sort((a, b) => {
            const dateA = new Date(a.lastAccessedDate);
            const dateB = new Date(b.lastAccessedDate);
            return dateB - dateA;
          });
          setSortedQuizzes(sorted);
        }
      } catch (error) {
        console.error('Error fetching quizzes:', error);
      } finally {
        setQuizzesLoading(false);
      }
    }
    fetchQuizzes();
  }, []);

  useEffect(() => {
    // Check if a quiz was just generated
    const quizGenerated = localStorage.getItem('quiz-generated');
    if (quizGenerated) {
      const info = JSON.parse(quizGenerated);
      setGeneratedQuizInfo(info);
      setShowGeneratedNotification(true);
      
      // Remove the flag
      localStorage.removeItem('quiz-generated');
      
      // Hide notification after 5 seconds
      setTimeout(() => {
        setShowGeneratedNotification(false);
      }, 5000);
    }
  }, []);

  useEffect(() => {
    // Set initial time on mount
    setMounted(true);
    setCurrentTime(new Date());
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    }

    // Fetch student profile from database
    const fetchStudentProfile = async () => {
      try {
        const response = await fetch('/api/students/profile');
        if (response.ok) {
          const data = await response.json();
          setStudentProfile(data.profile);
        } else {
          console.error('Failed to fetch student profile');
        }
      } catch (error) {
        console.error('Error fetching student profile:', error);
      }
    };

    fetchStudentProfile();

    return () => clearInterval(timer);
  }, []);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (lessonDropdownRef.current && !lessonDropdownRef.current.contains(event.target)) {
        setLessonDropdownOpen(false);
      }
      if (quizTypeDropdownRef.current && !quizTypeDropdownRef.current.contains(event.target)) {
        setQuizTypeDropdownOpen(false);
      }
      if (difficultyDropdownRef.current && !difficultyDropdownRef.current.contains(event.target)) {
        setDifficultyDropdownOpen(false);
      }
      if (numQuestionsDropdownRef.current && !numQuestionsDropdownRef.current.contains(event.target)) {
        setNumQuestionsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

  const handleGenerateQuiz = async () => {
    if (!hasEnrolledClasses) {
      setModalInfo({ isOpen: true, title: "No Class Enrolled", message: "You must join a class before generating quizzes. Go to the Reviewers tab and enter a class code to join.", type: "error" });
      return;
    }
    if (selectedLesson && selectedQuizType && selectedDifficulty && selectedNumQuestions) {
      setIsGenerating(true);
      try {
        const response = await fetch('/api/quizzes/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lessonId: selectedLesson,
            type: selectedQuizType,
            difficulty: selectedDifficulty,
            count: selectedNumQuestions,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Store quiz info for notification
          localStorage.setItem('quiz-generated', JSON.stringify({
            type: data.quiz.type,
            difficulty: data.quiz.difficulty,
            count: data.quiz.totalQuestions,
          }));

          // Navigate to the generated quiz
          router.push(`/student/quizzes/${data.quiz.id}`);
        } else {
          setModalInfo({ isOpen: true, title: "Generation Failed", message: `Failed to generate quiz: ${data.error || 'Unknown error'}\n${data.details || ''}`, type: "error" });
        }
      } catch (error) {
        console.error('Error generating quiz:', error);
        setModalInfo({ isOpen: true, title: "Connection Error", message: "Failed to generate quiz. Please ensure Ollama is running and try again.", type: "error" });
      } finally {
        setIsGenerating(false);
      }
    } else {
      setModalInfo({ isOpen: true, title: "Missing Fields", message: "Please fill in all fields to generate a quiz.", type: "info" });
    }
  };

  const handleQuizClick = (quiz) => {
    console.log("Opening quiz:", quiz);
    
    // Update last accessed time
    const now = new Date().toISOString();
    const savedAccessTimes = JSON.parse(localStorage.getItem('quizAccessTimes') || '{}');
    savedAccessTimes[quiz.id] = now;
    localStorage.setItem('quizAccessTimes', JSON.stringify(savedAccessTimes));
    
    // Update sorted quizzes to reflect new access time
    const updatedQuizzes = sortedQuizzes.map(q => 
      q.id === quiz.id ? { ...q, lastAccessedDate: now } : q
    );
    const sorted = [...updatedQuizzes].sort((a, b) => {
      const dateA = new Date(a.lastAccessedDate);
      const dateB = new Date(b.lastAccessedDate);
      return dateB - dateA;
    });
    setSortedQuizzes(sorted);
    
    // Navigate to quiz detail/result page
    router.push(`/student/quizzes/${quiz.id}`);
  };

  // Don't render clock until mounted to avoid hydration mismatch
  // Don't render until mounted and data is loaded to avoid flash of default data
  if (!mounted || !currentTime || quizzesLoading) {
    return <LoadingScreen />;
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
    <div className="dashboard-container">
      {/* Mobile Menu Toggle Button */}
      <button className="mobile-menu-toggle" onClick={toggleSidebar}>
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
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
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
            {/* Hour markers */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
              (angle) => (
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
              )
            )}
            {/* Hour hand */}
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
            {/* Minute hand */}
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
            {/* Second hand */}
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
            {/* Center dot */}
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
            {/* Theme Toggle Button */}
            <button className="theme-toggle-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            
            <NotificationMenu />
            
            <UserMenu userName={studentProfile?.username || 'Student'} userRole={studentProfile?.role || 'Student'} userAvatar={studentProfile?.avatar} />
          </div>
        </header>
        
        {/* Quizzes Content */}
        <div className="quizzes-content">
          {/* Quiz Generated Notification */}
          {showGeneratedNotification && generatedQuizInfo && (
            <div className="quiz-generated-notification">
              <div className="quiz-notification-icon">✓</div>
              <div className="notification-content">
                <h4>Quiz Generated Successfully!</h4>
                {/* <p>A new quiz has been generated from "{generatedQuizInfo.reviewerTitle}" in {generatedQuizInfo.classCode}</p> */}
              </div>
              <button 
                className="notification-close"
                onClick={() => setShowGeneratedNotification(false)}
              >
                ×
              </button>
            </div>
          )}

          {/* Generate Quiz Section */}
          <div className="generate-quiz-section">
            <h2 className="generate-quiz-title">Generate Quiz from Lesson</h2>
            <div className="generate-quiz-form">
              {/* Lesson Dropdown */}
              <div className="quiz-input-group" ref={lessonDropdownRef}>
                <label className="quiz-input-label">Lesson</label>
                <div 
                  className="quiz-dropdown-trigger"
                  onClick={() => {
                    setLessonDropdownOpen(!lessonDropdownOpen);
                    setQuizTypeDropdownOpen(false);
                    setDifficultyDropdownOpen(false);
                    setNumQuestionsDropdownOpen(false);
                  }}
                >
                  <span className={!selectedLesson ? "quiz-placeholder" : ""}>
                    {selectedLesson 
                      ? lessons.find(l => l.id === selectedLesson)?.title 
                      : "Select a lesson"}
                  </span>
                  <FaChevronDown className={`quiz-dropdown-icon ${lessonDropdownOpen ? 'open' : ''}`} />
                </div>
                {lessonDropdownOpen && (
                  <div className="quiz-dropdown-menu">
                    {lessons.length === 0 ? (
                      <div className="quiz-dropdown-item disabled">No lessons available</div>
                    ) : (
                      lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`quiz-dropdown-item ${selectedLesson === lesson.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedLesson(lesson.id);
                            setLessonDropdownOpen(false);
                          }}
                        >
                          <div>{lesson.title}</div>
                          <div className="transcript-meta">
                            {lesson.subject}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quiz Type Dropdown */}
              <div className="quiz-input-group" ref={quizTypeDropdownRef}>
                <label className="quiz-input-label">Type of Quiz</label>
                <div 
                  className="quiz-dropdown-trigger"
                  onClick={() => {
                    setQuizTypeDropdownOpen(!quizTypeDropdownOpen);
                    setLessonDropdownOpen(false);
                    setDifficultyDropdownOpen(false);
                    setNumQuestionsDropdownOpen(false);
                  }}
                >
                  <span className={!selectedQuizType ? "quiz-placeholder" : ""}>
                    {selectedQuizType ? quizTypes.find(qt => qt.value === selectedQuizType)?.label : "Select quiz type"}
                  </span>
                  <FaChevronDown className={`quiz-dropdown-icon ${quizTypeDropdownOpen ? 'open' : ''}`} />
                </div>
                {quizTypeDropdownOpen && (
                  <div className="quiz-dropdown-menu">
                    {quizTypes.map((type) => (
                      <div
                        key={type.value}
                        className={`quiz-dropdown-item ${selectedQuizType === type.value ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedQuizType(type.value);
                          setQuizTypeDropdownOpen(false);
                        }}
                      >
                        {type.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Difficulty Dropdown */}
              <div className="quiz-input-group" ref={difficultyDropdownRef}>
                <label className="quiz-input-label">Difficulty</label>
                <div 
                  className="quiz-dropdown-trigger"
                  onClick={() => {
                    setDifficultyDropdownOpen(!difficultyDropdownOpen);
                    setLessonDropdownOpen(false);
                    setQuizTypeDropdownOpen(false);
                    setNumQuestionsDropdownOpen(false);
                  }}
                >
                  <span className={!selectedDifficulty ? "quiz-placeholder" : ""}>
                    {selectedDifficulty ? difficulties.find(d => d.value === selectedDifficulty)?.label : "Select difficulty"}
                  </span>
                  <FaChevronDown className={`quiz-dropdown-icon ${difficultyDropdownOpen ? 'open' : ''}`} />
                </div>
                {difficultyDropdownOpen && (
                  <div className="quiz-dropdown-menu">
                    {difficulties.map((difficulty) => (
                      <div
                        key={difficulty.value}
                        className={`quiz-dropdown-item ${selectedDifficulty === difficulty.value ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedDifficulty(difficulty.value);
                          setDifficultyDropdownOpen(false);
                        }}
                      >
                        {difficulty.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Number of Questions Dropdown */}
              <div className="quiz-input-group" ref={numQuestionsDropdownRef}>
                <label className="quiz-input-label">No. of Questions</label>
                <div 
                  className="quiz-dropdown-trigger"
                  onClick={() => {
                    setNumQuestionsDropdownOpen(!numQuestionsDropdownOpen);
                    setLessonDropdownOpen(false);
                    setQuizTypeDropdownOpen(false);
                    setDifficultyDropdownOpen(false);
                  }}
                >
                  <span className={!selectedNumQuestions ? "quiz-placeholder" : ""}>
                    {selectedNumQuestions || "Select number"}
                  </span>
                  <FaChevronDown className={`quiz-dropdown-icon ${numQuestionsDropdownOpen ? 'open' : ''}`} />
                </div>
                {numQuestionsDropdownOpen && (
                  <div className="quiz-dropdown-menu">
                    {questionNumbers.map((num) => (
                      <div
                        key={num}
                        className={`quiz-dropdown-item ${selectedNumQuestions === num ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedNumQuestions(num);
                          setNumQuestionsDropdownOpen(false);
                        }}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                className="generate-quiz-btn" 
                onClick={handleGenerateQuiz}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating Quiz...' : 'Generate Quiz'}
              </button>
            </div>
          </div>

          {/* Recent Quizzes Section */}
          <div className="section-container">
            <h2 className="section-title">Recent</h2>
            {quizzesLoading ? (
              <div className="quizzes-loading">Loading quizzes...</div>
            ) : sortedQuizzes.length === 0 ? (
              <div className="quizzes-empty">No quizzes yet. Generate one from a lesson above!</div>
            ) : (
              <div className="quizzes-grid">
                {sortedQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="quiz-card"
                    onClick={() => handleQuizClick(quiz)}
                  >
                    <div className="quiz-meta-badges">
                      <div className="quiz-questions-badge">
                        {quiz.numQuestions} Qs
                      </div>
                      <div className={`quiz-type-badge type-${quiz.quizType.toLowerCase()}`}>
                        {quiz.quizType}
                      </div>
                    </div>
                    <h3 className="quiz-card-title">{quiz.lesson}</h3>
                    <div className="quiz-card-footer">
                      <div className="quiz-accuracy-label">Accuracy</div>
                      <div className="quiz-accuracy-bar-container">
                        <div 
                          className="quiz-accuracy-bar"
                          style={{ width: `${quiz.accuracy}%` }}
                        ></div>
                      </div>
                      <div className="quiz-accuracy-percentage">{quiz.accuracy}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}
