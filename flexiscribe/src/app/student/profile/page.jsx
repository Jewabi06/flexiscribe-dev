"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaSearch, FaArrowLeft, FaEye, FaEyeSlash, FaLock, FaUser } from "react-icons/fa";
import StudentSidebar from "@/layouts/student/StudentSidebar";
import StudentHeader from "@/layouts/student/StudentHeader";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "../../student/dashboard/styles.css";

// Default avatar options
const DEFAULT_AVATARS = [
  "/img/cat-pfp.png",
  "/img/bookworm-pfp.png",
  "/img/bee-pfp.png",
  "/img/beaver-pfp.png",
  "/img/bird-pfp.png",
  "/img/owl-pfp.png"
];

export default function StudentProfile() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState(() => {
    // Load saved profile image from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userProfileImage');
      return saved || DEFAULT_AVATARS[0];
    }
    return DEFAULT_AVATARS[0];
  });
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  
  // Password state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    verificationCode: ""
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordStep, setPasswordStep] = useState(1); // 1: Enter passwords, 2: Verify code
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [countdown, setCountdown] = useState(0);

  // Form state - will be populated from database
  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    email: "",
    studentNumber: "",
    program: "",
    yearLevel: "",
    section: "",
    gender: "",
    birthDate: ""
  });

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
          
          // Set avatar from database if available
          if (data.profile.avatar) {
            setProfileImage(data.profile.avatar);
            localStorage.setItem('userProfileImage', data.profile.avatar);
          }
          
          // Populate form with fetched data
          setFormData({
            username: data.profile.username || "",
            fullName: data.profile.fullName || "",
            email: data.profile.email || "",
            studentNumber: data.profile.studentNumber || "",
            program: data.profile.program || "",
            yearLevel: data.profile.yearLevel || "",
            section: data.profile.section || "",
            gender: data.profile.gender || "",
            birthDate: data.profile.birthDate ? new Date(data.profile.birthDate).toISOString().split('T')[0] : ""
          });
        } else {
          console.error('Failed to fetch student profile');
        }
      } catch (error) {
        console.error('Error fetching student profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentProfile();

    return () => clearInterval(timer);
  }, []);

  // Scroll to change-password section once the page has fully loaded
  useEffect(() => {
    if (mounted && !loading && window.location.hash === '#change-password') {
      const passwordSection = document.getElementById('change-password-section');
      if (passwordSection) {
        passwordSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [loading, mounted]);

  // Countdown timer for resend code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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

  const handleAvatarSelect = async (avatarUrl) => {
    setProfileImage(avatarUrl);
    setShowAvatarSelector(false);
    
    // Save to localStorage for immediate persistence
    localStorage.setItem('userProfileImage', avatarUrl);
    
    // Save to database
    try {
      const response = await fetch('/api/students/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatarUrl })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to save avatar to database:', errorData);
        // Avatar is still saved to localStorage, so user experience is not affected
        // The database will be updated once migrations are run
      } else {
        console.log('Avatar saved successfully to database');
      }
    } catch (error) {
      console.error('Error saving avatar:', error);
      // Avatar is still saved to localStorage, so user experience is not affected
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validatePassword = () => {
    const newErrors = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendVerificationCode = async () => {
    setCountdown(60); // 60 seconds cooldown
    
    try {
      const response = await fetch('/api/students/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-code',
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        setPasswordErrors({ currentPassword: data.error || 'Failed to send verification code' });
        setCountdown(0);
        return false;
      }
      
      setModalInfo({ isOpen: true, title: "Verification Code Sent", message: `A 6-digit verification code has been sent to ${formData.email}. Please check your inbox.`, type: "info" });
      return true;
    } catch (error) {
      console.error('Error sending verification code:', error);
      setPasswordErrors({ currentPassword: 'An error occurred. Please try again.' });
      setCountdown(0);
      return false;
    }
  };

  const handleContinueToVerification = async () => {
    if (!validatePassword()) {
      return;
    }
    const sent = await sendVerificationCode();
    if (sent) {
      setPasswordStep(2);
    }
  };

  const handleVerifyAndChangePassword = async () => {
    if (!passwordData.verificationCode) {
      setPasswordErrors({ verificationCode: "Please enter the verification code" });
      return;
    }

    try {
      const response = await fetch('/api/students/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-and-change',
          verificationCode: passwordData.verificationCode,
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        setPasswordErrors({ verificationCode: data.error || "Failed to change password" });
        return;
      }
      
      setModalInfo({ isOpen: true, title: "Success", message: "Password changed successfully!", type: "success" });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "", verificationCode: "" });
      setPasswordStep(1);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordErrors({ verificationCode: "An error occurred while changing password" });
    }
  };

  const handleResendCode = async () => {
    if (countdown === 0) {
      await sendVerificationCode();
    }
  };

  const handleBackToPasswordForm = () => {
    setPasswordStep(1);
    setPasswordData(prev => ({ ...prev, verificationCode: "" }));
    setPasswordErrors({});
  };

  const handleBack = () => {
    router.push("/student/dashboard");
  };

  if (!mounted || !currentTime || loading) {
    return <LoadingScreen />;
  }

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
        
        {/* Profile Content */}
        <div className="profile-content">
          <div className="profile-header">
            <button className="back-btn" onClick={handleBack}>
              <FaArrowLeft /> Back to Dashboard
            </button>
            <h1 className="profile-title">My Profile</h1>
          </div>

          <div className="profile-card">
            {/* Profile Picture Section */}
            <div className="profile-picture-section">
              <div className="profile-picture-container">
                <img src={profileImage} alt="Profile Picture" className="profile-picture" />
                <button 
                  className="profile-picture-overlay"
                  onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                  type="button"
                >
                  <FaUser />
                  <span>Change Avatar</span>
                </button>
              </div>
              
              {/* Avatar Selector */}
              {showAvatarSelector && (
                <div className="avatar-selector">
                  <h3 className="avatar-selector-title">Choose Your Avatar</h3>
                  <div className="avatar-grid">
                    {DEFAULT_AVATARS.map((avatar, index) => (
                      <div
                        key={index}
                        className={`avatar-option ${profileImage === avatar ? 'selected' : ''}`}
                        onClick={() => handleAvatarSelect(avatar)}
                      >
                        <img src={avatar} alt={`Avatar ${index + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Form */}
            <div className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    disabled
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    disabled
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="studentNumber">Student Number</label>
                  <input
                    type="text"
                    id="studentNumber"
                    name="studentNumber"
                    value={formData.studentNumber}
                    disabled
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="program">Program</label>
                  <input
                    type="text"
                    id="program"
                    name="program"
                    value={formData.program}
                    disabled
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="yearLevel">Year Level</label>
                  <input
                    type="text"
                    id="yearLevel"
                    name="yearLevel"
                    value={formData.yearLevel}
                    disabled
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="section">Section</label>
                  <input
                    type="text"
                    id="section"
                    name="section"
                    value={formData.section}
                    disabled
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <input
                    type="text"
                    id="gender"
                    name="gender"
                    value={formData.gender === 'MALE' ? 'Male' : formData.gender === 'FEMALE' ? 'Female' : formData.gender === 'OTHER' ? 'Other' : formData.gender === 'PREFER_NOT_TO_SAY' ? 'Prefer not to say' : formData.gender}
                    disabled
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="birthDate">Birth Date</label>
                  <input
                    type="date"
                    id="birthDate"
                    name="birthDate"
                    value={formData.birthDate}
                    disabled
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div id="change-password-section" className="profile-card" style={{ marginTop: '2rem' }}>
            <div className="password-section">
              <div className="password-header">
                <FaLock className="password-icon" />
                <h2 className="password-title">Change Password</h2>
              </div>
              
              {/* Step 1: Enter Passwords */}
              {passwordStep === 1 && (
                <div className="password-form">
                  {/* FIX: HIDDEN HONEY-TRAP FIELD 
                    This tricks the browser's password manager into auto-filling the username 
                    here instead of leaking it into the dashboard search bar. 
                  */}
                  <input 
                    type="text" 
                    name="username" 
                    autoComplete="username" 
                    style={{ display: 'none' }} 
                    aria-hidden="true" 
                    tabIndex="-1"
                  />
                  {/* Current Password */}
                  <div className="form-group">
                    <label htmlFor="currentPassword">Current Password</label>
                    <div className="password-input-container">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        id="currentPassword"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        autoComplete="current-password" /* Update 'off' to a semantic tag */
                        className={passwordErrors.currentPassword ? "error" : ""}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <FaEye /> : <FaEyeSlash />}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && (
                      <span className="error-message">{passwordErrors.currentPassword}</span>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="form-group">
                    <label htmlFor="newPassword">New Password</label>
                    <div className="password-input-container">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        id="newPassword"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        autoComplete="new-password"
                        className={passwordErrors.newPassword ? "error" : ""}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <FaEye /> : <FaEyeSlash />}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <span className="error-message">{passwordErrors.newPassword}</span>
                    )}
                    <span className="hint-text">Password must be at least 8 characters</span>
                  </div>

                  {/* Confirm New Password */}
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <div className="password-input-container">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        autoComplete="new-password"
                        className={passwordErrors.confirmPassword ? "error" : ""}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <span className="error-message">{passwordErrors.confirmPassword}</span>
                    )}
                  </div>

                  <div className="form-actions">
                    <button className="save-btn" onClick={handleContinueToVerification}>
                      <FaLock /> Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Verification Code */}
              {passwordStep === 2 && (
                <div className="password-form verification-step">
                  <p className="verification-text">
                    A verification code has been sent to <strong>{formData.email}</strong>. 
                    Please enter the 6-digit code below to complete the password change.
                  </p>
                  
                  <div className="form-group">
                    <label htmlFor="verificationCode">Verification Code</label>
                    <input
                      type="text"
                      id="verificationCode"
                      name="verificationCode"
                      value={passwordData.verificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPasswordData(prev => ({ ...prev, verificationCode: value }));
                        setPasswordErrors(prev => ({ ...prev, verificationCode: "" }));
                      }}
                      className={passwordErrors.verificationCode ? "error" : ""}
                      placeholder="000000"
                      maxLength={6}
                      style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
                    />
                    {passwordErrors.verificationCode && (
                      <span className="error-message">{passwordErrors.verificationCode}</span>
                    )}
                  </div>

                  <div className="resend-code-section">
                    <button
                      type="button"
                      className="resend-code-btn"
                      onClick={handleResendCode}
                      disabled={countdown > 0}
                    >
                      {countdown > 0 
                        ? `Resend code in ${countdown}s` 
                        : "Resend code"
                      }
                    </button>
                  </div>

                  <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      className="save-btn" 
                      onClick={handleBackToPasswordForm}
                      style={{ flex: 1, background: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      Back
                    </button>
                    <button 
                      className="save-btn" 
                      onClick={handleVerifyAndChangePassword}
                      style={{ flex: 1 }}
                    >
                      <FaLock /> Verify & Change Password
                    </button>
                  </div>
                </div>
              )}
            </div>
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
