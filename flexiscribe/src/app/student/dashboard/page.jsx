"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaSearch, FaBars, FaTimes, FaMoon, FaSun } from "react-icons/fa";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { mockDailyMessages, mockQuotes } from "./mockData";
import { 
  getGreeting, 
  getDailyMessage, 
  getDailyQuote, 
  calculateStreak, 
  trackActivity, 
  hasActivityToday, 
  recordActivity, 
  calculateRank, 
  toggleSidebar as utilToggleSidebar, 
  toggleDarkMode as utilToggleDarkMode, 
  handleNavigation as utilHandleNavigation 
} from "../../../utils/student";
import "./styles.css";


export default function StudentDashboard() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [inProgressQuizzes, setInProgressQuizzes] = useState([]);
  const [recentReviewers, setRecentReviewers] = useState([]);
  const [streakData, setStreakData] = useState({
    count: 0,
    isActive: false,
    lastActivityDate: null
  });
  const [currentRank, setCurrentRank] = useState({
    name: "Learner V",
    tier: "V",
    xp: 0,
    xpMin: 0,
    xpMax: 199,
    color: "#CD7F32",
    icon: "/img/learner-5.png"
  });

  // Calculate XP progress for rank bar
  const xpProgress = ((currentRank.xp - currentRank.xpMin) / (currentRank.xpMax - currentRank.xpMin)) * 100;

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

    // Initialize streak data (don't record activity on load, only when user does something)
    const loadStreak = async () => {
      const currentStreak = await calculateStreak();
      setStreakData(currentStreak);
    };
    loadStreak();

    // Fetch student profile from database
    const fetchStudentProfile = async () => {
      try {
        const response = await fetch('/api/students/profile');
        if (response.ok) {
          const data = await response.json();
          setStudentProfile(data.profile);
          
          // Set XP and calculate rank
          const studentXP = data.profile.xp || 0;
          const rank = calculateRank(studentXP);
          setCurrentRank(rank);
        } else {
          console.error('Failed to fetch student profile');
        }
      } catch (error) {
        console.error('Error fetching student profile:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch leaderboard from database
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/students/leaderboard');
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard);
        } else {
          console.error('Failed to fetch leaderboard');
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    };

    fetchStudentProfile();
    fetchLeaderboard();

    // Fetch quizzes that have no attempt yet (Jump Back In)
    // Also include quizzes with saved local progress
    const fetchInProgressQuizzes = async () => {
      try {
        const response = await fetch('/api/students/quizzes');
        if (response.ok) {
          const data = await response.json();
          // Quizzes without an attempt are "in progress" (student hasn't submitted yet)
          const pending = (data.quizzes || []).filter((q) => !q.hasAttempt);
          
          // Merge with localStorage progress data
          const withProgress = pending.map((q) => {
            const savedProgress = localStorage.getItem(`quiz-progress-${q.id}`);
            if (savedProgress) {
              const progress = JSON.parse(savedProgress);
              return {
                ...q,
                answeredCount: progress.answeredCount || 0,
                progressPercent: Math.round((progress.answeredCount / q.numQuestions) * 100),
              };
            }
            return { ...q, answeredCount: 0, progressPercent: 0 };
          });
          
          // Sort: quizzes with progress first, then by last updated
          withProgress.sort((a, b) => b.progressPercent - a.progressPercent);
          setInProgressQuizzes(withProgress.slice(0, 3));
        }
      } catch (error) {
        console.error('Error fetching quizzes for jump back in:', error);
      }
    };

    // Fetch recently added reviewers (transcriptions created within 24 hours)
    const fetchRecentReviewers = async () => {
      try {
        const response = await fetch('/api/students/transcriptions');
        if (response.ok) {
          const data = await response.json();
          const now = new Date();
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const recent = (data.transcriptions || []).filter(
            (t) => new Date(t.createdAt) >= oneDayAgo
          ).slice(0, 3);
          setRecentReviewers(recent);
        }
      } catch (error) {
        console.error('Error fetching recent reviewers:', error);
      }
    };

    fetchInProgressQuizzes();
    fetchRecentReviewers();

    return () => clearInterval(timer);
  }, []);

  /* ============================================
   * ACTIVITY TRACKING INTEGRATION GUIDE
   * ============================================
   * To activate the streak, call trackActivity() when users complete activities.
   * 
   * Examples:
   * 
   * 1. Quiz Completion:
   *    trackActivity('quiz_completed', setStreakData);
   * 
   * 2. Reviewer Viewed:
   *    trackActivity('reviewer_viewed', setStreakData);
   * 
   * 3. Flashcard Session:
   *    trackActivity('flashcard_session', setStreakData);
   * 
   * 4. MCQ Practice:
   *    trackActivity('mcq_practice', setStreakData);
   * 
   * The streak will only increment after at least 1 activity is tracked per day.
   * ============================================ */

  const handleToggleSidebar = () => utilToggleSidebar(sidebarOpen, setSidebarOpen);
  const handleToggleDarkMode = () => utilToggleDarkMode(darkMode, setDarkMode);
  const handleNav = (path) => utilHandleNavigation(path, router, sidebarOpen, setSidebarOpen);

  const handleLogout = async () => {
    try {
      // Call logout API to clear the auth cookie
      await fetch("/api/auth/logout", { method: "POST" });
      
      // Clear any client-side storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to login
      window.location.href = "/auth/student/login";
    } catch (error) {
      console.error("Logout error:", error);
      // Redirect anyway
      window.location.href = "/auth/student/login";
    }
  };

  // Don't render until mounted and data is loaded to avoid flash of default data
  if (!mounted || !currentTime || loading) {
    return <LoadingScreen />;
  }

  // Calculate clock hand angles
  const hours = currentTime.getHours() % 12;
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();

  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;
  const secondAngle = seconds * 6;

  // Format time and date
  const timeString = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateString = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="dashboard-container">
      <StudentSidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTime={currentTime}
        hourAngle={hourAngle}
        minuteAngle={minuteAngle}
        secondAngle={secondAngle}
        timeString={timeString}
        dateString={dateString}
      />

      {/* Main Content */}
        <main className="main-content flex flex-col min-h-screen">
        <StudentHeader 
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          studentProfile={studentProfile}
        />
        
        {/* Grid Contents */}
        <div className="dashboard-grid pb-4 sm:pb-6 lg:pb-8">
            {/* Welcome Banner */}
            <div className="welcome-banner md:col-span-2 lg:col-span-8">
              <div className="grid grid-cols-2 grid-rows-2">
                <div className="col-start-1 row-start-1 items-start flex justify-center flex-col">
                  <span className="font-bold text-xl md:text-2xl lg:text-3xl">{getGreeting(currentTime)}, {studentProfile?.username || 'Student'}!</span>
                </div>
                <div className="col-start-1 row-start-2 items-start flex justify-center flex-col">
                  <span className="font-normal text-xs md:text-sm opacity-90">{getDailyMessage(currentTime, mockDailyMessages)}</span>
                </div>
                <div className="welcome-mascot col-start-2 row-span-2 flex items-center justify-center">
                  😻{/* <img src="/img/fLexiScribe-mascot.png" alt="Mascot" className="h-auto w-full max-w-[100px] md:max-w-[150px]" /> */}
                </div>
              </div>
            </div>

            {/* Rank Card */}
            <div className="card rank-card lg:col-span-4" onClick={() => router.push("/student/rank")} style={{ cursor: 'pointer' }}>
              <div className="rank-card-content">
                <div className="rank-badge-container">
                  <img src={currentRank.icon} alt="Badge" className="rank-badge-img" />
                </div>
                <div className="rank-info">
                  <div className="rank-name">{currentRank.name}</div>
                  <div className="rank-tier">Tier {currentRank.tier}</div>
                  <div className="xp-bar">
                    <div className="xp-fill" style={{width: `${Math.min(xpProgress, 100)}%`}}></div>
                  </div>
                  <div className="rank-xp">{currentRank.xp.toLocaleString()} XP</div>
                </div>
              </div>
            </div>

            {/* Study Streak */}
            <div className={`card study-streak lg:col-span-4 ${streakData.isActive ? 'streak-active' : 'streak-inactive'}`}>
                <div className="card-header-compact">
                  <h3>Study Streak</h3>
                </div>
                <div className="streak-content">
                  <div className="streak-icon-container">
                    <div className="streak-icon">🔥</div>
                    {streakData.isActive && (
                      <>
                        <div className="fire-particle fire-particle-1"></div>
                        <div className="fire-particle fire-particle-2"></div>
                        <div className="fire-particle fire-particle-3"></div>
                        <div className="fire-glow"></div>
                      </>
                    )}
                  </div>
                  <div className="streak-count">{streakData.count} {streakData.count === 1 ? 'day' : 'days'}</div>
                  {streakData.isActive ? (
                    <div className="streak-status active">✓ Active</div>
                  ) : (
                    <div className="streak-status inactive">Keep going!</div>
                  )}
                </div>
            </div>

            {/* Jump Back In - In-progress quizzes (no attempt yet) */}
            <div className="card jump-back lg:col-span-4">
                <div className="card-header-compact">
                  <h3>Jump Back In</h3>
                </div>
                <div className="jump-back-content">
                  {inProgressQuizzes.length > 0 ? (
                    inProgressQuizzes.map((q) => (
                      <div
                        key={q.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', cursor: 'pointer' }}
                        onClick={() => router.push(`/student/quizzes/${q.id}`)}
                      >
                        <div className="progress-circle">
                          <CircularProgressbar
                            value={q.progressPercent || 0}
                            text={`${q.progressPercent || 0}%`}
                            styles={buildStyles({
                              textSize: '28px',
                              pathColor: q.progressPercent > 0 ? 'var(--brand-secondary)' : 'rgba(255,255,255,0.3)',
                              textColor: 'var(--accent-secondary)',
                              trailColor: 'rgba(255,255,255,0.2)',
                            })}
                          />
                        </div>
                        <div>
                          <p className="progress-label">{q.lesson}</p>
                          <p className="progress-section">{q.quizType} • {q.answeredCount > 0 ? `${q.answeredCount}/${q.numQuestions} answered` : `${q.numQuestions} questions`}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2rem',
                      gap: '1rem',
                      minHeight: '180px'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--brand-secondary) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                      }}>
                        📚
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{
                          fontSize: '1rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginBottom: '0.5rem',
                        }}>No Recent Activity</p>
                        <p style={{
                          fontSize: '0.85rem',
                          color: 'rgba(255, 255, 255, 0.7)',
                        }}>Start reviewing to track your progress</p>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* Recently Added - Reviewers added within 24 hours */}
            <div className="card recently-added lg:col-span-4">
                <div className="card-header-compact">
                  <h3>Recently Added</h3>
                </div>
                <div className="recently-added-content">
                  {recentReviewers.length > 0 ? (
                    recentReviewers.map((r) => (
                      <div
                        key={r.id}
                        className="document-preview"
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/student/reviewers/${r.class?.classCode || ''}/${r.id}`)}
                      >
                        <div className="doc-icon">📄</div>
                        <div className="doc-info">
                          <p className="doc-title">{r.title}</p>
                          <p className="doc-subject">{r.course}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      padding: '2rem',
                      gap: '1rem',
                      minHeight: '180px'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--brand-secondary) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                      }}>
                        📄
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ 
                          fontSize: '1rem', 
                          fontWeight: '600',
                          color: 'var(--text-primary)',
                          marginBottom: '0.5rem',
                        }}>No Content Available</p>
                        <p style={{ 
                          fontSize: '0.85rem', 
                          color: 'rgba(255, 255, 255, 0.7)',
                        }}>New reviewers will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* Leaderboard */}
            <div className="md:col-span-2 lg:col-span-8">
              <div className="card leaderboard-card">
                <div style={{ display: 'flex', justifyContent: 'center'}}>
                  <h3>Leaderboard</h3>
                </div>
                
                {leaderboard.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '3rem 2rem',
                    gap: '1.5rem'
                  }}>
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem',
                      boxShadow: '0 4px 20px rgba(255, 215, 0, 0.2)'
                    }}>
                      🏆
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: '600',
                        color: 'var(--accent-secondary)',
                        marginBottom: '0.5rem',
                      }}>No Leaderboard Data</p>
                      <p style={{ 
                        fontSize: '0.9rem', 
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxWidth: '400px'
                      }}>Start earning XP to appear on the leaderboard</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Leaderboard List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {leaderboard.slice(0, 3).map((user, index) => {
                        const isCurrentUser = user.username === studentProfile?.username;
                        const getRankColor = (rank) => {
                          if (rank === 1) return "#FFD700";
                          if (rank === 2) return "#C0C0C0";
                          if (rank === 3) return "#CD7F32";
                          return "var(--brand-primary)";
                        };
                        const getRankIcon = (rank) => {
                          if (rank === 1) return "🏆";
                          if (rank === 2) return "🥈";
                          if (rank === 3) return "🥉";
                          return rank;
                        }

                        return (
                          <div 
                            key={user.id || index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0.75rem 1rem',
                              borderRadius: '8px',
                              background: isCurrentUser ? 'rgba(41, 182, 246, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                              border: isCurrentUser ? '2px solid var(--accent-primary)' : '2px solid transparent',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { if (!isCurrentUser) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; 
                              e.currentTarget.style.transform = 'translateX(8px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                             }}
                            onMouseLeave={(e) => { if (!isCurrentUser) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                              e.currentTarget.style.transform = 'translateX(0)';
                              e.currentTarget.style.boxShadow = 'none';
                             }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: getRankColor(index + 1),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              color: index < 3 ? '#4c4172' : '#fff',
                              marginRight: '1rem',
                              flexShrink: 0
                            }}>{getRankIcon(index + 1)}</div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--accent-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {user.username} {isCurrentUser && '(You)'}
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'rgba(255, 255, 255, 0.6)',
                                marginTop: '0.125rem'
                              }}>
                                {user.level || 'Learner'}
                              </div>
                            </div>

                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              color: '#FFD700',
                              marginLeft: '1rem',
                              flexShrink: 0
                            }}>
                              {user.xp?.toLocaleString()} XP
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button 
                      onClick={() => router.push('/student/leaderboard')}
                      className="leaderboard-more"
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      See More
                    </button>

                    {/* View All Button at bottom for mobile */}
                    {leaderboard.length > 5 && (
                      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                        <button 
                          onClick={() => router.push('/student/leaderboard')}
                          style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--brand-secondary) 100%)',
                            border: 'none',
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            width: '100%'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.02)';
                            e.target.style.boxShadow = '0 4px 15px rgba(41, 182, 246, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          View Full Leaderboard
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quote of the Day */}
            <div className="lg:col-span-4">
              <div className="card quote-card">
                <div className="quote-content">
                  <h3>Quote of the Day</h3>
                  <div className="quote-mascot">{getDailyQuote(currentTime, mockQuotes).emoji}</div>
                  <p className="quote-text">
                    "{getDailyQuote(currentTime, mockQuotes).text}"
                  </p>
                  <p className="quote-author">— {getDailyQuote(currentTime, mockQuotes).author}</p>
                </div>
              </div>
            </div>
        </div>
      </main>
    </div>
  );
}
