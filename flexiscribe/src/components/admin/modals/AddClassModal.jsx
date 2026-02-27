"use client";

import { X, BookOpen, MapPin, Clock, Calendar, User } from "lucide-react";
import { useState, useEffect } from "react";
import MessageModal from "@/components/shared/MessageModal";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Convert 24h "HH:mm" to "H:MM AM/PM"
function to12h(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

// Convert "H:MM AM/PM" to 24h "HH:mm"
function to24h(time12) {
  if (!time12) return "";
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let [, h, mi, period] = match;
  h = parseInt(h);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${mi}`;
}

export default function AddClassModal({ onClose }) {
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [room, setRoom] = useState("");
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [educatorId, setEducatorId] = useState("");
  const [educators, setEducators] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    async function fetchEducators() {
      try {
        const res = await fetch("/api/admin/educators");
        if (res.ok) {
          const data = await res.json();
          setEducators(data.educators || []);
        }
      } catch {
        console.error("Failed to fetch educators");
      }
    }
    fetchEducators();
  }, []);

  const handleSave = async () => {
    setError("");

    if (!subject || !section || !room || !day || !startTime || !endTime || !educatorId) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          section,
          room,
          day,
          startTime,
          endTime: endTime || null,
          educatorId,
        }),
      });

      if (res.ok) {
        setModalInfo({ isOpen: true, title: "Success", message: "Class created successfully! The class code has been generated.", type: "success" });
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create class");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] px-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#f5f3ff] px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#4c4172]">Add New Class</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Class Info */}
          <div>
            <h4 className="text-sm font-bold text-[#4c4172] mb-3">Class Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Subject */}
              <div>
                <label className="text-sm font-medium text-gray-700">Subject *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <BookOpen size={18} className="text-gray-600" />
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                    placeholder="e.g. CPP117"
                  />
                </div>
              </div>

              {/* Section */}
              <div>
                <label className="text-sm font-medium text-gray-700">Section *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <BookOpen size={18} className="text-gray-600" />
                  <input
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                    placeholder="e.g. A"
                  />
                </div>
              </div>

              {/* Room */}
              <div>
                <label className="text-sm font-medium text-gray-700">Room *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <MapPin size={18} className="text-gray-600" />
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                    placeholder="e.g. Room 301"
                  />
                </div>
              </div>

              {/* Day */}
              <div>
                <label className="text-sm font-medium text-gray-700">Day *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1 relative">
                  <Calendar size={18} className="text-gray-600" />
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full bg-transparent outline-none appearance-none text-gray-800"
                  >
                    <option value="">Select day</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="absolute right-4 text-gray-500">▼</span>
                </div>
              </div>

              {/* Start Time */}
              <div>
                <label className="text-sm font-medium text-gray-700">Start Time *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <Clock size={18} className="text-gray-600" />
                  <input
                    type="time"
                    value={to24h(startTime)}
                    onChange={(e) => {
                      const val12 = to12h(e.target.value);
                      setStartTime(val12);
                      if (endTime && e.target.value >= to24h(endTime)) {
                        setEndTime("");
                      }
                    }}
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                </div>
              </div>

              {/* End Time */}
              <div>
                <label className="text-sm font-medium text-gray-700">End Time *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <Clock size={18} className="text-gray-600" />
                  <input
                    type="time"
                    value={to24h(endTime)}
                    min={to24h(startTime) || undefined}
                    onChange={(e) => setEndTime(to12h(e.target.value))}
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Assign Educator */}
          <div>
            <h4 className="text-sm font-bold text-[#4c4172] mb-3">Assign Educator</h4>
            <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 relative">
              <User size={18} className="text-gray-600" />
              <select
                value={educatorId}
                onChange={(e) => setEducatorId(e.target.value)}
                className="w-full bg-transparent outline-none appearance-none text-gray-800"
              >
                <option value="">Select an educator</option>
                {educators.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} — {e.department}
                  </option>
                ))}
              </select>
              <span className="absolute right-4 text-gray-500">▼</span>
            </div>
            {educators.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                No educators found. Please add educators first.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#faf9ff] px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#9d8adb] text-white px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Creating..." : "Create Class"}
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
