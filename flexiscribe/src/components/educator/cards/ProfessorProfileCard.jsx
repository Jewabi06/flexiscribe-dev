"use client";

/* ================= IMPORTS ================= */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sun, Moon, X } from "lucide-react";

/* ================= MAIN ================= */

export default function ProfessorProfileCard() {
  const router = useRouter();
  const [openNotif, setOpenNotif] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [educator, setEducator] = useState(null);
  const [notifications, setNotifications] = useState([]);

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

  /* FETCH NOTIFICATIONS */
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

  function toggleDarkMode() {
    const next = !dark;

    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    try {
      // Call logout API to clear the auth cookie
      await fetch("/api/auth/logout", { method: "POST" });
      
      // Clear any client-side storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to login
      window.location.href = "/auth/educator/login";
    } catch (error) {
      console.error("Logout error:", error);
      // Redirect anyway
      window.location.href = "/auth/educator/login";
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/educator/notifications/mark-all-read", {
        method: "POST",
      });
      // Refresh notifications
      const res = await fetch("/api/educator/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  function handleViewAllNotifications() {
    // You can create a dedicated notifications page
    router.push("/educator/notifications");
  }

  const initial = loading ? "..." : (name?.charAt(0)?.toUpperCase() || "?");

  if (loading) {
    return (
      <>
        {/* MOBILE BUTTON - shimmer */}
        <div className="md:hidden flex justify-end mb-2">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] animate-pulse" />
        </div>
        {/* DESKTOP - shimmer */}
        <div className="hidden md:block">
          <div className="w-full min-h-[140px] sm:min-h-[160px] md:min-h-[170px] lg:min-h-[180px] bg-gradient-to-br from-[#9d8adb] to-[#4c4172] rounded-[16px] md:rounded-[24px] lg:rounded-[30px] animate-pulse" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* MOBILE BUTTON */}
      <div className="md:hidden flex justify-end mb-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] flex items-center justify-center shadow-[0_4px_15px_rgba(157,138,219,0.3)] text-white font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
        >
          {initial}
        </button>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:block">
        <ProfileCard
          name={name}
          dark={dark}
          toggleDarkMode={toggleDarkMode}
          openNotif={openNotif}
          setOpenNotif={setOpenNotif}
          setEditOpen={setEditOpen}
          handleSignOut={handleSignOut}
          notifications={notifications}
          handleMarkAllRead={handleMarkAllRead}
          handleViewAllNotifications={handleViewAllNotifications}
        />
      </div>

      {/* MOBILE PROFILE */}
      {mobileOpen && (
        <Modal onClose={() => setMobileOpen(false)}>
          <ProfileCard
            mobile
            name={name}
            dark={dark}
            toggleDarkMode={toggleDarkMode}
            openNotif={openNotif}
            setOpenNotif={setOpenNotif}
            setEditOpen={(v) => {
              setMobileOpen(false);
              setEditOpen(v);
            }}
            handleSignOut={handleSignOut}
            notifications={notifications}
            handleMarkAllRead={handleMarkAllRead}
            handleViewAllNotifications={handleViewAllNotifications}
          />
        </Modal>
      )}

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

/* ================= PROFILE CARD ================= */

function ProfileCard({
  name,
  dark,
  toggleDarkMode,
  openNotif,
  setOpenNotif,
  setEditOpen,
  handleSignOut,
  notifications,
  handleMarkAllRead,
  handleViewAllNotifications,
  mobile = false,
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
      <div className="absolute top-6 right-6">
        <button 
          onClick={() => setOpenNotif(!openNotif)}
          className="transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <Bell size={22} />
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#e74c3c] rounded-full border-2 border-[#9d8adb]" style={{ animation: 'eduPulse 2s ease-in-out infinite' }} />
          )}
        </button>

        {openNotif && (
          <NotifDropdown
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onViewAll={handleViewAllNotifications}
          />
        )}
      </div>

      {/* USER INFO */}
      <div className="flex items-center gap-4">
        <Avatar name={name} />

        <div>
          <p className="text-base sm:text-lg md:text-xl font-semibold">{name}</p>
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

/* ================= NOTIFICATIONS ================= */

function NotifDropdown({ notifications = [], onMarkAllRead, onViewAll }) {
  function formatTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now - created) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return created.toLocaleDateString();
  }

  return (
    <div className="edu-dropdown-animate absolute right-0 mt-3 w-[320px] sm:w-[380px] bg-white dark:bg-[#2d2640] text-gray-800 dark:text-[#e8e8e8] rounded-xl border border-[rgba(157,138,219,0.15)] dark:border-[rgba(139,127,199,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
      <div className="px-4 py-3 flex justify-between items-center border-b border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.2)]">
        <h3 className="text-sm font-semibold text-[#4c4172] dark:text-[#e8e8e8]">Notifications</h3>

        <button
          onClick={onMarkAllRead}
          className="text-xs text-[#9d8adb] hover:underline font-medium"
        >
          Mark all as read
        </button>
      </div>

      <div className="max-h-[350px] overflow-y-auto edu-scrollbar">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-gray-500">
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
  );
}

function NotifItem({ title, message, time, unread }) {
  const initial = title?.charAt(0)?.toUpperCase() || "N";
  
  return (
    <div
      className={`
        edu-notif-item flex gap-3 px-4 py-3 hover:bg-[rgba(157,138,219,0.08)] dark:hover:bg-[rgba(139,127,199,0.12)] transition-all duration-200 cursor-pointer
        ${unread ? "bg-[rgba(157,138,219,0.06)] dark:bg-[rgba(139,127,199,0.08)]" : "bg-white dark:bg-transparent"}
      `}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9d8adb]/30 to-[#4c4172]/20 text-[#6b5cbf] flex items-center justify-center text-xs font-semibold shrink-0">
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium text-[#4c4172] dark:text-[#c5b8f5]">{title}</span>{" "}
          <span className="text-gray-600 dark:text-[#b0a8d4]">{message}</span>
        </p>

        <p className="text-xs text-gray-400 mt-1">{time}</p>
      </div>

      {unread && (
        <span className="w-2 h-2 bg-[#9d8adb] rounded-full mt-2 shrink-0" style={{ animation: 'eduPulse 2s ease-in-out infinite' }} />
      )}
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
