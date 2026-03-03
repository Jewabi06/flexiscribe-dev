"use client";

/* ================= IMPORTS ================= */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sun, Moon, X, Lock, Eye, EyeOff } from "lucide-react";

/* ================= MAIN ================= */

export default function ProfessorProfileCard() {
  const router = useRouter();
  const [openNotif, setOpenNotif] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const [name, setName] = useState("Professor");
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
        }
      } catch (error) {
        console.error("Failed to fetch educator profile:", error);
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

  const initial = name?.charAt(0)?.toUpperCase() || "?";

  return (
    <>
      {/* MOBILE BUTTON */}
      <div className="md:hidden flex justify-end mb-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] flex items-center justify-center shadow-lg text-white font-semibold hover:scale-105 active:scale-95 transition-transform duration-200"
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
        ${mobile ? "w-full" : "w-[345px]"}
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        text-white
      `}
      style={{ zIndex: openNotif ? 60 : "auto" }}
    >
      {/* NOTIFICATION */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setOpenNotif(!openNotif)}
          className="relative hover:scale-110 active:scale-95 transition-transform duration-200"
        >
          <Bell size={22} />
          {notifications?.filter(n => !n.read).length > 0 && (
            <span className="edu-notif-badge absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#e74c3c] rounded-full" />
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
          <p className="text-xl font-semibold">{name}</p>
          <p className="text-white/80 text-sm">Instructor</p>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="mt-auto flex items-center gap-3 text-white/80 text-sm">
        <p
          onClick={() => setEditOpen(true)}
          className="cursor-pointer hover:text-white transition-colors duration-200"
        >
          Edit Profile
        </p>

        <span className="text-white/40">|</span>

        <p 
          onClick={handleSignOut}
          className="cursor-pointer hover:text-[#e74c3c] transition-colors duration-200"
        >
          Sign Out
        </p>
      </div>

      {/* DARK MODE */}
      <button
        onClick={toggleDarkMode}
        className="edu-theme-toggle absolute right-5 bottom-5 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all duration-200"
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
    <div className="edu-dropdown-animate absolute right-0 mt-3 w-[280px] sm:w-[360px] bg-white dark:bg-[#2d2640] dark:text-[#e8e8e8] text-gray-800 rounded-xl border border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.25)] shadow-lg z-50 overflow-hidden">
      <div className="px-4 py-3 flex justify-between border-b dark:border-[rgba(139,127,199,0.2)]">
        <h3 className="text-sm font-semibold dark:text-[#e8e8e8]">Notifications</h3>

        <button
          onClick={onMarkAllRead}
          className="text-xs text-[#9d8adb] hover:underline"
        >
          Mark all as read
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto edu-scrollbar">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No notifications
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
        edu-notif-item flex gap-3 px-4 py-3 hover:bg-[rgba(157,138,219,0.08)] dark:hover:bg-[rgba(139,127,199,0.12)] transition-all duration-200
        ${unread ? "bg-[#f7f5ff] dark:bg-[rgba(139,127,199,0.08)]" : "bg-white dark:bg-transparent"}
      `}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9d8adb]/30 to-[#4c4172]/20 text-[#6b5cbf] flex items-center justify-center text-xs font-semibold">
        {initial}
      </div>

      <div className="flex-1">
        <p className="text-sm">
          <span className="font-medium">{title}</span>{" "}
          <span className="text-gray-600 dark:text-[#b0a8d4]">{message}</span>
        </p>

        <p className="text-xs text-gray-400 mt-1">{time}</p>
      </div>

      {unread && (
        <span className="w-2 h-2 bg-[#9d8adb] rounded-full mt-2" />
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

  // Change Password state
  const [cpOpen, setCpOpen] = useState(false);
  const [cpStep, setCpStep] = useState(1);
  const [cpData, setCpData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", verificationCode: "" });
  const [cpErrors, setCpErrors] = useState({});
  const [cpLoading, setCpLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [cpCountdown, setCpCountdown] = useState(0);
  const [cpSuccess, setCpSuccess] = useState(false);

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
    if (cpCountdown > 0) {
      const timer = setTimeout(() => setCpCountdown(cpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cpCountdown]);

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

  async function cpSendCode() {
    setCpLoading(true);
    setCpCountdown(60);
    try {
      const res = await fetch("/api/educator/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-code", currentPassword: cpData.currentPassword, newPassword: cpData.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCpErrors({ currentPassword: data.error || "Failed to send code" });
        setCpCountdown(0);
        return false;
      }
      return true;
    } catch {
      setCpErrors({ currentPassword: "An error occurred. Please try again." });
      setCpCountdown(0);
      return false;
    } finally {
      setCpLoading(false);
    }
  }

  async function cpHandleContinue() {
    if (!cpValidate()) return;
    const sent = await cpSendCode();
    if (sent) setCpStep(2);
  }

  async function cpHandleVerify() {
    if (!cpData.verificationCode || cpData.verificationCode.length !== 6) {
      setCpErrors({ verificationCode: "Please enter the 6-digit code" });
      return;
    }
    setCpLoading(true);
    try {
      const res = await fetch("/api/educator/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-and-change", verificationCode: cpData.verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCpErrors({ verificationCode: data.error || "Verification failed" });
        return;
      }
      setCpSuccess(true);
      setTimeout(() => {
        setCpSuccess(false);
        setCpOpen(false);
        setCpStep(1);
        setCpData({ currentPassword: "", newPassword: "", confirmPassword: "", verificationCode: "" });
      }, 2000);
    } catch {
      setCpErrors({ verificationCode: "An error occurred" });
    } finally {
      setCpLoading(false);
    }
  }

  function cpClose() {
    setCpOpen(false);
    setCpStep(1);
    setCpData({ currentPassword: "", newPassword: "", confirmPassword: "", verificationCode: "" });
    setCpErrors({});
    setCpSuccess(false);
    setCpCountdown(0);
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
          <label className="block mb-1 font-medium text-[#4c4172]">Gender</label>
          <select
            value={formData.gender}
            onChange={(e) =>
              setFormData({ ...formData, gender: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border-2 border-[rgba(157,138,219,0.3)] outline-none focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)] transition-all duration-200"
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
          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200"
          disabled={loading}
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white disabled:opacity-50 hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
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
                <span>Password changed successfully!</span>
              </div>
            ) : cpStep === 1 ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block mb-1 font-medium text-[#4c4172]">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      value={cpData.currentPassword}
                      onChange={(e) => { setCpData(p => ({...p, currentPassword: e.target.value})); setCpErrors(p => ({...p, currentPassword: ""})); }}
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
                    onClick={cpHandleContinue}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white text-sm disabled:opacity-50 hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                    disabled={cpLoading}
                  >
                    <Lock size={14} />
                    {cpLoading ? "Sending..." : "Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-gray-600 dark:text-[#b0a8d4]">
                  A 6-digit code was sent to <strong className="text-[#4c4172] dark:text-[#c5b8f5]">{educator?.user?.email || ""}</strong>.
                </p>

                <div>
                  <label className="block mb-1 font-medium text-[#4c4172]">Verification Code</label>
                  <input
                    type="text"
                    value={cpData.verificationCode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setCpData(p => ({...p, verificationCode: v}));
                      setCpErrors(p => ({...p, verificationCode: ""}));
                    }}
                    placeholder="000000"
                    maxLength={6}
                    className={`w-full px-4 py-3 rounded-xl border-2 ${cpErrors.verificationCode ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)] text-center text-2xl tracking-[8px] font-mono`}
                  />
                  {cpErrors.verificationCode && <p className="text-red-500 text-xs mt-1">{cpErrors.verificationCode}</p>}
                </div>

                <div className="text-center">
                  <button onClick={() => { if (cpCountdown <= 0) cpSendCode(); }} disabled={cpCountdown > 0} className="text-xs text-[#9d8adb] hover:underline disabled:opacity-50">
                    {cpCountdown > 0 ? `Resend code in ${cpCountdown}s` : "Resend code"}
                  </button>
                </div>

                <div className="flex justify-between mt-2">
                  <button
                    onClick={() => { setCpStep(1); setCpErrors({}); setCpData(p => ({...p, verificationCode: ""})); }}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-colors duration-200"
                    disabled={cpLoading}
                  >
                    Back
                  </button>
                  <button
                    onClick={cpHandleVerify}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white text-sm disabled:opacity-50 hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                    disabled={cpLoading || cpData.verificationCode.length !== 6}
                  >
                    <Lock size={14} />
                    {cpLoading ? "Verifying..." : "Verify & Change"}
                  </button>
                </div>
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
      className="edu-modal-overlay fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="edu-modal-content bg-white dark:bg-[#2d2640] rounded-[20px] w-[90%] max-w-[480px] p-4 max-h-[85vh] overflow-y-auto edu-scrollbar relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 rounded-full p-2"
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
        className="w-full px-4 py-2 rounded-lg border-2 border-[rgba(157,138,219,0.3)] outline-none focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)] transition-all duration-200 disabled:bg-[rgba(157,138,219,0.08)]"
      />
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-xl font-semibold uppercase hover:scale-105 transition-transform duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
      {name?.charAt(0) || "?"}
    </div>
  );
}

/* ================= CHANGE PASSWORD ================= */

function ChangePassword({ educatorEmail, setChangePasswordOpen }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    verificationCode: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validate() {
    const newErrors = {};
    if (!formData.currentPassword) newErrors.currentPassword = "Current password is required";
    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function sendCode() {
    setLoading(true);
    setCountdown(60);
    try {
      const res = await fetch("/api/educator/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-code",
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ currentPassword: data.error || "Failed to send code" });
        setCountdown(0);
        return false;
      }
      return true;
    } catch {
      setErrors({ currentPassword: "An error occurred. Please try again." });
      setCountdown(0);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (!validate()) return;
    const sent = await sendCode();
    if (sent) setStep(2);
  }

  async function handleVerify() {
    if (!formData.verificationCode || formData.verificationCode.length !== 6) {
      setErrors({ verificationCode: "Please enter the 6-digit code" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/educator/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify-and-change",
          verificationCode: formData.verificationCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ verificationCode: data.error || "Verification failed" });
        return;
      }
      setSuccessMsg("Password changed successfully!");
      setTimeout(() => setChangePasswordOpen(false), 2000);
    } catch {
      setErrors({ verificationCode: "An error occurred" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    await sendCode();
  }

  if (successMsg) {
    return (
      <div className="bg-white dark:bg-[#2d2640] dark:text-[#e8e8e8] w-full rounded-[20px] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2 text-[#4c4172] dark:text-[#c5b8f5]">Success!</h2>
        <p className="text-gray-600 dark:text-[#b0a8d4]">{successMsg}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2d2640] dark:text-[#e8e8e8] w-full rounded-[20px] p-6 text-gray-700">
      <div className="flex items-center gap-3 mb-5">
        <Lock size={22} className="text-[#8b5cf6]" />
        <h2 className="text-xl font-semibold text-[#4c4172] dark:text-[#c5b8f5]">
          Change Password
        </h2>
      </div>

      {step === 1 && (
        <div className="space-y-4 text-sm">
          <div>
            <label className="block mb-1 font-medium text-[#4c4172]">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 pr-10 rounded-xl border-2 ${errors.currentPassword ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)]`}
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>}
          </div>

          <div>
            <label className="block mb-1 font-medium text-[#4c4172]">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 pr-10 rounded-xl border-2 ${errors.newPassword ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)]`}
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>}
            <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label className="block mb-1 font-medium text-[#4c4172]">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 pr-10 rounded-xl border-2 ${errors.confirmPassword ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)]`}
              />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setChangePasswordOpen(false)}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white disabled:opacity-50 hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              disabled={loading}
            >
              <Lock size={16} />
              {loading ? "Sending..." : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-[#b0a8d4]">
            A 6-digit verification code has been sent to <strong className="text-[#4c4172] dark:text-[#c5b8f5]">{educatorEmail}</strong>. 
            Enter the code below to confirm the password change.
          </p>

          <div>
            <label className="block mb-1 font-medium text-[#4c4172]">Verification Code</label>
            <input
              type="text"
              name="verificationCode"
              value={formData.verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setFormData((prev) => ({ ...prev, verificationCode: value }));
                setErrors((prev) => ({ ...prev, verificationCode: "" }));
              }}
              placeholder="000000"
              maxLength={6}
              className={`w-full px-4 py-3 rounded-xl border-2 ${errors.verificationCode ? "border-red-400" : "border-[rgba(157,138,219,0.3)]"} outline-none transition-all duration-200 focus:border-[#9d8adb] focus:shadow-[0_0_0_3px_rgba(157,138,219,0.1)] text-center text-2xl tracking-[8px] font-mono`}
            />
            {errors.verificationCode && <p className="text-red-500 text-xs mt-1">{errors.verificationCode}</p>}
          </div>

          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={countdown > 0}
              className="text-xs text-[#9d8adb] hover:underline disabled:opacity-50"
            >
              {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => { setStep(1); setErrors({}); setFormData((prev) => ({ ...prev, verificationCode: "" })); }}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200"
              disabled={loading}
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9d8adb] to-[#4c4172] text-white disabled:opacity-50 hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              disabled={loading || formData.verificationCode.length !== 6}
            >
              <Lock size={16} />
              {loading ? "Verifying..." : "Verify & Change Password"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
