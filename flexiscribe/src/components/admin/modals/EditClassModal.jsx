"use client";

import { X, BookOpen, MapPin, Clock, Calendar, User, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import MessageModal from "@/components/shared/MessageModal";
import FormDropdown from "@/components/shared/FormDropdown";
import ClockTimePicker from "@/components/shared/ClockTimePicker";

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

export default function EditClassModal({ classData, onClose }) {
  const [subject, setSubject] = useState(classData.subject || "");
  const [section, setSection] = useState(classData.section || "");
  const [roomBuilding, setRoomBuilding] = useState(() => {
    const parts = (classData.room || "").split(" ");
    return ["BCH", "MAIN"].includes(parts[0]) ? parts[0] : "";
  });
  const [roomNumber, setRoomNumber] = useState(() => {
    const parts = (classData.room || "").split(" ");
    return ["BCH", "MAIN"].includes(parts[0]) ? parts.slice(1).join(" ") : classData.room || "";
  });
  const [day, setDay] = useState(classData.day || "");
  const [startTime, setStartTime] = useState(classData.startTime || "");
  const [endTime, setEndTime] = useState(classData.endTime || "");
  const [educatorId, setEducatorId] = useState(classData.educatorId || "");
  const [educators, setEducators] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(classData.classCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setError("");

    if (!subject || !section || !roomBuilding || !roomNumber || !day || !startTime || !endTime || !educatorId) {
      setError("Please fill in all required fields");
      return;
    }

    const room = `${roomBuilding} ${roomNumber}`;

    try {
      setSaving(true);
      const res = await fetch(`/api/admin/classes/${classData.id}`, {
        method: "PATCH",
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
        setModalInfo({ isOpen: true, title: "Success", message: "Class updated successfully.", type: "success" });
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update class");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] px-4">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(157,138,219,0.35) transparent",
        }}
      >
        {/* Header */}
        <div className="bg-[#f5f3ff] px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#4c4172]">Edit Class</h3>
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

          {/* Class Code Display */}
          <div className="flex items-center justify-between bg-[#f8f7ff] border border-[#e6e2fb] rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-[#9d8adb] font-medium">Class Code</p>
              <p className="text-lg font-bold text-[#4c4172] tracking-wider">
                {classData.classCode}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9d8adb] text-white text-sm hover:opacity-90 transition"
            >
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
            </button>
          </div>

          {/* Class Info */}
          <div>
            <h4 className="text-sm font-bold text-[#4c4172] mb-3">Class Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Subject *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <BookOpen size={18} className="text-gray-600" />
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Section *</label>
                <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                  <BookOpen size={18} className="text-gray-600" />
                  <input
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full bg-transparent outline-none text-gray-800"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">Room *</label>
                <div className="flex gap-3">
                  <div className="w-1/2">
                    <FormDropdown
                      value={roomBuilding}
                      onChange={setRoomBuilding}
                      placeholder="Building"
                      icon={MapPin}
                      options={[
                        { value: "BCH", label: "BCH" },
                        { value: "MAIN", label: "MAIN" },
                      ]}
                    />
                  </div>
                  <div className="w-1/2">
                    <div className="flex items-center gap-3 bg-gray-100 border rounded-xl px-4 py-3 mt-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={roomNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setRoomNumber(val);
                        }}
                        className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800"
                        placeholder="e.g. 302"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Start Time *</label>
                <ClockTimePicker
                  value={startTime}
                  onChange={(val) => {
                    setStartTime(val);
                    if (endTime) {
                      const s24 = to24h(val);
                      const e24 = to24h(endTime);
                      if (s24 && e24 && s24 >= e24) setEndTime("");
                    }
                  }}
                  placeholder="Select start time"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">End Time *</label>
                <ClockTimePicker
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="Select end time"
                  minTime={startTime}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Day *</label>
                <FormDropdown
                  value={day}
                  onChange={setDay}
                  placeholder="Select day"
                  icon={Calendar}
                  options={DAYS.map((d) => ({ value: d, label: d }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Assign Educator *</label>
                <FormDropdown
                  value={educatorId}
                  onChange={setEducatorId}
                  placeholder="Select an educator"
                  icon={User}
                  options={educators.map((e) => ({ value: e.id, label: `${e.fullName} — ${e.department}` }))}
                />
              </div>
            </div>
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
