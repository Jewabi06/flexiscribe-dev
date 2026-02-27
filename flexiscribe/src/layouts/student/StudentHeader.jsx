"use client";
import React from "react";
import { FaMoon, FaSun } from "react-icons/fa";
import UserMenu from "@/components/student/ui/UserMenu";
import NotificationMenu from "@/components/student/ui/NotificationMenu";
import SearchBar from "@/components/student/ui/SearchBar";

export default function StudentHeader({ 
  darkMode, 
  setDarkMode, 
  studentProfile 
}) {
  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="dashboard-header">
      <SearchBar />
      <div className="header-actions">
        {/* Theme Toggle Button */}
        <button className="theme-toggle-btn" onClick={handleToggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>
        
        <NotificationMenu />
        
        <UserMenu userName={studentProfile?.username || 'Student'} userRole={studentProfile?.role || 'Student'} userAvatar={studentProfile?.avatar} />
      </div>
    </header>
  );
}
