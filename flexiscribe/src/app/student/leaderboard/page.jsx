"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaCrown, FaMedal, FaStar, FaFire } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import { toggleSidebar as utilToggleSidebar, toggleDarkMode as utilToggleDarkMode, handleNavigation as utilHandleNavigation } from "../../../utils/student";
import { ALL_RANKS, calculateStreak } from "@/utils/student";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "../dashboard/styles.css";
import "./styles.css";

export default function StudentLeaderboard() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(10); // Start with top 10
  const [isLoading, setIsLoading] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streakData, setStreakData] = useState({ count: 0, isActive: false, lastActivityDate: null });

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

    // Load user's profile image
    const savedImage = localStorage.getItem('userProfileImage');
    if (savedImage) {
      setUserProfileImage(savedImage);
    }

    // Initialize streak data
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
          
          // Set avatar from database if available
          if (data.profile.avatar) {
            setUserProfileImage(data.profile.avatar);
          }
        } else {
          console.error('Failed to fetch student profile');
        }
      } catch (error) {
        console.error('Error fetching student profile:', error);
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
      } finally {
        setLoading(false);
      }
    };

    fetchStudentProfile();
    fetchLeaderboard();

    return () => clearInterval(timer);
  }, []);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      // Check if user scrolled near the bottom
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Load more when within 200px of bottom
      if (scrollPosition >= documentHeight - 200 && !isLoading && displayedCount < leaderboard.length) {
        setIsLoading(true);
        
        // Load more entries
        setTimeout(() => {
          setDisplayedCount(prev => Math.min(prev + 10, 100)); // Add 10 more, max 100
          setIsLoading(false);
        }, 300);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayedCount, isLoading]);

  const handleToggleSidebar = () => utilToggleSidebar(sidebarOpen, setSidebarOpen);
  const handleToggleDarkMode = () => utilToggleDarkMode(darkMode, setDarkMode);
  const handleNav = (path) => utilHandleNavigation(path, router, sidebarOpen, setSidebarOpen);

  const getTierFromXP = (xp) => {
    const rank = ALL_RANKS.find(
      r => xp >= r.xpMin && xp <= r.xpMax
    );
    return rank ? rank.name : "";
  };

  const getOrdinalSuffix = (n) => {
    if (n % 100 >= 11 && n % 100 <= 13) return "TH";

    switch (n % 10) {
      case 1: return "ST";
      case 2: return "ND";
      case 3: return "RD";
      default: return "TH";
    }
  };

  // Don't render until mounted and data is loaded to avoid flash of default data
  if (!mounted || !currentTime || loading) {
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
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Get top 3 users
  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  // Display only the number of users based on displayedCount
  const displayedLeaderboard = leaderboard.slice(0, displayedCount);

  // Find current user's rank
  const currentUserRank = leaderboard.find(user => user.username === studentProfile?.username);

  const getRankColor = (rank) => {
    if (rank === 1) return "#FFD700"; // Gold
    if (rank === 2) return "#00A1FF"; // Silver
    if (rank === 3) return "#873F1E"; // Bronze
    return "var(--brand-primary)";
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) return <FaCrown className="medal-icon gold" />;
    if (rank === 2) return <FaMedal className="medal-icon silver" />;
    if (rank === 3) return <FaMedal className="medal-icon bronze" />;
    return null;
  };

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
      <main className="main-content flex flex-col justify-between min-h-screen">
        <StudentHeader 
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          studentProfile={studentProfile}
        />

        {/* Leaderboard Content */}
        <div className="leaderboard-page-container">

          {/* Top 3 Podium */}
          <div className="podium-section">
            <div className="podium-container">
              {/* 2nd Place */}
              <div className="podium-card second-place">
                <div className="podium-medal">
                  <div className="medal-badge silver-medal">
                    <span className="medal-text">2ND</span>
                  </div>
                </div>
                <div className="podium-avatar">
                  <div className="avatar-circle">
                    {topThree[1]?.username === studentProfile?.username && (studentProfile?.avatar || userProfileImage) ? (
                      <img src={studentProfile?.avatar || userProfileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <FaStar className="avatar-icon" />
                    )}
                  </div>
                </div>
                <h3 className="podium-username">{topThree[1]?.username}</h3>
                <p className="podium-xp">{topThree[1]?.xp.toLocaleString() || "0"} XP</p>
                <div className="podium-rank-badge">
                  <FaMedal className="rank-icon" />
                  <span>{getTierFromXP(topThree[1]?.xp) || "N/A"}</span>
                </div>
              </div>

              {/* 1st Place */}
              <div className="podium-card first-place">
                <div className="podium-medal">
                  <div className="medal-badge gold-medal">
                    <span className="medal-text">1ST</span>
                  </div>
                </div>
                <div className="podium-avatar">
                  <div className="avatar-circle">
                    {topThree[0]?.username === studentProfile?.username && (studentProfile?.avatar || userProfileImage) ? (
                      <img src={studentProfile?.avatar || userProfileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <FaStar className="avatar-icon" />
                    )}
                  </div>
                </div>
                <h3 className="podium-username">{topThree[0]?.username}</h3>
                <p className="podium-xp">{topThree[0]?.xp.toLocaleString() || "0"} XP</p>
                <div className="podium-rank-badge">
                  <FaCrown className="rank-icon" />
                  <span>{getTierFromXP(topThree[0]?.xp) || "N/A"}</span>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="podium-card third-place">
                <div className="podium-medal">
                  <div className="medal-badge bronze-medal">
                    <span className="medal-text">3RD</span>
                  </div>
                </div>
                <div className="podium-avatar">
                  <div className="avatar-circle">
                    {topThree[2]?.username === studentProfile?.username && (studentProfile?.avatar || userProfileImage) ? (
                      <img src={studentProfile?.avatar || userProfileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                      <FaStar className="avatar-icon" />
                    )}
                  </div>
                </div>
                <h3 className="podium-username">{topThree[2]?.username}</h3>
                <p className="podium-xp">{topThree[2]?.xp.toLocaleString() || "0"} XP</p>
                <div className="podium-rank-badge">
                  <FaMedal className="rank-icon" />
                  <span>{getTierFromXP(topThree[2]?.xp) || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full Leaderboard Table */}
          <div className="leaderboard-table-section">
            <div className="table-header">
              <div className="header-cell rank-col">Rank</div>
              <div className="header-cell username-col">Username</div>
              <div className="header-cell ranking-col">Ranking</div>
              <div className="header-cell xp-col">XP Points</div>
            </div>

            <div className="leaderboard-list">
              {displayedLeaderboard.map((user) => (
                <div 
                  key={user.rank} 
                  className={`leaderboard-row ${user.username === studentProfile?.username ? 'current-user' : ''}`}
                  style={{ 
                    borderLeft: user.rank <= 3 ? `4px solid ${getRankColor(user.rank)}` : 'none'
                  }}
                >
                  <div className="cell rank-col">
                    <div className="rank-number" style={{ color: getRankColor(user.rank) }}>
                      {user.rank <= 3 && getMedalIcon(user.rank)}
                      {user.rank > 3 && (
                        <span className="rank-text">
                          {user.rank}
                          {getOrdinalSuffix(user.rank)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="cell username-col">
                    <div className="leaderboard-user-info">
                      <div className="leaderboard-user-avatar">
                        {user.username === studentProfile?.username && (studentProfile?.avatar || userProfileImage) ? (
                          <img src={studentProfile?.avatar || userProfileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          <FaStar className="avatar-icon" />
                        )}
                      </div>
                      <span className="username">{user.username}</span>
                      {user.username === studentProfile?.username && (
                        <span className="you-badge">You</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="cell ranking-col">
                    <div className="ranking-badge">
                      {user.rank === 1 ? (
                        <FaCrown className="ranking-icon gold" />
                      ) : (
                        <FaMedal className="ranking-icon" />
                      )}
                      <span>{getTierFromXP(user.xp)}</span>
                    </div>
                  </div>
                  
                  <div className="cell xp-col">
                    <span className="xp-value">{user.xp.toLocaleString()} XP</span>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="loading-more">
                  <div className="loading-spinner"></div>
                  <span>Loading more...</span>
                </div>
              )}
              
              {/* End message when reached 100 */}
              {displayedCount >= 100 && !isLoading && (
                <div className="end-message">
                  <span>🏆 You've reached the top 100! 🏆</span>
                </div>
              )}
            </div>
          </div>

          {/* User Stats Card */}
          {currentUserRank && (
            <div className="user-stats-card">
              <h3>Your Performance</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <FaTrophy className="stat-icon" />
                  <div className="stat-info">
                    <p className="stat-label">Current Rank</p>
                    <p className="stat-value">#{currentUserRank.rank}</p>
                  </div>
                </div>
                <div className="stat-item">
                  <FaStar className="stat-icon" />
                  <div className="stat-info">
                    <p className="stat-label">Total XP</p>
                    <p className="stat-value">{currentUserRank.xp.toLocaleString() || 0}</p>
                  </div>
                </div>
                <div className="stat-item">
                  <FaFire className="stat-icon" />
                  <div className="stat-info">
                    <p className="stat-label">Study Streak</p>
                    <p className="stat-value">
                      {streakData.count} {streakData.count === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
                <div className="stat-item">
                  <FaGamepad className="stat-icon" />
                  <div className="stat-info">
                    <p className="stat-label">Quizzes Taken</p>
                    <p className="stat-value">{currentUserRank.quizzesTaken || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
