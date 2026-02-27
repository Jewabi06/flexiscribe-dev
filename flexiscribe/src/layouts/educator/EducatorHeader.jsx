"use client";

import { useState, useEffect } from "react";
import { Bell, LogOut, X } from "lucide-react";

export default function EducatorHeader({ userName = "Educator" }) {
  const [openNotif, setOpenNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [openProfile, setOpenProfile] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [allNotifications, setAllNotifications] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/educator/notifications?limit=10");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    }
    fetchNotifications();
  }, []);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/educator/notifications/mark-all-read", {
        method: "POST",
      });
      const res = await fetch("/api/educator/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  async function handleViewAllNotifications() {
    setOpenNotif(false);
    setShowAllNotifs(true);
    setLoadingAll(true);
    try {
      const res = await fetch("/api/educator/notifications?limit=100");
      if (res.ok) {
        const data = await res.json();
        setAllNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Failed to fetch all notifications:", error);
    } finally {
      setLoadingAll(false);
    }
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

  const initial = userName?.charAt(0)?.toUpperCase() || "E";

  return (
    <div className="flex items-center gap-3 relative">
      {/* Notification Button */}
      <button
        onClick={() => setOpenNotif(!openNotif)}
        className="w-11 h-11 lg:w-[50px] lg:h-[50px] rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all duration-300 hover:scale-105 active:scale-95 relative"
      >
        <Bell size={18} className="text-white" />
        {notifications.filter((n) => !n.read).length > 0 && (
          <span className="edu-notif-badge absolute top-[2px] right-[2px] w-2.5 h-2.5 bg-[#e74c3c] rounded-full border-2 border-white" />
        )}
      </button>

      {openNotif && (
        <NotifDropdown
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onViewAll={handleViewAllNotifications}
          onClose={() => setOpenNotif(false)}
        />
      )}

      {/* All Notifications Modal */}
      {showAllNotifs && (
        <AllNotificationsModal
          notifications={allNotifications}
          loading={loadingAll}
          onClose={() => setShowAllNotifs(false)}
        />
      )}

      {/* Profile Button */}
      <div className="relative">
        <button
          onClick={() => setOpenProfile(!openProfile)}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="text-right hidden md:block">
            <div className="text-sm lg:text-base font-semibold text-[var(--edu-text-primary,#4c4172)] transition-colors">
              {userName}
            </div>
            <div className="text-xs lg:text-sm text-[var(--edu-text-secondary,#666)] transition-colors">Instructor</div>
          </div>

          <div className="w-11 h-11 lg:w-[50px] lg:h-[50px] rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] flex items-center justify-center text-white font-bold shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all duration-300 group-hover:scale-105">
            {initial}
          </div>
        </button>

        {openProfile && (
          <div className="edu-dropdown-animate absolute right-0 top-14 min-w-[200px] bg-white dark:bg-[#2d2640] dark:border-[rgba(139,127,199,0.25)] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-[rgba(157,138,219,0.15)] z-50 overflow-hidden">
            <button
              onClick={handleSignOut}
              className="w-full px-5 py-3.5 text-left text-sm hover:bg-[rgba(231,76,60,0.1)] dark:hover:bg-[rgba(231,76,60,0.15)] flex items-center gap-3 text-[#e74c3c] transition-colors duration-200"
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

function NotifDropdown({ notifications = [], onMarkAllRead, onViewAll, onClose }) {
  function formatTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now - created) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return created.toLocaleDateString();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="edu-dropdown-animate edu-notification-dropdown absolute right-0 top-14 w-[320px] sm:w-[380px] bg-white dark:bg-[#2d2640] dark:text-[#e8e8e8] text-gray-800 rounded-xl border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
        <div className="px-4 py-3 flex justify-between items-center border-b border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.2)]">
          <h3 className="text-sm font-semibold text-[var(--edu-text-primary,#4c4172)] dark:text-[#e8e8e8]">Notifications</h3>

          <button
            onClick={onMarkAllRead}
            className="text-xs text-[#9d8adb] hover:underline font-medium"
          >
            Mark all as read
          </button>
        </div>

        <div className="max-h-[350px] overflow-y-auto edu-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-[var(--edu-text-secondary,#666)]">
              <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</span>
              <span className="text-sm">No notifications</span>
            </div>
          ) : (
            notifications.map((item) => (
              <NotifItem
                key={item.id}
                title={item.title}
                message={item.message}
                time={formatTime(item.createdAt)}
                unread={!item.read}
              />
            ))
          )}
        </div>

        <div className="px-4 py-2 text-center border-t">
          <button
            onClick={onViewAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            View all notifications
          </button>
        </div>
      </div>
    </>
  );
}

function AllNotificationsModal({ notifications = [], loading, onClose }) {
  function formatTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now - created) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return created.toLocaleDateString();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center edu-modal-overlay">
      <div className="edu-modal-content bg-white dark:bg-[#2d2640] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] w-full max-w-[700px] mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.2)]">
          <h2 className="text-base font-semibold text-[#4c4172] dark:text-[#e8e8e8]">All Notifications</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[rgba(157,138,219,0.1)] flex items-center justify-center transition-colors duration-200"
          >
            <X size={18} className="text-[var(--edu-text-secondary,#666)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-12 text-center text-gray-400 text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-400 text-sm">No notifications</div>
          ) : (
            notifications.map((item) => (
              <NotifItem
                key={item.id}
                title={item.title}
                message={item.message}
                time={formatTime(item.createdAt)}
                unread={!item.read}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotifItem({ title, message, time, unread }) {
  const initial = title?.charAt(0)?.toUpperCase() || "N";

  return (
    <div
      className={`
        edu-notif-item flex gap-3 px-4 py-3 hover:bg-[rgba(157,138,219,0.08)] transition-all duration-200 cursor-pointer
        ${unread ? "bg-[rgba(157,138,219,0.06)]" : "bg-white"}
      `}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9d8adb]/30 to-[#4c4172]/20 text-[#6b5cbf] flex items-center justify-center text-xs font-semibold shrink-0">
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium text-[var(--edu-text-primary,#4c4172)]">{title}</span>{" "}
          <span className="text-[var(--edu-text-secondary,#666)]">{message}</span>
        </p>

        <p className="text-xs text-gray-400 mt-1">{time}</p>
      </div>

      {unread && <span className="w-2 h-2 bg-[#9d8adb] rounded-full mt-2 shrink-0" style={{ animation: 'eduPulse 2s ease-in-out infinite' }} />}
    </div>
  );
}
