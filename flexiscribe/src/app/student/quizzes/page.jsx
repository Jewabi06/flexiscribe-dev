"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaChevronDown } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import useQuizGeneration from "@/hooks/useQuizGeneration";
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

  // Persistent quiz generation state (survives tab navigation)
  const { isGenerating, progress: genProgress, selectionValues, result: genResult, generate: startGeneration, clearResult: clearGenResult } = useQuizGeneration();

  // Restore dropdown values from the persisted generation state on remount
  useEffect(() => {
    if (isGenerating && selectionValues) {
      setSelectedLesson(selectionValues.lessonId || '');
      setSelectedQuizType(selectionValues.type || '');
      setSelectedDifficulty(selectionValues.difficulty || '');
      setSelectedNumQuestions(selectionValues.count || '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally run only on mount
  
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

  // Surface generation errors when the result arrives (including after tab switch)
  useEffect(() => {
    if (genResult && !genResult.success) {
      const rawError = (genResult.error || '').toLowerCase();
      const rawDetails = (genResult.details || '').toLowerCase();

      let title = 'Something Went Wrong';
      let message = "We couldn't generate your quiz. Please try again.";

      if (rawError.includes('ollama') || rawError.includes('service') || rawError.includes('unavailable') || rawError.includes('connection')) {
        title = 'Service Unavailable';
        message = 'The quiz generation service is currently unavailable. Please try again in a moment.';
      } else if (rawError.includes('timeout') || rawDetails.includes('timeout')) {
        title = 'Taking Too Long';
        message = 'Quiz generation is taking longer than expected. Please try again.';
      } else if (rawError.includes('short') || rawError.includes('characters') || rawError.includes('content')) {
        title = 'Not Enough Content';
        message = "This reviewer doesn't have enough content to generate questions. Please try a different reviewer.";
      } else if (rawError.includes('access') || rawError.includes('enrolled') || rawError.includes('forbidden')) {
        title = 'Access Denied';
        message = "You don't have access to this reviewer. Please make sure you're enrolled in the class.";
      } else if (rawError.includes('session') || rawError.includes('token') || rawError.includes('auth') || rawError.includes('unauthorized')) {
        title = 'Session Expired';
        message = 'Your session has expired. Please log in again.';
      } else if (rawError.includes('generate') || rawError.includes('valid') || rawError.includes('items')) {
        title = 'Quiz Generation Failed';
        message = "We couldn't create questions from this reviewer right now. Please try again or choose a different reviewer.";
      }

      setModalInfo({
        isOpen: true,
        title,
        message,
        type: 'error',
      });
      clearGenResult();
    }
  }, [genResult, clearGenResult]);

  const handleGenerateQuiz = async () => {
    if (!hasEnrolledClasses) {
      setModalInfo({ isOpen: true, title: "No Class Enrolled", message: "You must join a class before generating quizzes. Go to the Reviewers tab and enter a class code to join.", type: "error" });
      return;
    }
    if (selectedLesson && selectedQuizType && selectedDifficulty && selectedNumQuestions) {
      await startGeneration({
        lessonId: selectedLesson,
        type: selectedQuizType,
        difficulty: selectedDifficulty,
        count: selectedNumQuestions,
      }, router);
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

  return (
    <div className="dashboard-container">
      <StudentSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTime={currentTime}
      />

      {/* Main Content */}
      <main className="main-content flex flex-col min-h-screen">
        <StudentHeader darkMode={darkMode} setDarkMode={setDarkMode} studentProfile={studentProfile} />
        
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
            <h2 className="generate-quiz-title">Generate Quiz from Reviewer</h2>
            <div className="generate-quiz-form">
              {/* Reviewer Dropdown */}
              <div className="quiz-input-group" ref={lessonDropdownRef}>
                <label className="quiz-input-label">Reviewer</label>
                <div 
                  className={`quiz-dropdown-trigger${isGenerating ? ' quiz-dropdown-trigger--disabled' : ''}`}
                  onClick={() => {
                    if (isGenerating) return;
                    setLessonDropdownOpen(!lessonDropdownOpen);
                    setQuizTypeDropdownOpen(false);
                    setDifficultyDropdownOpen(false);
                    setNumQuestionsDropdownOpen(false);
                  }}
                >
                  <span className={!selectedLesson ? "quiz-placeholder" : ""}>
                    {selectedLesson 
                      ? lessons.find(l => l.id === selectedLesson)?.title 
                      : "Select a reviewer"}
                  </span>
                  <FaChevronDown className={`quiz-dropdown-icon ${lessonDropdownOpen ? 'open' : ''}`} />
                </div>
                {lessonDropdownOpen && (
                  <div className="quiz-dropdown-menu">
                    {lessons.length === 0 ? (
                      <div className="quiz-dropdown-item disabled">No reviewers available</div>
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
                  className={`quiz-dropdown-trigger${isGenerating ? ' quiz-dropdown-trigger--disabled' : ''}`}
                  onClick={() => {
                    if (isGenerating) return;
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
                  className={`quiz-dropdown-trigger${isGenerating ? ' quiz-dropdown-trigger--disabled' : ''}`}
                  onClick={() => {
                    if (isGenerating) return;
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
                  className={`quiz-dropdown-trigger${isGenerating ? ' quiz-dropdown-trigger--disabled' : ''}`}
                  onClick={() => {
                    if (isGenerating) return;
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
                {isGenerating ? (
                  <>
                    <svg className="generate-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.42 31.42" />
                    </svg>
                    {genProgress?.message || 'Generating Quiz...'}
                    {genProgress?.percent != null && (
                      <span style={{ marginLeft: 6, opacity: 0.7, fontSize: '0.85em' }}>
                        {genProgress.percent}%
                      </span>
                    )}
                  </>
                ) : 'Generate Quiz'}
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
