"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaFolderOpen, FaFileAlt } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
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

    setJoining(true);

    try {
      const res = await fetch("/api/students/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode: classCode.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setClassCode("");
        setModalInfo({
          isOpen: true,
          title: "Class Joined!",
          message: `Joined ${data.class.subject} — Section ${data.class.section}!`,
          type: "success"
        });
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

  const handleClassClick = (classItem, type) => {
    router.push(`/student/documents/${classItem.classCode}?type=${type}`);
  };

  const handleTranscriptClick = (transcript) => {
    const code = transcript.class?.classCode || transcript.course;
    router.push(`/student/documents/transcripts/${code}`);
  };

  // Group transcripts by class and sessionType for Reviewers (lecture) and MOTM (meeting)
  const groupByClassAndType = (transcripts, type) => {
    const grouped = {};
    transcripts.filter((t) => t.sessionType === type).forEach((t) => {
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
    return Object.values(grouped);
  };

  const reviewerGroups = groupByClassAndType(rawTranscripts, "lecture");
  const motmGroups = groupByClassAndType(rawTranscripts, "meeting");

  // Don't render until mounted and data is loaded to avoid flash of default data
  if (!mounted || !currentTime || loadingClasses || loadingTranscripts) {
    return <LoadingScreen />;
  }

  // Calculate clock hand angles
  // Format time and date

  return (
    <div className="dashboard-container">
      <StudentSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTime={currentTime}
      />

      {/* Main Content */}
      <main className="main-content flex flex-col justify-between min-h-screen">
        <StudentHeader darkMode={darkMode} setDarkMode={setDarkMode} studentProfile={studentProfile} />
        
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

            </div>
            <button className="add-class-btn" onClick={handleAddClass} disabled={joining}>
              {joining ? "Joining..." : "Join Class"}
            </button>
          </div>

          {/* Reviewers Section */}
          <div className="section-container">
            <h2 className="section-title">Reviewers</h2>
            {loadingTranscripts ? (
              <div className="empty-state-container">
                <p className="empty-state-text">Loading reviewers...</p>
              </div>
            ) : reviewerGroups.length === 0 ? (
              <div className="empty-state-container">
                <FaFolderOpen className="empty-state-icon" />
                <h3 className="empty-state-heading">No Reviewers Available</h3>
                <p className="empty-state-text">There are no reviewers available for your enrolled classes yet.</p>
              </div>
            ) : (
              <div className="folders-grid">
                {reviewerGroups.map((group) => (
                  <div
                    key={group.classCode}
                    className="folder-card"
                    onClick={() => handleClassClick({ classCode: group.classCode }, "lecture")}
                  >
                    <div className="folder-icon-wrapper">
                      <FaFolderOpen className="folder-icon" />
                    </div>
                    <div className="folder-label">{group.subject}</div>
                    <div className="folder-sublabel">
                      {group.section ? `Section ${group.section} \u2022 ` : ""}{group.count} reviewer{group.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MOTM Section */}
          <div className="section-container">
            <h2 className="section-title">Minutes of the Meeting</h2>
            {loadingTranscripts ? (
              <div className="empty-state-container">
                <p className="empty-state-text">Loading...</p>
              </div>
            ) : motmGroups.length === 0 ? (
              <div className="empty-state-container">
                <FaFolderOpen className="empty-state-icon" />
                <h3 className="empty-state-heading">No MOTM Available</h3>
                <p className="empty-state-text">There are no minutes of the meeting for your enrolled classes yet.</p>
              </div>
            ) : (
              <div className="folders-grid">
                {motmGroups.map((group) => (
                  <div
                    key={group.classCode}
                    className="folder-card"
                    onClick={() => handleClassClick({ classCode: group.classCode }, "meeting")}
                  >
                    <div className="folder-icon-wrapper">
                      <FaFolderOpen className="folder-icon" />
                    </div>
                    <div className="folder-label">{group.subject}</div>
                    <div className="folder-sublabel">
                      {group.section ? `Section ${group.section} \u2022 ` : ""}{group.count} MOTM{group.count !== 1 ? "s" : ""}
                    </div>
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
                      onClick={() => router.push(`/student/documents/transcripts/${group.classCode}`)}
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
