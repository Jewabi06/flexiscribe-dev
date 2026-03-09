"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes } from "react-icons/fa";

export default function StudentSidebar({ 
  sidebarOpen, 
  setSidebarOpen, 
  currentTime
}) {
  const timeString = currentTime
    ? currentTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : "";
  const dateString = currentTime
    ? currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";
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
          <div className={`nav-item ${isActive('/student/documents') ? 'active' : ''}`} onClick={() => handleNavigation('/student/documents')}>
            <FaBook className="nav-icon" />
            <span>Documents</span>
          </div>
          <div className={`nav-item ${isActive('/student/quizzes') ? 'active' : ''}`} onClick={() => handleNavigation('/student/quizzes')}>
            <FaGamepad className="nav-icon" />
            <span>Mock Quiz</span>
          </div>
          <div className={`nav-item ${isActive('/student/leaderboard') ? 'active' : ''}`} onClick={() => handleNavigation('/student/leaderboard')}>
            <FaTrophy className="nav-icon" />
            <span>Leaderboard</span>
          </div>
        </nav>

        {currentTime && (() => {
          const s = currentTime.getSeconds();
          const m = currentTime.getMinutes() + s / 60;
          const h = (currentTime.getHours() % 12) + m / 60;

          const hAngle = (h * 30 * Math.PI) / 180;
          const mAngle = (m * 6 * Math.PI) / 180;
          const sAngle = (s * 6 * Math.PI) / 180;

          return (
            <div className="clock-widget">
              <svg className="clock-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2" />
                {/* Hour markers */}
                {[...Array(12)].map((_, i) => {
                  const a = (i * 30 * Math.PI) / 180;
                  return (
                    <line
                      key={i}
                      x1={50 + Math.sin(a) * 36}
                      y1={50 - Math.cos(a) * 36}
                      x2={50 + Math.sin(a) * 42}
                      y2={50 - Math.cos(a) * 42}
                      stroke="white"
                      strokeWidth="2"
                    />
                  );
                })}
                {/* Hour hand */}
                <line
                  x1="50" y1="50"
                  x2={50 + Math.sin(hAngle) * 20}
                  y2={50 - Math.cos(hAngle) * 20}
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Minute hand */}
                <line
                  x1="50" y1="50"
                  x2={50 + Math.sin(mAngle) * 30}
                  y2={50 - Math.cos(mAngle) * 30}
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Second hand */}
                <line
                  x1="50" y1="50"
                  x2={50 + Math.sin(sAngle) * 34}
                  y2={50 - Math.cos(sAngle) * 34}
                  stroke="var(--accent-primary)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Center dot */}
                <circle cx="50" cy="50" r="3" fill="white" />
              </svg>
              <div className="clock-time">{timeString}</div>
              <div className="clock-date">{dateString}</div>
            </div>
          );
        })()}
      </aside>
    </>
  );
}
