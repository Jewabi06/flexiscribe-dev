"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, LogOut, X, FileText, BookOpen, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EducatorHeader({ userName = "Educator" }) {
  const router = useRouter();
  const [openNotif, setOpenNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openProfile, setOpenProfile] = useState(false);
  const menuRef = useRef(null);

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

  // Fetch on mount + poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Click notification: navigate, mark read, soft delete
  async function handleNotificationClick(notif) {
    // Remove from local state immediately
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    setUnreadCount((prev) => (notif.read ? prev : Math.max(0, prev - 1)));
    setOpenNotif(false);

    // Soft delete from database
    try {
      await fetch(`/api/educator/notifications/${notif.id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }

    // Navigate based on notification type
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

  async function handleSignOut() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      localStorage.clear();
      sessionStorage.clear();
      const role = data.role;
      if (role === "STUDENT") {
        window.location.href = "/auth/student/login";
      } else if (role === "ADMIN") {
        window.location.href = "/";
      } else {
        window.location.href = "/auth/educator/login";
      }
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/auth/educator/login";
    }
  }

  const initial = userName?.charAt(0)?.toUpperCase() || "E";

  function getNotificationIcon(type) {
    switch (type) {
      case "transcript":
        return <FileText size={16} style={{ color: "#9d8adb" }} />;
      case "summary":
        return <BookOpen size={16} style={{ color: "#9d8adb" }} />;
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

  return (
    <div className="flex items-center gap-3 relative" ref={menuRef}>
      {/* Notification Button */}
      <button
        onClick={() => {
          setOpenNotif(!openNotif);
          if (!openNotif) fetchNotifications();
        }}
        className="w-11 h-11 lg:w-[50px] lg:h-[50px] rounded-full bg-gradient-to-br from-[#9d8adb] to-[#9d8adb] flex items-center justify-center shadow-[0_2px_10px_rgba(157,138,219,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 relative"
      >
        <Bell size={18} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-[#e74c3c] rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {openNotif && (
        <div className="absolute right-0 top-14 w-[320px] sm:w-[380px] bg-white dark:bg-[#2d2640] text-gray-800 dark:text-[#e8e8e8] rounded-xl border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
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
                <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔔</span>
                <span className="text-sm">No notifications yet</span>
                <span className="text-xs opacity-70 mt-1">You&apos;ll be notified about your documents</span>
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

      {/* Profile Button */}
      <div className="relative">
        <button
          onClick={() => setOpenProfile(!openProfile)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-11 h-11 lg:w-[50px] lg:h-[50px] rounded-full bg-gradient-to-br from-[#9d8adb] to-[#9d8adb] flex items-center justify-center text-white font-bold shadow-[0_2px_10px_rgba(157,138,219,0.3)] transition-all duration-300 group-hover:scale-105">
            {initial}
          </div>
          
          <div className="hidden md:block text-left">
            <div className="text-sm lg:text-base font-semibold text-[#4c4172] dark:text-[#e8e8e8] transition-colors leading-tight">
              {userName}
            </div>
            <div className="text-xs lg:text-sm text-[#666] dark:text-[#b0a8d4] transition-colors leading-tight">
              Instructor
            </div>
          </div>
        </button>

        {openProfile && (
          <div className="absolute right-0 top-14 min-w-[200px] bg-white dark:bg-[#2d2640] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] z-50 overflow-hidden">
            <button
              onClick={handleSignOut}
              className="w-full px-5 py-3.5 text-left text-sm hover:bg-[rgba(231,76,60,0.1)] flex items-center gap-3 text-[#e74c3c] transition-colors duration-200"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AllNotificationsModal({ notifications = [], loading, onClose, onNotificationClick, getNotificationIcon, formatTimeAgo }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#2d2640] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] w-full max-w-[700px] mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.2)]">
          <h2 className="text-base font-semibold text-[#4c4172] dark:text-[#e8e8e8]">All Notifications</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[rgba(157,138,219,0.1)] flex items-center justify-center transition-colors duration-200"
          >
            <X size={18} className="text-[#666] dark:text-[#b0a8d4]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto edu-scrollbar">
          {loading ? (
            <div className="px-5 py-12 text-center text-gray-400 dark:text-[#b0a8d4] text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400 dark:text-[#b0a8d4] text-sm">No notifications</div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => onNotificationClick(notif)}
                className={`flex gap-3 px-4 py-3 hover:bg-[rgba(157,138,219,0.08)] dark:hover:bg-[rgba(139,127,199,0.12)] transition-all duration-200 cursor-pointer ${
                  !notif.read ? "bg-[rgba(157,138,219,0.06)] dark:bg-[rgba(139,127,199,0.08)]" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-[10px] bg-[rgba(157,138,219,0.12)] flex items-center justify-center shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className={`${!notif.read ? "font-bold" : "font-medium"} text-[#4c4172] dark:text-[#c5b8f5]`}>{notif.title}</span>{" "}
                    <span className="text-gray-600 dark:text-[#b0a8d4]">{notif.message}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-[#8a82b0] mt-1">{formatTimeAgo(notif.createdAt)}</p>
                </div>
                {!notif.read && (
                  <span className="w-2 h-2 bg-[#9d8adb] rounded-full mt-2 shrink-0 animate-pulse" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}