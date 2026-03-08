"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { FaArrowLeft, FaFileAlt, FaEye, FaClock, FaCheckCircle } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
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
    router.push(`/student/documents/transcripts/${classCode}/${transcript.id}`);
  };

  if (!mounted || !currentTime || loadingTranscripts) {
    return <LoadingScreen />;
  }

  return (
    <div className="dashboard-container">
      <StudentSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTime={currentTime}
      />

      <main className="main-content flex flex-col justify-between min-h-screen">
        <StudentHeader darkMode={darkMode} setDarkMode={setDarkMode} studentProfile={studentProfile} />
        
        <div className="class-content">
          <div className="back-button-container">
            <button className="back-button" onClick={() => router.push('/student/documents')}>
              <FaArrowLeft className="back-icon" />
              <span>Back to Documents</span>
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
                    <div className="file-type-badge completed">
                      <FaCheckCircle />
                      <span>COMPLETED</span>
                    </div>
                  </div>
                  
                  <div className="transcript-card-body">
                    <h3 className="transcript-title">
                      {(() => {
                        const courseCode = transcript.class?.subject || transcript.course || '';
                        const topic = transcript.title || 'Untitled';
                        const dateObj = transcript.date ? new Date(transcript.date) : new Date(transcript.createdAt);
                        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const dd = String(dateObj.getDate()).padStart(2, '0');
                        const yy = String(dateObj.getFullYear()).slice(2);
                        return `${courseCode} | ${topic} | ${mm}-${dd}-${yy}`;
                      })()}
                    </h3>
                    
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
