"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes } from "react-icons/fa";

export default function StudentSidebar({ 
  sidebarOpen, 
  setSidebarOpen, 
  currentTime,
  hourAngle,
  minuteAngle,
  secondAngle,
  timeString,
  dateString
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (path) => {
    router.push(path);
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const isActive = (path) => pathname === path;

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

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
          <div className={`nav-item ${isActive('/student/dashboard') ? 'active' : ''}`} onClick={() => handleNavigation('/student/dashboard')}>
            <FaHome className="nav-icon" />
            <span>Dashboard</span>
          </div>
          <div className={`nav-item ${isActive('/student/reviewers') ? 'active' : ''}`} onClick={() => handleNavigation('/student/reviewers')}>
            <FaBook className="nav-icon" />
            <span>Reviewers</span>
          </div>
          <div className={`nav-item ${isActive('/student/quizzes') ? 'active' : ''}`} onClick={() => handleNavigation('/student/quizzes')}>
            <FaGamepad className="nav-icon" />
            <span>Quizzes</span>
          </div>
          <div className={`nav-item ${isActive('/student/leaderboard') ? 'active' : ''}`} onClick={() => handleNavigation('/student/leaderboard')}>
            <FaTrophy className="nav-icon" />
            <span>Leaderboard</span>
          </div>
        </nav>

        {currentTime && (
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
        )}
      </aside>
    </>
  );
}
