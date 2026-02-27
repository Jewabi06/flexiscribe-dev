"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import MessageModal from "@/components/shared/MessageModal";

export default function ProfileModal({ open, defaultTab, onClose }) {
  const [tab, setTab] = useState(defaultTab);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Security form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      fetchProfile();
    }
  }, [defaultTab, open]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.admin);
        setFullName(data.admin.fullName || "");
        setUsername(data.admin.username || "");
        setPhoneNumber(data.admin.phoneNumber || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          username,
          phoneNumber,
        }),
      });

      if (res.ok) {
        setModalInfo({ isOpen: true, title: "Success", message: "Profile updated successfully!", type: "success" });
        fetchProfile();
      } else {
        const error = await res.json();
        setModalInfo({ isOpen: true, title: "Error", message: error.error || "Failed to update profile.", type: "error" });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setModalInfo({ isOpen: true, title: "Error", message: "An error occurred while saving profile.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      setModalInfo({ isOpen: true, title: "Validation Error", message: "Passwords do not match.", type: "error" });
      return;
    }

    if (newPassword.length < 8) {
      setModalInfo({ isOpen: true, title: "Validation Error", message: "Password must be at least 8 characters.", type: "error" });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        setModalInfo({ isOpen: true, title: "Success", message: "Password updated successfully!", type: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const error = await res.json();
        setModalInfo({ isOpen: true, title: "Error", message: error.error || "Failed to update password.", type: "error" });
      }
    } catch (error) {
      console.error("Error updating password:", error);
      setModalInfo({ isOpen: true, title: "Error", message: "An error occurred while updating password.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "A";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">

      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* MODAL */}
      <div className="relative w-[560px] bg-white rounded-2xl shadow-2xl p-7 z-10">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Account Settings
          </h2>

          <button onClick={onClose}>
            <X className="text-gray-500 hover:text-gray-800" />
          </button>
        </div>

        {/* PROFILE HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#9d8adb] flex items-center justify-center text-white text-xl font-semibold">
            {getInitials(profile?.fullName || "Admin")}
          </div>

          <div>
            <p className="font-semibold text-gray-900">
              {profile?.fullName || "Admin"}
            </p>
            <p className="text-sm text-gray-500">Administrator</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-6 border-b mb-5">
          {["profile", "security"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 capitalize text-sm font-medium transition
                ${
                  tab === t
                    ? "border-b-2 border-[#9d8adb] text-gray-900"
                    : "text-gray-400 hover:text-gray-700"
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="space-y-5 text-sm text-gray-700">

          {/* ================= PROFILE ================= */}
          {tab === "profile" && (
            <>
              <h3 className="font-semibold text-gray-900">
                Personal Information
              </h3>

              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        className="w-full mt-1 rounded-lg border px-3 py-2"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Username
                      </label>
                      <input
                        className="w-full mt-1 rounded-lg border px-3 py-2"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      className="w-full mt-1 rounded-lg border px-3 py-2 bg-gray-100"
                      disabled
                      value={profile?.email || ""}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <input
                      className="w-full mt-1 rounded-lg border px-3 py-2 bg-gray-100"
                      disabled
                      value="Administrator"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      className="w-full mt-1 rounded-lg border px-3 py-2"
                      placeholder="+63 9XX XXX XXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="bg-[#9d8adb] text-white px-6 py-2 rounded-full hover:bg-[#8b78d1] disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ================= SECURITY ================= */}
          {tab === "security" && (
            <>
              <h3 className="font-semibold text-gray-900">
                Security Settings
              </h3>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <input
                  type="password"
                  className="w-full mt-1 rounded-lg border px-3 py-2"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <input
                    type="password"
                    className="w-full mt-1 rounded-lg border px-3 py-2"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    className="w-full mt-1 rounded-lg border px-3 py-2"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Password must be at least 8 characters.
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={handleUpdatePassword}
                  disabled={saving}
                  className="bg-[#9d8adb] text-white px-6 py-2 rounded-full hover:bg-[#8b78d1] disabled:opacity-50"
                >
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
