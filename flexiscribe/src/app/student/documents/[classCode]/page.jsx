"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { FaArrowLeft, FaEye, FaFilePdf, FaBook } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "../../dashboard/styles.css";
import "./styles.css";

export default function ClassReviewersPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const classCode = params.classCode;
  const docType = searchParams.get("type") || "lecture"; // "lecture" or "meeting"
  
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  
  // Real data state
  const [classInfo, setClassInfo] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [loadingReviewers, setLoadingReviewers] = useState(true);

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

    // Fetch class info from enrolled classes
    const fetchClassInfo = async () => {
      try {
        const response = await fetch('/api/students/classes');
        if (response.ok) {
          const data = await response.json();
          const found = (data.classes || []).find((c) => c.classCode === classCode);
          if (found) {
            setClassInfo(found);
          }
        }
      } catch (error) {
        console.error('Error fetching class info:', error);
      }
    };

    // Fetch transcriptions/reviewers for this class filtered by session type
    const fetchReviewers = async () => {
      try {
        const response = await fetch(`/api/students/transcriptions?classCode=${classCode}`);
        if (response.ok) {
          const data = await response.json();
          const all = data.transcriptions || [];
          // Filter by session type based on title
          const filtered = all.filter((t) => {
            const title = (t.title || '').toLowerCase();
            if (docType === 'meeting') return title.includes('meeting');
            return !title.includes('meeting');
          });
          setReviewers(filtered);
        }
      } catch (error) {
        console.error('Error fetching reviewers:', error);
      } finally {
        setLoadingReviewers(false);
      }
    };

    fetchClassInfo();
    fetchReviewers();

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

  const handleReviewerClick = (reviewer) => {
    router.push(`/student/documents/${classCode}/${reviewer.id}`);
  };



  if (!mounted || !currentTime || loadingReviewers) {
    return <LoadingScreen />;
  }

  return (
    <div className="dashboard-container">
      <StudentSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentTime={currentTime}
      />

      <main className="main-content flex flex-col min-h-screen">
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
            <p className="class-subtitle">{docType === "meeting" ? "Minutes of the Meeting" : "Reviewers"}</p>
          </div>

          {loadingReviewers ? (
            <div className="empty-state">
              <p>Loading reviewers...</p>
            </div>
          ) : reviewers.length === 0 ? (
            <div className="empty-state">
              <FaBook className="empty-icon" />
              <h3>No {docType === "meeting" ? "MOTM" : "Reviewers"} Available</h3>
              <p>There are no {docType === "meeting" ? "minutes of the meeting" : "reviewers"} uploaded for this class yet.</p>
            </div>
          ) : (
            <div className="reviewers-grid">
              {reviewers.map((reviewer) => (
                <div key={reviewer.id} className="reviewer-card">
                  <div className="reviewer-card-header">
                    <div className="file-type-badge">
                      <FaFilePdf />
                      <span>{reviewer.status}</span>
                    </div>
                    <span className="file-size">{reviewer.duration || "—"}</span>
                  </div>
                  
                  <div className="reviewer-card-body">
                    <h3 className="reviewer-title">
                      {(() => {
                        const courseCode = reviewer.class?.subject || reviewer.course || '';
                        const topic = reviewer.title || 'Untitled';
                        const dateObj = reviewer.date ? new Date(reviewer.date) : new Date(reviewer.createdAt);
                        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const dd = String(dateObj.getDate()).padStart(2, '0');
                        const yy = String(dateObj.getFullYear()).slice(2);
                        return `${courseCode} | ${topic} | ${mm}-${dd}-${yy}`;
                      })()}
                    </h3>
                    <p className="reviewer-description">{reviewer.class?.subject || reviewer.course}</p>
                    
                    <div className="reviewer-meta">
                      <div className="meta-item">
                        <span className="meta-label">Educator:</span>
                        <span className="meta-value">{reviewer.educator?.fullName || "—"}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Date:</span>
                        <span className="meta-value">{reviewer.date || new Date(reviewer.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="reviewer-card-actions">
                    <button className="action-btn view-btn" onClick={() => handleReviewerClick(reviewer)}>
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
