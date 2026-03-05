"use client";

/* ================= IMPORTS ================= */
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sun, Moon, X, Lock, Eye, EyeOff, FileText, BookOpen, CheckCircle, User, LogOut } from "lucide-react";

/* ================= MAIN ================= */

export default function ProfessorProfileCard() {
  const router = useRouter();
  const [openNotif, setOpenNotif] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [educator, setEducator] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mobile/tablet dropdown
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
  const mobileRef = useRef(null);
  const desktopNotifRef = useRef(null);

  /* THEME INIT */
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  /* FETCH EDUCATOR PROFILE */
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/educator/profile");
        if (res.ok) {
          const data = await res.json();
          setEducator(data.educator);
          setName(data.educator.fullName.split(" ")[0] || "Professor");
        } else {
          setName("Professor");
        }
      } catch (error) {
        console.error("Failed to fetch educator profile:", error);
        setName("Professor");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  /* FETCH NOTIFICATIONS - with polling */
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/educator/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        const notifs = data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.read).length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  /* CLOSE ON OUTSIDE CLICK */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target)) {
        setMobileDropdownOpen(false);
        setMobileNotifOpen(false);
      }
      if (desktopNotifRef.current && !desktopNotifRef.current.contains(e.target)) {
        setOpenNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleDarkMode() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/auth/educator/login";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/auth/educator/login";
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/educator/notifications/mark-all-read", {
        method: "POST",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  // Click notification: navigate, soft delete
  async function handleNotificationClick(notif) {
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    setUnreadCount((prev) => (notif.read ? prev : Math.max(0, prev - 1)));
    setOpenNotif(false);
    setMobileNotifOpen(false);
    setMobileDropdownOpen(false);

    try {
      await fetch(`/api/educator/notifications/${notif.id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }

    switch (notif.type) {
      case "transcript":
      case "summary":
      case "transcript_summary":
        router.push("/educator/transcriptions");
        break;
      default:
        router.push("/educator/dashboard");
        break;
    }
  }

  function getNotificationIcon(type) {
    switch (type) {
      case "transcript":
        return <FileText size={16} style={{ color: "#9d8adb" }} />;
      case "summary":
      case "transcript_summary":
        return <BookOpen size={16} style={{ color: "#9d8adb" }} />;
      default:
        return <Bell size={16} style={{ color: "#9d8adb" }} />;
    }
  }

  function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  }

  const initial = loading ? "..." : (name?.charAt(0)?.toUpperCase() || "?");

  /* SHARED NOTIFICATION DROPDOWN CONTENT */
  function renderNotifDropdown(isOpen) {
    if (!isOpen) return null;
    return (
      <div className="absolute right-0 top-12 w-[320px] sm:w-[380px] bg-white dark:bg-[#2d2640] text-gray-800 dark:text-[#e8e8e8] rounded-xl border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
        <div className="px-4 py-3 flex justify-between items-center border-b border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.2)]">
          <h3 className="text-sm font-semibold text-[#4c4172] dark:text-[#e8e8e8]">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-[#9d8adb] hover:underline font-medium flex items-center gap-1"
            >
              <CheckCircle size={12} /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[350px] overflow-y-auto edu-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-gray-500 dark:text-[#b0a8d4]">
              <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{"🔔"}</span>
              <span className="text-sm">No notifications yet</span>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex gap-3 px-4 py-3 hover:bg-[rgba(157,138,219,0.1)] dark:hover:bg-[rgba(139,127,199,0.12)] transition-all duration-200 cursor-pointer ${
                  !notif.read ? "bg-[rgba(157,138,219,0.06)] dark:bg-[rgba(139,127,199,0.08)]" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-[10px] bg-[rgba(157,138,219,0.12)] flex items-center justify-center shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[0.85rem] ${!notif.read ? "font-bold" : "font-medium"} text-[#4c4172] dark:text-[#c5b8f5]`}>
                    {notif.title}
                  </div>
                  <div className="text-[0.8rem] text-gray-600 dark:text-[#b0a8d4] leading-snug">
                    {notif.message}
                  </div>
                  <div className="text-[0.72rem] text-gray-400 dark:text-[#8a82b0] mt-1">
                    {formatTimeAgo(notif.createdAt)}
                  </div>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-[#9d8adb] shrink-0 mt-2 animate-pulse" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        {/* MOBILE/TABLET shimmer */}
        <div className="lg:hidden flex justify-end">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] animate-pulse" />
        </div>
        {/* DESKTOP shimmer */}
        <div className="hidden lg:block">
          <div className="w-full min-h-[140px] sm:min-h-[160px] md:min-h-[170px] lg:min-h-[180px] bg-gradient-to-br from-[#9d8adb] to-[#4c4172] rounded-[16px] md:rounded-[24px] lg:rounded-[30px] animate-pulse" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* ========== MOBILE / TABLET: Avatar button + Dropdown ========== */}
      <div className="lg:hidden flex items-center gap-2 relative" ref={mobileRef}>
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setMobileNotifOpen(!mobileNotifOpen);
              setMobileDropdownOpen(false);
              if (!mobileNotifOpen) fetchNotifications();
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#9d8adb] flex items-center justify-center shadow-[0_2px_10px_rgba(157,138,219,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 relative"
          >
            <Bell size={17} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-[#e74c3c] rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white dark:border-[#1a1625]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {renderNotifDropdown(mobileNotifOpen)}
        </div>

        {/* Profile Avatar */}
        <button
          onClick={() => {
            setMobileDropdownOpen(!mobileDropdownOpen);
            setMobileNotifOpen(false);
          }}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#9d8adb] flex items-center justify-center shadow-[0_2px_10px_rgba(157,138,219,0.3)] text-white font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
        >
          {initial}
        </button>

        {/* Dropdown Menu */}
        {mobileDropdownOpen && (
          <div className="absolute right-0 top-14 min-w-[220px] bg-white dark:bg-[#2d2640] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] z-50 overflow-hidden">
            {/* User Info + Theme Toggle */}
            <div className="px-4 py-3 border-b border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.2)] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#4c4172] dark:text-[#e8e8e8]">{educator.username}</p>
                <p className="text-xs text-[#666] dark:text-[#b0a8d4]">Instructor</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDarkMode();
                }}
                className="w-8 h-8 rounded-full bg-[rgba(157,138,219,0.12)] dark:bg-[rgba(139,127,199,0.2)] flex items-center justify-center hover:bg-[rgba(157,138,219,0.25)] dark:hover:bg-[rgba(139,127,199,0.35)] transition-colors duration-200"
              >
                {dark ? <Moon size={15} className="text-[#9d8adb]" /> : <Sun size={15} className="text-[#9d8adb]" />}
              </button>
            </div>

            <div className="py-1">
              {/* Edit Profile */}
              <button
                onClick={() => {
                  setMobileDropdownOpen(false);
                  setEditOpen(true);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-[#4c4172] dark:text-[#e8e8e8] hover:bg-[rgba(157,138,219,0.08)] dark:hover:bg-[rgba(139,127,199,0.12)] flex items-center gap-3 transition-colors duration-200"
              >
                <User size={16} className="text-[#9d8adb]" />
                Edit Profile
              </button>

              {/* Sign Out */}
              <button
                onClick={() => {
                  setMobileDropdownOpen(false);
                  handleSignOut();
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-[rgba(231,76,60,0.1)] flex items-center gap-3 text-[#e74c3c] transition-colors duration-200"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========== DESKTOP: Big gradient card ========== */}
      <div className="hidden lg:block">
        <ProfileCard
          name={name}
          username={educator?.username || "Educator"}
          dark={dark}
          toggleDarkMode={toggleDarkMode}
          openNotif={openNotif}
          setOpenNotif={(v) => {
            setOpenNotif(v);
            if (v) fetchNotifications();
          }}
          setEditOpen={setEditOpen}
          handleSignOut={handleSignOut}
          notifications={notifications}
          unreadCount={unreadCount}
          handleMarkAllRead={handleMarkAllRead}
          handleNotificationClick={handleNotificationClick}
          getNotificationIcon={getNotificationIcon}
          formatTimeAgo={formatTimeAgo}
          desktopNotifRef={desktopNotifRef}
        />
      </div>

      {/* EDIT PROFILE */}
      {editOpen && (
        <Modal onClose={() => setEditOpen(false)}>
          <EditProfile
            educator={educator}
            setEducator={setEducator}
            setName={setName}
            setEditOpen={setEditOpen}
          />
        </Modal>
      )}
    </>
  );
}

/* ================= PROFILE CARD (DESKTOP) ================= */

function ProfileCard({
  name,
  username,
  dark,
  toggleDarkMode,
  openNotif,
  setOpenNotif,
  setEditOpen,
  handleSignOut,
  notifications,
  unreadCount,
  handleMarkAllRead,
  handleNotificationClick,
  getNotificationIcon,
  formatTimeAgo,
  desktopNotifRef,
}) {
  return (
    <div
      className={`
        edu-profile-card
        relative
        w-full
        min-h-[140px] sm:min-h-[160px] md:min-h-[170px] lg:min-h-[180px]
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        text-white
        rounded-[24px] lg:rounded-[36px]
        px-5 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 lg:px-8 lg:py-7
        shadow-[0_14px_40px_rgba(0,0,0,0.18)]
        flex flex-col
      `}
      style={{ zIndex: openNotif ? 60 : "auto" }}
    >
      {/* NOTIFICATION */}
      <div className="absolute top-6 right-6" ref={desktopNotifRef}>
        <button
          onClick={() => setOpenNotif(!openNotif)}
          className="transition-all duration-300 hover:scale-110 active:scale-95 relative"
        >
          <Bell size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#e74c3c] rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-[#4c4172]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {openNotif && (
          <div className="edu-dropdown-animate absolute right-0 mt-3 w-[320px] sm:w-[380px] bg-white dark:bg-[#2d2640] text-gray-800 dark:text-[#e8e8e8] rounded-xl border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
            <div className="px-4 py-3 flex justify-between items-center border-b border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.2)]">
              <h3 className="text-sm font-semibold text-[#4c4172] dark:text-[#e8e8e8]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-[#9d8adb] hover:underline font-medium flex items-center gap-1"
                >
                  <CheckCircle size={12} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[350px] overflow-y-auto edu-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-gray-500 dark:text-[#b0a8d4]">
                  <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{"🔔"}</span>
                  <span className="text-sm">No notifications yet</span>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex gap-3 px-4 py-3 hover:bg-[rgba(157,138,219,0.1)] dark:hover:bg-[rgba(139,127,199,0.12)] transition-all duration-200 cursor-pointer ${
                      !notif.read ? "bg-[rgba(157,138,219,0.06)] dark:bg-[rgba(139,127,199,0.08)]" : ""
                    }`}
                  >
                    <div className="w-9 h-9 rounded-[10px] bg-[rgba(157,138,219,0.12)] flex items-center justify-center shrink-0">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[0.85rem] ${!notif.read ? "font-bold" : "font-medium"} text-[#4c4172] dark:text-[#c5b8f5]`}>
                        {notif.title}
                      </div>
                      <div className="text-[0.8rem] text-gray-600 dark:text-[#b0a8d4] leading-snug">
                        {notif.message}
                      </div>
                      <div className="text-[0.72rem] text-gray-400 dark:text-[#8a82b0] mt-1">
                        {formatTimeAgo(notif.createdAt)}
                      </div>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-[#9d8adb] shrink-0 mt-2 animate-pulse" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* USER INFO */}
      <div className="flex items-center gap-4">
        <Avatar name={name} />
        <div>
          <p className="text-base sm:text-lg md:text-xl font-semibold">{username}</p>
          <p className="text-white/80 text-xs sm:text-sm">Instructor</p>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="mt-auto flex items-center gap-4 text-white/80 text-sm">
        <p
          onClick={() => setEditOpen(true)}
          className="cursor-pointer hover:text-white transition-colors duration-200 hover:underline"
        >
          Edit Profile
        </p>
        <span className="text-white/30">|</span>
        <p
          onClick={handleSignOut}
          className="cursor-pointer hover:text-[#e74c3c] transition-colors duration-200 hover:underline"
        >
          Sign Out
        </p>
      </div>

      {/* DARK MODE */}
      <button
        onClick={toggleDarkMode}
        className="edu-theme-toggle absolute right-5 bottom-5 w-11 h-11 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all duration-300"
      >
        {dark ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
  );
}

/* ================= EDIT PROFILE ================= */

function EditProfile({ setEditOpen, educator, setEducator, setName }) {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    gender: "",
    birthDate: "",
  });
  const [loading, setLoading] = useState(false);

  // Change Password state
  const [cpOpen, setCpOpen] = useState(false);
  const [cpData, setCpData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [cpErrors, setCpErrors] = useState({});
  const [cpLoading, setCpLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [cpSuccess, setCpSuccess] = useState(false);
  const [cpRequestPending, setCpRequestPending] = useState(false);

  useEffect(() => {
    if (educator) {
      setFormData({
        fullName: educator.fullName || "",
        username: educator.username || "",
        gender: educator.gender || "",
        birthDate: educator.birthDate ? educator.birthDate.split("T")[0] : "",
      });
    }
  }, [educator]);

  useEffect(() => {
    // Check for existing pending password request
    async function checkPendingRequest() {
      try {
        const res = await fetch("/api/educator/change-password");
        if (res.ok) {
          const data = await res.json();
          if (data.request?.status === "pending") {
            setCpRequestPending(true);
          }
        }
      } catch (e) {
        console.error("Error checking password request:", e);
      }
    }
    checkPendingRequest();
  }, []);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/educator/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setEducator(data.educator);
        setName(data.educator.fullName.split(" ")[0] || "Professor");
        setEditOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("An error occurred while saving");
    } finally {
      setLoading(false);
    }
  }

  function cpValidate() {
    const newErrors = {};
    if (!cpData.currentPassword) newErrors.currentPassword = "Current password is required";
    if (!cpData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (cpData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }
    if (!cpData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (cpData.newPassword !== cpData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (cpData.currentPassword && cpData.currentPassword === cpData.newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }
    setCpErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function cpSubmitRequest() {
    if (!cpValidate()) return;
    setCpLoading(true);
    try {
      const res = await fetch("/api/educator/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cpData.currentPassword, newPassword: cpData.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCpErrors({ currentPassword: data.error || "Failed to submit request" });
        return;
      }
      setCpSuccess(true);
      setCpRequestPending(true);
      setTimeout(() => {
        setCpSuccess(false);
        setCpOpen(false);
        setCpData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }, 3000);
    } catch {
      setCpErrors({ currentPassword: "An error occurred. Please try again." });
    } finally {
      setCpLoading(false);
    }
  }

  function cpClose() {
    setCpOpen(false);
    setCpData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setCpErrors({});
    setCpSuccess(false);
  }

  return (
    <div className="bg-white dark:bg-[#2d2640] dark:text-[#e8e8e8] w-full rounded-[20px] p-6 text-gray-700">
      <h2 className="text-xl font-semibold mb-5 text-[#4c4172] dark:text-[#c5b8f5]">
        Edit Profile
      </h2>

      {/* FORM */}
      <div className="space-y-4 text-sm">
        <Input
          label="Full Name"
          value={formData.fullName}
          onChange={(e) =>
            setFormData({ ...formData, fullName: e.target.value })
          }
        />

        <Input
          label="Username"
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value })
          }
        />

        <div>
          <label className="block mb-1 font-medium">Gender</label>
          <select
            value={formData.gender}
            onChange={(e) =>
              setFormData({ ...formData, gender: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border outline-none"
          >
            <option value="">Select Gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        </div>

        <Input
          label="Birth Date"
          type="date"
          value={formData.birthDate}
          onChange={(e) =>
            setFormData({ ...formData, birthDate: e.target.value })
          }
        />

        <Input
          label="Email"
          value={educator?.user?.email || ""}
          disabled
        />

        <Input
          label="Department"
          value={educator?.department?.name || ""}
          disabled
        />
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => setEditOpen(false)}
          className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 transition-all duration-200 hover:bg-gray-200"
          disabled={loading}
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white disabled:opacity-50 transition-all duration-300 hover:shadow-[0_4px_15px_rgba(157,138,219,0.4)] hover:translate-y-[-2px]"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* CHANGE PASSWORD SECTION */}
      <div className="mt-6 border-t border-[rgba(157,138,219,0.2)] pt-5">
        <button
          onClick={() => cpOpen ? cpClose() : setCpOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-[#8b5cf6] hover:text-[#6d28d9] transition-colors duration-200"
        >
          <Lock size={15} />
          {cpOpen ? "Cancel Password Change" : "Change Password"}
        </button>

        {cpOpen && (
          <div className="mt-4">
            {cpSuccess ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm py-2">
                <Lock size={16} />
                <span>Your password change request has been submitted to the admin for approval.</span>
              </div>
            ) : cpRequestPending ? (
              <div style={{ 
                padding: '0.75rem 1rem', borderRadius: '8px',
                background: '#fff3e0', border: '1px solid #ffe0b2', color: '#e65100', fontSize: '0.85rem'
              }}>
                <strong>Pending Request:</strong> You already have a password change request awaiting admin approval. You will be notified once it is processed.
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block mb-1 font-medium text-[#4c4172]">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      value={cpData.currentPassword}
                      onChange={(e) => { setCpData(p => ({...p, currentPassword: e.target.value})); setCpErrors(p => ({...p, currentPassword: ""})); }}
                      autoComplete="off"
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border-2 ${cpErrors.currentPassword ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)]`}
                    />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {cpErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{cpErrors.currentPassword}</p>}
                </div>

                <div>
                  <label className="block mb-1 font-medium text-[#4c4172]">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={cpData.newPassword}
                      onChange={(e) => { setCpData(p => ({...p, newPassword: e.target.value})); setCpErrors(p => ({...p, newPassword: ""})); }}
                      autoComplete="off"
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border-2 ${cpErrors.newPassword ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)]`}
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {cpErrors.newPassword && <p className="text-red-500 text-xs mt-1">{cpErrors.newPassword}</p>}
                  <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters</p>
                </div>

                <div>
                  <label className="block mb-1 font-medium text-[#4c4172]">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      value={cpData.confirmPassword}
                      onChange={(e) => { setCpData(p => ({...p, confirmPassword: e.target.value})); setCpErrors(p => ({...p, confirmPassword: ""})); }}
                      autoComplete="off"
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border-2 ${cpErrors.confirmPassword ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)]`}
                    />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {cpErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{cpErrors.confirmPassword}</p>}
                </div>

                <div className="flex justify-end mt-2">
                  <button
                    onClick={cpSubmitRequest}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white text-sm disabled:opacity-50 transition-all duration-300 hover:shadow-[0_4px_15px_rgba(157,138,219,0.4)] hover:translate-y-[-1px] flex items-center gap-2"
                    disabled={cpLoading}
                  >
                    <Lock size={14} />
                    {cpLoading ? "Submitting..." : "Submit Change Request"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">Your request will be sent to the admin for approval.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= MODAL ================= */

function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center edu-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="edu-modal-content bg-white dark:bg-[#2d2640] rounded-[20px] w-[90%] max-w-[480px] p-4 max-h-[85vh] overflow-y-auto edu-scrollbar relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-gray-100 dark:bg-[#3a3456] hover:bg-[rgba(157,138,219,0.15)] dark:hover:bg-[rgba(139,127,199,0.2)] rounded-full p-2 transition-colors duration-200"
        >
          <X size={18} />
        </button>

        {children}
      </div>
    </div>
  );
}

/* ================= UI PARTS ================= */

function Input({ label, ...props }) {
  return (
    <div>
      <label className="block mb-1 font-medium text-[#4c4172]">{label}</label>

      <input
        {...props}
        className="w-full px-4 py-2.5 rounded-xl border-2 border-[rgba(157,138,219,0.3)] outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)] disabled:bg-[rgba(157,138,219,0.08)] disabled:cursor-not-allowed"
      />
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-white/30 flex items-center justify-center text-lg sm:text-xl font-semibold uppercase shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:scale-105">
      {name?.charAt(0) || "?"}
    </div>
  );
}
