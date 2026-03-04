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
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    // Optimistically remove from local state
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/admin/notifications?id=${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.read) {
      markAsRead([n.id]);
    }
    setNotifOpen(false);
    setViewAllOpen(false);
    router.push("/admin/audit-logs");
  };

  const closeAll = () => {
    setNotifOpen(false);
    setUserOpen(false);
  };

  const handleSignOut = async () => {
    closeAll();
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      localStorage.clear();
      sessionStorage.clear();
      // Redirect based on the role returned by the server
      const role = data.role;
      if (role === "STUDENT") {
        window.location.href = "/auth/student/login";
      } else if (role === "EDUCATOR") {
        window.location.href = "/auth/educator/login";
      } else {
        // Admin login is gated — go to landing page
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
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
          <div className="relative flex-1 max-w-[900px]" ref={searchRef}>
            <Search
              size={18}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9d8adb]"
            />

            <input
              type="text"
              placeholder="Search users, settings, or logs..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setSearchOpen(true);
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              name="search-field"
              id="search-field"
              data-form-type="other"
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

            {/* SEARCH RESULTS DROPDOWN */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#d6d1ee] rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(157,138,219,0.3) transparent" }}
              >
                {searching ? (
                  <div className="px-4 py-6 text-center text-sm text-[#9d8adb]">
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  searchResults.map((result, idx) => (
                    <button
                      key={result.id || idx}
                      type="button"
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f3ff] transition-colors text-left border-b border-gray-100 last:border-b-0"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f1effa] flex items-center justify-center">
                        {getSearchIcon(result.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#4c4172] truncate">
                          {result.title || result.name}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-500 truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-[#9d8adb] font-medium bg-[#f1effa] px-2 py-0.5 rounded-full">
                        {result.type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* RIGHT SECTION - ICONS */}
          <div className="ml-auto flex items-center">
            
            {/* NOTIFICATIONS - Added left margin for space */}
            <div className="relative ml-2 sm:ml-3">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setUserOpen(false);
                }}
                className="w-10 h-9 flex items-center justify-center rounded-md hover:bg-white relative"
              >
                <Bell size={18} className="text-[#6f63a6]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATIONS DROPDOWN */}
              {notifOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div 
                    className="fixed inset-0 bg-black/20 z-40 md:hidden"
                    onClick={() => setNotifOpen(false)}
                  />
                  
                  {/* Dropdown - appears below bell on all devices */}
                  <div className="absolute right-0 top-12 z-50 w-[320px] sm:w-[360px] max-w-[calc(100vw-32px)] rounded-xl bg-white border shadow-lg">
                    <div className="px-4 py-3 border-b">
                      <p className="text-sm font-semibold text-[#4c4172]">
                        Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                      </p>
                    </div>

                    <div className="divide-y max-h-[400px] overflow-y-auto">
                      {recentNotifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[#9d8adb]">
                          No notifications
                        </div>
                      ) : (
                        recentNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={`relative group px-4 py-3 hover:bg-[#f7f6fc] cursor-pointer ${
                              !n.read ? "bg-[#f0edff]" : ""
                            }`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <button
                              onClick={(e) => deleteNotification(e, n.id)}
                              className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              <X size={14} />
                            </button>
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-[#9d8adb] shrink-0" />
                              )}
                              <div className="flex-1 min-w-0 pr-5">
                                <p className="text-sm font-medium text-[#4c4172] break-words">
                                  {n.title}
                                </p>
                                <p className="text-xs text-[#6f63a6] mt-0.5 break-words">
                                  {n.message}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full ${
                                    n.type === "admin" ? "bg-purple-100 text-purple-700"
                                    : n.type === "educator" ? "bg-blue-100 text-blue-700"
                                    : n.type === "student" ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                  }`}>
                                    {n.type}
                                  </span>
                                  <span className="text-xs text-[#9d8adb]">
                                    {formatTimeAgo(n.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
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
                          className="text-sm text-[#6f63a6] hover:underline w-full py-2"
                        >
                          View all notifications
                        </button>
                      </div>
                    )}
                  </div>
                </>
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

              {/* USER MENU DROPDOWN */}
              {userOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div 
                    className="fixed inset-0 bg-black/20 z-40 md:hidden"
                    onClick={() => setUserOpen(false)}
                  />
                  
                  {/* Dropdown - appears below user button on all devices */}
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-xl bg-white border shadow-lg">
                    <div className="p-2">
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
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* SPACER */}
      <div className="h-[72px]" />

      {/* ALL NOTIFICATIONS MODAL */}
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
                className={`relative group px-4 sm:px-6 py-4 hover:bg-[#f7f6fc] cursor-pointer ${
                  !n.read ? "bg-[#f0edff]" : ""
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                <button
                  onClick={(e) => deleteNotification(e, n.id)}
                  className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <X size={14} />
                </button>
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[#9d8adb] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 pr-5">
                    <p className="text-sm font-medium text-[#4c4172] break-words">
                      {n.title}
                    </p>
                    <p className="text-xs text-[#6f63a6] mt-0.5 break-words">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full ${
                        n.type === "admin" ? "bg-purple-100 text-purple-700"
                        : n.type === "educator" ? "bg-blue-100 text-blue-700"
                        : n.type === "student" ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        {n.type}
                      </span>
                      <span className="text-xs text-[#9d8adb]">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </Modal>
      )}

      {/* PROFILE MODAL */}
      <ProfileModal
        open={profileOpen}
        defaultTab={profileTab}
        onClose={() => {
          setProfileOpen(false);
          fetchProfile();
        }}
      />
    </>
  );
}

/* MENU ITEM COMPONENT */
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

/* MODAL COMPONENT */
function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b flex-shrink-0">
          <p className="text-base sm:text-lg font-semibold text-[#4c4172] truncate pr-2">
            {title}
          </p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full flex-shrink-0"
          >
            <X size={20} className="text-[#6f63a6]" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="divide-y">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}