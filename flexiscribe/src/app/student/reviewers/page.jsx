"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaFolderOpen, FaFileAlt } from "react-icons/fa";
import UserMenu from "@/components/student/ui/UserMenu";
import NotificationMenu from "@/components/student/ui/NotificationMenu";
import SearchBar from "@/components/student/ui/SearchBar";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "../dashboard/styles.css";
import "./styles.css";

export default function ReviewersPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);

  // Real data state
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [rawTranscripts, setRawTranscripts] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingTranscripts, setLoadingTranscripts] = useState(true);

  // Join class state
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [joining, setJoining] = useState(false);

  // Modal state for error messages
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });

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

    // Fetch enrolled classes from API
    const fetchEnrolledClasses = async () => {
      try {
        const response = await fetch('/api/students/classes');
        if (response.ok) {
          const data = await response.json();
          setEnrolledClasses(data.classes || []);
        }
      } catch (error) {
        console.error('Error fetching enrolled classes:', error);
      } finally {
        setLoadingClasses(false);
      }
    };

    // Fetch raw transcripts from API
    const fetchRawTranscripts = async () => {
      try {
        const response = await fetch('/api/students/transcriptions');
        if (response.ok) {
          const data = await response.json();
          setRawTranscripts(data.transcriptions || []);
        }
      } catch (error) {
        console.error('Error fetching transcripts:', error);
      } finally {
        setLoadingTranscripts(false);
      }
    };

    fetchEnrolledClasses();
    fetchRawTranscripts();

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

  const handleAddClass = async () => {
    if (!classCode.trim()) return;

    setJoinError("");
    setJoinSuccess("");
    setJoining(true);

    try {
      const res = await fetch("/api/students/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode: classCode.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setJoinSuccess(`Joined ${data.class.subject} — Section ${data.class.section}!`);
        setClassCode("");
        // Refresh enrolled classes and transcripts
        const [classesRes, transRes] = await Promise.all([
          fetch('/api/students/classes'),
          fetch('/api/students/transcriptions'),
        ]);
        if (classesRes.ok) {
          const cData = await classesRes.json();
          setEnrolledClasses(cData.classes || []);
        }
        if (transRes.ok) {
          const tData = await transRes.json();
          setRawTranscripts(tData.transcriptions || []);
        }
        setTimeout(() => setJoinSuccess(""), 3000);
      } else {
        setModalInfo({
          isOpen: true,
          title: "Invalid Class Code",
          message: data.error || "Invalid class code. Please check and try again.",
          type: "error"
        });
      }
    } catch {
      setModalInfo({
        isOpen: true,
        title: "Error",
        message: "An error occurred. Please try again.",
        type: "error"
      });
    } finally {
      setJoining(false);
    }
  };

  const handleClassClick = (classItem) => {
    router.push(`/student/reviewers/${classItem.classCode}`);
  };

  const handleTranscriptClick = (transcript) => {
    const code = transcript.class?.classCode || transcript.course;
    router.push(`/student/reviewers/transcripts/${code}`);
  };

  // Don't render until mounted and data is loaded to avoid flash of default data
  if (!mounted || !currentTime || loadingClasses || loadingTranscripts) {
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
          <div className="nav-item active">
            <FaBook className="nav-icon" />
            <span>Reviewers</span>
          </div>
          <div className="nav-item" onClick={() => router.push('/student/quizzes')}>
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
        
        {/* Reviewers Content */}
        <div className="reviewers-content">
          {/* Add Class Section */}
          <div className="add-class-section">
            <div className="class-input-container">
              <label className="class-input-label">Enter Class Code</label>
              <input
                type="text"
                className="class-input"
                placeholder="e.g. A3F1B2"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
                disabled={joining}
                style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              />
              {joinSuccess && (
                <div className="join-feedback success">{joinSuccess}</div>
              )}
            </div>
            <button className="add-class-btn" onClick={handleAddClass} disabled={joining}>
              {joining ? "Joining..." : "Join Class"}
            </button>
          </div>

          {/* Enrolled Classes Section */}
          <div className="section-container">
            <h2 className="section-title">Enrolled Classes</h2>
            {loadingClasses ? (
              <div className="empty-state-container">
                <p className="empty-state-text">Loading classes...</p>
              </div>
            ) : enrolledClasses.length === 0 ? (
              <div className="empty-state-container">
                <FaFolderOpen className="empty-state-icon" />
                <h3 className="empty-state-heading">No Enrolled Classes</h3>
                <p className="empty-state-text">Enter a class code above to join a class and view reviewers.</p>
              </div>
            ) : (
              <div className="folders-grid">
                {enrolledClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    className="folder-card"
                    onClick={() => handleClassClick(classItem)}
                  >
                    <div className="folder-icon-wrapper">
                      <FaFolderOpen className="folder-icon" />
                    </div>
                    <div className="folder-label">{classItem.subject}</div>
                    <div className="folder-sublabel">Section {classItem.section}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Transcripts Section */}
          <div className="section-container">
            <h2 className="section-title">Raw Transcripts</h2>
            {loadingTranscripts ? (
              <div className="empty-state-container">
                <p className="empty-state-text">Loading transcripts...</p>
              </div>
            ) : rawTranscripts.length === 0 ? (
              <div className="empty-state-container">
                <FaFileAlt className="empty-state-icon" />
                <h3 className="empty-state-heading">No Transcripts Available</h3>
                <p className="empty-state-text">There are no uploaded transcripts for your enrolled classes yet.</p>
              </div>
            ) : (
              <div className="folders-grid">
                {/* Group transcripts by class */}
                {(() => {
                  const grouped = {};
                  rawTranscripts.forEach((t) => {
                    const key = t.class?.classCode || t.course;
                    if (!grouped[key]) {
                      grouped[key] = {
                        classCode: key,
                        subject: t.class?.subject || t.course,
                        section: t.class?.section || "",
                        count: 0,
                      };
                    }
                    grouped[key].count++;
                  });
                  return Object.values(grouped).map((group) => (
                    <div
                      key={group.classCode}
                      className="folder-card"
                      onClick={() => router.push(`/student/reviewers/transcripts/${group.classCode}`)}
                    >
                      <div className="folder-icon-wrapper">
                        <FaFileAlt className="folder-icon" />
                      </div>
                      <div className="folder-label">{group.subject}</div>
                      <div className="folder-sublabel">
                        {group.section ? `Section ${group.section} • ` : ""}{group.count} transcript{group.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ));
                })()}
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
