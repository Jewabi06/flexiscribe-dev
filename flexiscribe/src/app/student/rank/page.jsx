"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaHome, FaBook, FaGamepad, FaTrophy, FaBars, FaTimes, FaMoon, FaSun, FaArrowLeft, FaMedal, FaStar, FaCrown } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { calculateRank, ALL_RANKS, toggleSidebar as utilToggleSidebar, toggleDarkMode as utilToggleDarkMode } from "../../../utils/student";
import "../dashboard/styles.css";
import "./styles.css";

export default function StudentRank() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // overview, achievements, badges
  const [studentProfile, setStudentProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [currentRank, setCurrentRank] = useState({
    name: "Learner V",
    tier: "V",
    xp: 0,
    xpMin: 0,
    xpMax: 199,
    color: "#CD7F32",
    icon: "/img/learner-5.png"
  });

  // Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };

  // Calculate rank based on XP
  const calculateRank = (xp) => {
    const allRanks = [
      { name: "Learner V", tier: "V", xpMin: 0, xpMax: 199, color: "#CD7F32", icon: "/img/learner-5.png" },
      { name: "Learner IV", tier: "IV", xpMin: 200, xpMax: 399, color: "#CD7F32", icon: "/img/learner-4.png" },
      { name: "Learner III", tier: "III", xpMin: 400, xpMax: 599, color: "#CD7F32", icon: "/img/learner-3.png" },
      { name: "Learner II", tier: "II", xpMin: 600, xpMax: 799, color: "#CD7F32", icon: "/img/learner-2.png" },
      { name: "Learner I", tier: "I", xpMin: 800, xpMax: 999, color: "#CD7F32", icon: "/img/learner-1.png" },
      { name: "Habit Builder V", tier: "V", xpMin: 1000, xpMax: 1199, color: "#C0C0C0", icon: "/img/habit-builder-5.png" },
      { name: "Habit Builder IV", tier: "IV", xpMin: 1200, xpMax: 1399, color: "#C0C0C0", icon: "/img/habit-builder-4.png" },
      { name: "Habit Builder III", tier: "III", xpMin: 1400, xpMax: 1599, color: "#C0C0C0", icon: "/img/habit-builder-3.png" },
      { name: "Habit Builder II", tier: "II", xpMin: 1600, xpMax: 1799, color: "#C0C0C0", icon: "/img/habit-builder-2.png" },
      { name: "Habit Builder I", tier: "I", xpMin: 1800, xpMax: 1999, color: "#C0C0C0", icon: "/img/habit-builder-1.png" },
      { name: "Growth Seeker V", tier: "V", xpMin: 2000, xpMax: 2299, color: "#FFD700", icon: "/img/growth-seeker-5.png" },
      { name: "Growth Seeker IV", tier: "IV", xpMin: 2300, xpMax: 2599, color: "#FFD700", icon: "/img/growth-seeker-4.png" },
      { name: "Growth Seeker III", tier: "III", xpMin: 2600, xpMax: 2899, color: "#FFD700", icon: "/img/growth-seeker-3.png" },
      { name: "Growth Seeker II", tier: "II", xpMin: 2900, xpMax: 3199, color: "#FFD700", icon: "/img/growth-seeker-2.png" },
      { name: "Growth Seeker I", tier: "I", xpMin: 3200, xpMax: 3499, color: "#FFD700", icon: "/img/growth-seeker-1.png" },
      { name: "Self-Driven V", tier: "V", xpMin: 3500, xpMax: 3899, color: "#90EE90", icon: "/img/self-driven-5.png" },
      { name: "Self-Driven IV", tier: "IV", xpMin: 3900, xpMax: 4299, color: "#90EE90", icon: "/img/self-driven-4.png" },
      { name: "Self-Driven III", tier: "III", xpMin: 4300, xpMax: 4699, color: "#90EE90", icon: "/img/self-driven-3.png" },
      { name: "Self-Driven II", tier: "II", xpMin: 4700, xpMax: 5099, color: "#90EE90", icon: "/img/self-driven-2.png" },
      { name: "Self-Driven I", tier: "I", xpMin: 5100, xpMax: 5499, color: "#90EE90", icon: "/img/self-driven-1.png" },
      { name: "Mastery V", tier: "V", xpMin: 5500, xpMax: 5999, color: "#9370DB", icon: "/img/mastery-5.png" },
      { name: "Mastery IV", tier: "IV", xpMin: 6000, xpMax: 6499, color: "#9370DB", icon: "/img/mastery-4.png" },
      { name: "Mastery III", tier: "III", xpMin: 6500, xpMax: 6999, color: "#9370DB", icon: "/img/mastery-3.png" },
      { name: "Mastery II", tier: "II", xpMin: 7000, xpMax: 7499, color: "#9370DB", icon: "/img/mastery-2.png" },
      { name: "Mastery I", tier: "I", xpMin: 7500, xpMax: 7999, color: "#9370DB", icon: "/img/mastery-1.png" },
      { name: "Peak Performer V", tier: "V", xpMin: 8000, xpMax: 8499, color: "#00CED1", icon: "/img/peak-performer-5.png" },
      { name: "Peak Performer IV", tier: "IV", xpMin: 8500, xpMax: 8999, color: "#00CED1", icon: "/img/peak-performer-4.png" },
      { name: "Peak Performer III", tier: "III", xpMin: 9000, xpMax: 9499, color: "#00CED1", icon: "/img/peak-performer-3.png" },
      { name: "Peak Performer II", tier: "II", xpMin: 9500, xpMax: 9999, color: "#00CED1", icon: "/img/peak-performer-2.png" },
      { name: "Peak Performer I", tier: "I", xpMin: 10000, xpMax: 10499, color: "#00CED1", icon: "/img/peak-performer-1.png" },
      { name: "Ascendant", tier: "VII", xpMin: 10500, xpMax: 999999, color: "#FF1493", icon: "/img/ascendant.png" }
    ];

    for (const rank of allRanks) {
      if (xp >= rank.xpMin && xp <= rank.xpMax) {
        return { ...rank, xp, allRanks };
      }
    }
    return { ...allRanks[0], xp, allRanks }; // Default to Learner V
  };

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

    // Fetch achievements from database
    const fetchAchievements = async () => {
      try {
        const response = await fetch('/api/students/achievements');
        if (response.ok) {
          const data = await response.json();
          setAchievements(data.achievements);
          
          // Notify about newly earned achievements
          if (data.newlyEarned && data.newlyEarned.length > 0) {
            const newNames = data.achievements
              .filter(a => data.newlyEarned.includes(a.id))
              .map(a => `🏆 ${a.name}`)
              .join('\n');
            setModalInfo({
              isOpen: true,
              title: "Achievement Unlocked!",
              message: `Congratulations! You've earned:\n${newNames}`,
              type: "success",
            });
          }
        } else {
          console.error('Failed to fetch achievements');
        }
      } catch (error) {
        console.error('Error fetching achievements:', error);
      }
    };

    // Fetch badges from database
    const fetchBadges = async () => {
      try {
        const response = await fetch('/api/students/badges');
        if (response.ok) {
          const data = await response.json();
          setBadges(data.badges);
          
          // Notify about newly earned badges (only if no achievement notification is showing)
          if (data.newlyEarned && data.newlyEarned.length > 0) {
            const newNames = data.badges
              .filter(b => data.newlyEarned.includes(b.id))
              .map(b => `⭐ ${b.name}`)
              .join('\n');
            // Delay slightly if achievement modal might be showing
            setTimeout(() => {
              setModalInfo({
                isOpen: true,
                title: "Badge Earned!",
                message: `Congratulations! You've earned:\n${newNames}`,
                type: "success",
              });
            }, 500);
          }
        } else {
          console.error('Failed to fetch badges');
        }
      } catch (error) {
        console.error('Error fetching badges:', error);
      }
    };

    // Fetch leaderboard rank
    const fetchLeaderboardRank = async () => {
      try {
        const response = await fetch('/api/students/leaderboard');
        if (response.ok) {
          const data = await response.json();
          // Find current student's rank in leaderboard
          const currentStudent = data.leaderboard.find(
            (student) => student.id === studentProfile?.id
          );
          if (currentStudent) {
            setLeaderboardRank(currentStudent.rank);
          }
        } else {
          console.error('Failed to fetch leaderboard');
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    };

    fetchStudentProfile();
    fetchAchievements();
    fetchBadges();

    return () => clearInterval(timer);
  }, []);

  // Fetch leaderboard rank when student profile is loaded
  useEffect(() => {
    if (studentProfile) {
      const fetchLeaderboardRank = async () => {
        try {
          const response = await fetch('/api/students/leaderboard');
          if (response.ok) {
            const data = await response.json();
            // Find current student's rank in leaderboard
            const currentStudent = data.leaderboard.find(
              (student) => student.id === studentProfile.id
            );
            if (currentStudent) {
              setLeaderboardRank(currentStudent.rank);
            }
          } else {
            console.error('Failed to fetch leaderboard');
          }
        } catch (error) {
          console.error('Error fetching leaderboard:', error);
        }
      };
      
      fetchLeaderboardRank();
    }
  }, [studentProfile]);

  const handleToggleSidebar = () => utilToggleSidebar(sidebarOpen, setSidebarOpen);
  const handleToggleDarkMode = () => utilToggleDarkMode(darkMode, setDarkMode);

  const handleBack = () => {
    router.push("/student/dashboard");
  };

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

  const xpProgress = ((currentRank.xp - currentRank.xpMin) / (currentRank.xpMax - currentRank.xpMin)) * 100;
  const earnedAchievements = achievements.filter(a => a.earned);
  const lockedAchievements = achievements.filter(a => !a.earned);
  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);
  const allRanks = currentRank.allRanks || [];

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
        
        {/* Rank Content */}
        <div className="rank-page-container">
          {/* Back Button */}
          <button className="back-button" onClick={handleBack}>
            <FaArrowLeft /> Back to Dashboard
          </button>

          {/* Page Title */}
          <div className="page-title">
            <FaTrophy className="title-icon" />
            <h1>Your Rank & Achievements</h1>
          </div>

          {/* Current Rank Banner */}
          <div className="rank-banner">
            <div className="rank-banner-left">
              <div className="rank-badge-large">
                <img src={currentRank.icon} alt={currentRank.name} />
              </div>
              <div className="rank-details">
                <h2 className="rank-title">{currentRank.name}</h2>
                <p className="rank-tier">Tier {currentRank.tier}</p>
                <div className="xp-info">
                  <span className="current-xp">{currentRank.xp.toLocaleString()} XP</span>
                  {currentRank.xpMax !== 999999 && (
                    <span className="next-rank"> / {currentRank.xpMax.toLocaleString()} XP to next rank</span>
                  )}
                </div>
                <div className="xp-progress-bar">
                  <div className="xp-progress-fill" style={{ width: `${Math.min(xpProgress, 100)}%` }}></div>
                </div>
              </div>
            </div>
            <div className="rank-banner-right">
              <div className="rank-stats-grid">
                <div className="rank-stat">
                  <FaMedal className="stat-icon" />
                  <div className="stat-info">
                    <span className="stat-value">{earnedAchievements.length}</span>
                    <span className="stat-label">Achievements</span>
                  </div>
                </div>
                <div className="rank-stat">
                  <FaStar className="stat-icon" />
                  <div className="stat-info">
                    <span className="stat-value">{earnedBadges.length}</span>
                    <span className="stat-label">Badges</span>
                  </div>
                </div>
                <div className="rank-stat">
                  <FaCrown className="stat-icon" />
                  <div className="stat-info">
                    <span className="stat-value">
                      {leaderboardRank ? `${leaderboardRank}${getOrdinalSuffix(leaderboardRank)}` : '-'}
                    </span>
                    <span className="stat-label">Leaderboard</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="rank-tabs">
            <button 
              className={`rank-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Rank Overview
            </button>
            <button 
              className={`rank-tab ${activeTab === "achievements" ? "active" : ""}`}
              onClick={() => setActiveTab("achievements")}
            >
              Achievements ({earnedAchievements.length}/{achievements.length})
            </button>
            <button 
              className={`rank-tab ${activeTab === "badges" ? "active" : ""}`}
              onClick={() => setActiveTab("badges")}
            >
              Badges ({earnedBadges.length}/{badges.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="rank-tab-content">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="overview-content">
                <h3 className="section-title">All Ranks</h3>
                <div className="ranks-grid">
                  {allRanks.slice().sort((a, b) => b.xpMin - a.xpMin).map((rank, index) => {
                    const isCurrentRank = rank.name === currentRank.name;
                    const isPassed = currentRank.xp >= rank.xpMin;
                    
                    return (
                      <div 
                        key={index} 
                        className={`rank-item ${isCurrentRank ? 'current-rank' : ''} ${isPassed ? 'passed' : 'locked'}`}
                      >
                        <div className="rank-item-icon">
                          <img src={rank.icon} alt={rank.name} />
                          {isCurrentRank && <div className="current-badge">Current</div>}
                        </div>
                        <div className="rank-item-info">
                          <h4>{rank.name}</h4>
                          <p>{rank.xpMin.toLocaleString()} - {rank.xpMax === 999999 ? '∞' : rank.xpMax.toLocaleString()} XP</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Achievements Tab */}
            {activeTab === "achievements" && (
              <div className="achievements-content">
                <h3 className="section-title">Earned Achievements</h3>
                <div className="achievements-grid">
                  {earnedAchievements.map((achievement) => (
                    <div key={achievement.id} className="achievement-card earned">
                      <div className="achievement-icon">{achievement.icon}</div>
                      <div className="achievement-info">
                        <h4>{achievement.name}</h4>
                        <p>{achievement.description}</p>
                        <span className={`achievement-rarity ${achievement.rarity}`}>{achievement.rarity}</span>
                        <span className="achievement-date">Earned: {achievement.earnedDate}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="section-title locked-section">Locked Achievements</h3>
                <div className="achievements-grid">
                  {lockedAchievements.map((achievement) => (
                    <div key={achievement.id} className="achievement-card locked">
                      <div className="achievement-icon locked-icon">🔒</div>
                      <div className="achievement-info">
                        <h4>{achievement.name}</h4>
                        <p>{achievement.description}</p>
                        <span className={`achievement-rarity ${achievement.rarity}`}>{achievement.rarity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Badges Tab */}
            {activeTab === "badges" && (
              <div className="badges-content">
                <h3 className="section-title">Earned Badges</h3>
                <div className="badges-grid">
                  {earnedBadges.map((badge) => (
                    <div key={badge.id} className="badge-card earned">
                      <div className="badge-icon">
                        {badge.icon}
                      </div>
                      <div className="badge-info">
                        <h4>{badge.name}</h4>
                        <p>{badge.description}</p>
                        <span className="badge-date">Earned: {badge.earnedDate}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="section-title locked-section">Locked Badges</h3>
                <div className="badges-grid">
                  {lockedBadges.map((badge) => (
                    <div key={badge.id} className="badge-card locked">
                      <div className="badge-icon locked-icon">🔒</div>
                      <div className="badge-info">
                        <h4>{badge.name}</h4>
                        <p>{badge.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
