"use client";

import { X, Mail, User, Phone } from "lucide-react";
import { useState } from "react";
import MessageModal from "@/components/shared/MessageModal";

export default function EditUserModal({ user, onClose }) {
  const [fullName, setFullName] = useState(user.fullName || user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || "");
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
          phoneNumber,
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

          {/* Phone Number */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Phone Number
            </label>

            <div className="flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-3 mt-1">
              <Phone size={18} className="text-gray-600" />
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-transparent text-gray-800 font-medium outline-none placeholder-gray-500"
                placeholder="+63 9XX XXX XXXX"
              />
            </div>
          </div>

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
