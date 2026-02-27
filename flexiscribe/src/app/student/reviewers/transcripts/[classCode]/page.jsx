"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaArrowLeft, FaFileAlt, FaEye, FaClock, FaCheckCircle } from "react-icons/fa";
import UserMenu from "@/components/student/ui/UserMenu";
import NotificationMenu from "@/components/student/ui/NotificationMenu";
import SearchBar from "@/components/student/ui/SearchBar";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "../../../dashboard/styles.css";
import "./styles.css";

export default function ClassTranscriptsPage() {
  const router = useRouter();
  const params = useParams();
  const classCode = params.classCode;
  
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  
  // Real data state
  const [classInfo, setClassInfo] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(true);

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

    // Fetch class info
    const fetchClassInfo = async () => {
      try {
        const response = await fetch('/api/students/classes');
        if (response.ok) {
          const data = await response.json();
          const found = (data.classes || []).find((c) => c.classCode === classCode);
          if (found) setClassInfo(found);
        }
      } catch (error) {
        console.error('Error fetching class info:', error);
      }
    };

    // Fetch transcripts for this class
    const fetchTranscripts = async () => {
      try {
        const response = await fetch(`/api/students/transcriptions?classCode=${classCode}`);
        if (response.ok) {
          const data = await response.json();
          setTranscripts(data.transcriptions || []);
        }
      } catch (error) {
        console.error('Error fetching transcripts:', error);
      } finally {
        setLoadingTranscripts(false);
      }
    };

    fetchClassInfo();
    fetchTranscripts();

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

  const handleTranscriptClick = (transcript) => {
    router.push(`/student/reviewers/transcripts/${classCode}/${transcript.id}`);
  };

  if (!mounted || !currentTime || loadingTranscripts) {
    return <LoadingScreen />;
  }

  const hours = currentTime.getHours() % 12;
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;
  const secondAngle = seconds * 6;
  const timeString = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateString = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="dashboard-container">
      <button className="mobile-menu-toggle" onClick={toggleSidebar}>
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

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
          <SearchBar />
          <div className="header-actions">
            <button className="theme-toggle-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            <NotificationMenu />
            <UserMenu userName={studentProfile?.username || 'Student'} userRole={studentProfile?.role || 'Student'} userAvatar={studentProfile?.avatar} />
          </div>
        </header>
        
        <div className="class-content">
          <div className="back-button-container">
            <button className="back-button" onClick={() => router.push('/student/reviewers')}>
              <FaArrowLeft className="back-icon" />
              <span>Back to Reviewers</span>
            </button>
          </div>

          <div className="class-header">
            <h1 className="class-title">
              {classInfo ? `${classInfo.subject} — Section ${classInfo.section}` : classCode}
            </h1>
            <p className="class-subtitle">Raw Transcripts</p>
          </div>

          {loadingTranscripts ? (
            <div className="empty-state">
              <p>Loading transcripts...</p>
            </div>
          ) : transcripts.length === 0 ? (
            <div className="empty-state">
              <FaFileAlt className="empty-icon" />
              <h3>No Transcripts Available</h3>
              <p>There are no transcripts uploaded for this class yet.</p>
            </div>
          ) : (
            <div className="transcripts-grid">
              {transcripts.map((transcript) => (
                <div key={transcript.id} className="transcript-card">
                  <div className="transcript-card-header">
                    <div className="file-type-badge">
                      <FaFileAlt />
                      <span>JSON</span>
                    </div>
                    <div className={`status-badge ${transcript.status?.toLowerCase() || 'completed'}`}>
                      <FaCheckCircle />
                      <span>{transcript.status || 'COMPLETED'}</span>
                    </div>
                  </div>
                  
                  <div className="transcript-card-body">
                    <h3 className="transcript-title">{transcript.title}</h3>
                    
                    <div className="transcript-meta">
                      <div className="meta-item">
                        <FaClock className="meta-icon" />
                        <span className="meta-label">Duration:</span>
                        <span className="meta-value">{transcript.duration || '—'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Date:</span>
                        <span className="meta-value">{transcript.date || new Date(transcript.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Educator:</span>
                        <span className="meta-value">{transcript.educator?.fullName || '—'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="transcript-card-actions">
                    <button className="action-btn view-btn" onClick={() => handleTranscriptClick(transcript)}>
                      <FaEye />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
