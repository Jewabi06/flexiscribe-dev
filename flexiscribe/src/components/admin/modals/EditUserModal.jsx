"use client";

import { X, Mail, User, Shield } from "lucide-react";
import { useState } from "react";
import MessageModal from "@/components/shared/MessageModal";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active", color: "bg-green-100 text-green-700" },
  { value: "Inactive", label: "Inactive", color: "bg-gray-100 text-gray-600" },
  { value: "Banned", label: "Banned", color: "bg-red-100 text-red-600" },
];

export default function EditUserModal({ user, onClose }) {
  const [fullName, setFullName] = useState(user.fullName || user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const [status, setStatus] = useState(user.status || "Active");
  const [isGhost, setIsGhost] = useState(user.isGhost ?? false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          username,
          email,
          status,
          isGhost,
        }),
      });

      if (res.ok) {
        setModalInfo({ isOpen: true, title: "Success", message: "User updated successfully.", type: "success" });
      } else {
        const error = await res.json();
        setModalInfo({ isOpen: true, title: "Error", message: error.error || "Failed to update user.", type: "error" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      setModalInfo({ isOpen: true, title: "Error", message: "An error occurred while updating user.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] px-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#f5f3ff] px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#4c4172]">Edit User</h3>

          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Full Name
            </label>

            <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-3 mt-1">
              <User size={18} className="text-gray-600" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-transparent text-gray-800 font-medium outline-none"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Username
            </label>

            <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-3 mt-1">
              <User size={18} className="text-gray-600" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent text-gray-800 font-medium outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Email Address
            </label>

            <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-3 mt-1">
              <Mail size={18} className="text-gray-600" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-gray-800 font-medium outline-none placeholder-gray-500"
                placeholder="user@email.com"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Account Status
            </label>

            <div className="relative mt-1">
              <div
                onClick={() => setStatusOpen(!statusOpen)}
                className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 cursor-pointer hover:border-[#9d8adb] transition"
              >
                <Shield size={18} className="text-[#9d8adb]" />
                <span className="text-[#4c4172] font-medium">{status}</span>
                <span className="ml-auto text-gray-400 text-xs">▼</span>
              </div>
              {statusOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-[#e6e2fb] rounded-xl shadow-lg overflow-hidden">
                  {STATUS_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => {
                        setStatus(opt.value);
                        setStatusOpen(false);
                      }}
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer text-[#4c4172] hover:bg-[#9d8adb] hover:text-white transition"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.value === 'Active' ? 'bg-green-500' : opt.value === 'Inactive' ? 'bg-gray-400' : 'bg-red-500'}`} />
                      <span className="font-medium">{opt.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        {/* Ghost User Toggle — only for students */}
        {user.role === "STUDENT" && (
          <div className="flex items-start justify-between gap-3 bg-[#faf9ff] border border-[#e6e2fb] rounded-xl px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#4c4172]">👻 Ghost Account</p>
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                Ghost users are hidden from students, leaderboards, and class rosters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGhost(!isGhost)}
              className={`relative inline-flex h-6 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                isGhost ? "bg-[#9d8adb]" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isGhost ? "translate-x-9" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

          {/* Role (Read-only) */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Role
            </label>

            <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
              <input
                value={user.role}
                disabled
                className="w-full bg-transparent text-gray-800 font-medium outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Role cannot be changed
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#faf9ff] px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2 rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#9d8adb] text-white px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => {
          setModalInfo({ ...modalInfo, isOpen: false });
          if (modalInfo.type === "success") onClose();
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}
