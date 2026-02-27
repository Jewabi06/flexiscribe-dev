"use client";

import {
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  X,
  Menu,
  Users,
  GraduationCap,
  Activity,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProfileModal from "@/components/admin/modals/ProfileModal";

export default function TopBar({ onMenuClick }) {
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("profile");
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  // Fetch notifications and profile
  useEffect(() => {
    fetchNotifications();
    fetchProfile();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    setSearchOpen(true);
    setSearching(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSearchResultClick = (result) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(result.href);
  };

  const getSearchIcon = (type) => {
    switch (type) {
      case "user": return <Users size={14} className="text-[#9d8adb]" />;
      case "class": return <GraduationCap size={14} className="text-[#9d8adb]" />;
      case "activity": return <Activity size={14} className="text-[#9d8adb]" />;
      default: return <Search size={14} className="text-[#9d8adb]" />;
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/admin/profile");
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(data.admin);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const markAsRead = async (notificationIds) => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      // Refresh notifications
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const closeAll = () => {
    setNotifOpen(false);
    setUserOpen(false);
  };

  const handleSignOut = async () => {
    closeAll();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/auth/admin/login";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/auth/admin/login";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recentNotifications = notifications.slice(0, 3);

  const getInitials = (name) => {
    if (!name) return "A";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <>
      {/* HEADER */}
      <header
        className="
          fixed top-0 right-0 z-50
          bg-[#f4f3fb] border-b border-[#e6e3f3]
          w-full md:left-[345px] md:w-[calc(100%-345px)]
        "
      >
        <div className="h-[72px] flex items-center px-4 sm:px-10">

          {/* MOBILE MENU BUTTON */}
          <button
            onClick={onMenuClick}
            className="md:hidden mr-3 p-2 rounded-lg hover:bg-white"
          >
            <Menu size={22} className="text-[#4c4172]" />
          </button>

          {/* SEARCH */}
          <div className="relative flex-1 max-w-[900px]">
            <Search
              size={18}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9d8adb]"
            />

            <input
              type="text"
              placeholder="Search or run a command"
              className="
                w-full h-[48px]
                pl-14 pr-4
                rounded-lg
                bg-white
                border border-[#dedbf0]
                text-[#4c4172]
                placeholder:text-[#9d8adb]
                outline-none
                focus:border-[#9d8adb]
                focus:ring-1 focus:ring-[#9d8adb]/30
                transition
              "
            />
          </div>

          {/* RIGHT */}
          <div className="ml-auto flex items-center gap-4">

            {/* NOTIFICATIONS */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setUserOpen(false);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white"
              >
                <Bell size={18} className="text-[#6f63a6]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-[320px] sm:w-[360px] rounded-xl bg-white border shadow-lg">
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-semibold text-[#4c4172]">
                      Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                    </p>
                  </div>

                  <div className="divide-y max-h-[300px] overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[#9d8adb]">
                        No notifications
                      </div>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 hover:bg-[#f7f6fc] cursor-pointer ${
                            !n.read ? "bg-blue-50/30" : ""
                          }`}
                          onClick={() => {
                            if (!n.read) {
                              markAsRead([n.id]);
                            }
                          }}
                        >
                          <p className="text-sm font-medium text-[#4c4172]">
                            {n.title}
                          </p>
                          <p className="text-xs text-[#6f63a6]">
                            {n.message}
                          </p>
                          <p className="text-xs text-[#9d8adb] mt-1">
                            {formatTimeAgo(n.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t text-center">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          setViewAllOpen(true);
                        }}
                        className="text-sm text-[#6f63a6] hover:underline"
                      >
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* USER MENU */}
            <div className="relative">
              <button
                onClick={() => {
                  setUserOpen(!userOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white"
              >
                <div className="w-8 h-8 rounded-full bg-[#9d8adb] flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(adminProfile?.fullName || "Admin")}
                </div>

                <span className="hidden sm:block text-sm font-medium text-[#4c4172]">
                  {adminProfile?.fullName || "Admin"}
                </span>

                <ChevronDown size={14} className="text-[#6f63a6]" />
              </button>

              {userOpen && (
                <div className="absolute right-0 top-12 w-56 rounded-xl bg-white border shadow-lg p-2">
                  <MenuItem
                    icon={<User size={16} />}
                    label="View Profile"
                    onClick={() => {
                      setProfileTab("profile");
                      setProfileOpen(true);
                      closeAll();
                    }}
                  />

                  <MenuItem
                    icon={<Settings size={16} />}
                    label="Account Settings"
                    onClick={() => {
                      setProfileTab("security");
                      setProfileOpen(true);
                      closeAll();
                    }}
                  />

                  <div className="my-2 h-px bg-[#ece9f6]" />

                  <MenuItem
                    icon={<LogOut size={16} />}
                    label="Sign out"
                    onClick={handleSignOut}
                    danger
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* SPACER */}
      <div className="h-[72px]" />

      {/* MODALS */}
      {viewAllOpen && (
        <Modal
          title="All Notifications"
          onClose={() => setViewAllOpen(false)}
        >
          {notifications.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#9d8adb]">
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-6 py-4 hover:bg-[#f7f6fc] cursor-pointer ${
                  !n.read ? "bg-blue-50/30" : ""
                }`}
                onClick={() => {
                  if (!n.read) {
                    markAsRead([n.id]);
                  }
                }}
              >
                <p className="text-sm font-medium text-[#4c4172]">
                  {n.title}
                </p>
                <p className="text-xs text-[#6f63a6] mt-1">
                  {n.message}
                </p>
                <p className="text-xs text-[#9d8adb] mt-1">
                  {formatTimeAgo(n.createdAt)}
                </p>
              </div>
            ))
          )}
        </Modal>
      )}

      <ProfileModal
        open={profileOpen}
        defaultTab={profileTab}
        onClose={() => {
          setProfileOpen(false);
          fetchProfile(); // Refresh profile after closing modal
        }}
      />
    </>
  );
}

/* SMALL COMPONENTS */

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
        ${danger
          ? "text-red-600 hover:bg-[#fdecec]"
          : "text-[#4c4172] hover:bg-[#f4f3fb]"
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <p className="text-lg font-semibold text-[#4c4172]">{title}</p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} className="text-[#6f63a6]" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y">
          {children}
        </div>
      </div>
    </div>
  );
}
