"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaBell, FaFileAlt, FaBook, FaCheck, FaTrophy, FaMedal } from "react-icons/fa";

export default function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/students/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications on mount and poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    // Refresh notifications when opening
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/students/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "transcript":
        return <FaFileAlt style={{ color: "var(--accent-primary)" }} />;
      case "summary":
        return <FaBook style={{ color: "var(--accent-primary)" }} />;
      case "transcript_summary":
        return <FaBook style={{ color: "var(--accent-primary)" }} />;
      case "achievement":
        return <FaTrophy style={{ color: "#f39c12" }} />;
      case "badge":
        return <FaMedal style={{ color: "#9b59b6" }} />;
      default:
        return <FaBell style={{ color: "var(--accent-primary)" }} />;
    }
  };

  const formatTimeAgo = (dateStr) => {
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
  };

  return (
    <div className="notification-menu-container" ref={menuRef}>
      <button className="notification-btn" onClick={toggleMenu}>
        <FaBell />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-primary)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaCheck /> Mark all read
              </button>
            )}
          </div>

          <div className="notification-list" style={{
            maxHeight: "350px",
            overflowY: "auto",
          }}>
            {loading && notifications.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '3rem 1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <p style={{ fontSize: '0.9rem' }}>Loading...</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(157, 138, 219, 0.1)",
                    background: notif.read ? "transparent" : "rgba(157, 138, 219, 0.06)",
                    cursor: "default",
                    transition: "background 0.2s ease",
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(157, 138, 219, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "0.9rem",
                  }}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "0.85rem",
                      fontWeight: notif.read ? 500 : 700,
                      color: "var(--text-primary)",
                      marginBottom: "2px",
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}>
                      {notif.message}
                    </div>
                    <div style={{
                      fontSize: "0.72rem",
                      color: "var(--text-secondary)",
                      opacity: 0.7,
                      marginTop: "4px",
                    }}>
                      {formatTimeAgo(notif.createdAt)}
                    </div>
                  </div>
                  {!notif.read && (
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--accent-primary)",
                      flexShrink: 0,
                      marginTop: "6px",
                    }} />
                  )}
                </div>
              ))
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '3rem 1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <div>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>No notifications yet</p>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>You'll be notified when your educator uploads transcripts or summaries</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
