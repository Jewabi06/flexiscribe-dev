"use client";

import { X, User, Mail, Shield, Phone, Send } from "lucide-react";

export default function AddUserModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] px-4">

      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#f5f3ff] px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#4c4172]">
            Add New User
          </h3>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">

          {/* INFO NOTICE */}
          <div className="flex gap-3 bg-[#f8f7ff] border border-[#e6e2fb] rounded-xl p-4 text-sm text-[#5c5396]">
            <Send size={18} />
            <p>
              An invitation email will be sent to the user so they can
              set their own password securely.
            </p>
          </div>

          {/* Basic Info */}
          <div>
            <h4 className="text-sm font-bold text-[#4c4172] mb-3">
              Basic Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <User size={18} className="text-gray-600" />
                  <input
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <Phone size={18} className="text-gray-600" />
                  <input
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                    placeholder="09XXXXXXXXX"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <Mail size={18} className="text-gray-600" />
                  <input
                    type="email"
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                    placeholder="juan@email.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Access */}
          <div>
            <h4 className="text-sm font-bold text-[#4c4172] mb-2">
              Access Control
            </h4>

            <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 relative">
              <Shield size={18} className="text-gray-600" />
              <select
                className="
                  w-full
                  bg-transparent
                  outline-none
                  appearance-none
                  text-gray-800
                "
              >
                <option>Student</option>
                <option>Educator</option>
                <option>Admin</option>
              </select>

              <span className="absolute right-4 text-gray-500">
                ▼
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-[#faf9ff] px-6 py-4 flex justify-end gap-3">

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            className="
              bg-[#9d8adb]
              text-white
              px-6
              py-2
              rounded-full
              hover:opacity-90
              transition
            "
          >
            Send Invite
          </button>
        </div>

      </div>
    </div>
  );
}
