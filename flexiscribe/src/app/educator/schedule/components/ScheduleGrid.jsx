"use client";

import { Calendar, X } from "lucide-react";
import { useState, useEffect } from "react";
import ClassBlock from "./ClassBlock";
import EducatorHeader from "@/layouts/educator/EducatorHeader";
import { timeToMinutes } from "@/lib/timeSlots";

/* ================= MAIN COMPONENT ================= */

const ROW_HEIGHT = 56;

export default function ScheduleGrid({
  classes,
  days,
  timeSlots,
}) {
  const [activeClass, setActiveClass] = useState(null);
  const [userName, setUserName] = useState("Educator");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/educator/profile");
        if (res.ok) {
          const data = await res.json();
          setUserName(data.educator.fullName.split(" ")[0] || "Educator");
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    }
    fetchProfile();
  }, []);

  const schedule = classes.map((cls) => {
    const startIndex = timeSlots.findIndex((t) =>
      t.startsWith(cls.startTime)
    );

    // Calculate duration from endTime instead of hardcoding
    let durationSlots = 3; // default 1.5 hours if no endTime
    if (cls.endTime) {
      const startMin = timeToMinutes(cls.startTime);
      const endMin = timeToMinutes(cls.endTime);
      if (startMin >= 0 && endMin > startMin) {
        durationSlots = (endMin - startMin) / 30;
      }
    }

    const displayEndTime = cls.endTime
      || (startIndex !== -1 ? timeSlots[startIndex + durationSlots - 1]?.split(" – ")[1] : "");

    return {
      ...cls,
      start: cls.startTime,
      startIndex,
      durationSlots,
      startTime: `${cls.startTime} – ${displayEndTime}`,
    };
  });

  return (
    <div className="w-full relative">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#9b8ae0] flex items-center justify-center text-white shadow-md">
            <Calendar size={18} />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-[#6b5fcf] dark:text-[#c5b8f5]">
            Schedule
          </h1>
        </div>

        <EducatorHeader userName={userName} />
      </div>

      {/* GRID WRAPPER (scroll on mobile) */}
      <div className="overflow-x-auto rounded-2xl touch-pan-x">
        <div className="min-w-[640px] sm:min-w-[800px] lg:min-w-[900px] grid grid-cols-[90px_repeat(7,1fr)] sm:grid-cols-[110px_repeat(7,1fr)] lg:grid-cols-[130px_repeat(7,1fr)] border border-[#a99ae6] dark:border-[rgba(139,127,199,0.3)] rounded-2xl bg-white dark:bg-[#1e1b2e] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)]">

          <div className="bg-[#9b8ae0] text-white text-[10px] sm:text-xs font-semibold text-center p-2 sm:p-3 md:p-4">
            TIME
          </div>

          {days.map((day) => (
            <div
              key={day}
              className="bg-[#9b8ae0] text-white text-[10px] sm:text-xs font-semibold text-center p-2 sm:p-3 md:p-4"
            >
              <span className="hidden sm:inline">{day.toUpperCase()}</span>
              <span className="sm:hidden">{day.slice(0, 3).toUpperCase()}</span>
            </div>
          ))}

          {timeSlots.map((time, rowIndex) => (
            <div key={time} className="contents">

              <div className="border border-[#a99ae6] text-[9px] sm:text-[10px] md:text-[11px] text-[#7a6fcf] flex items-center justify-center h-[56px] px-1 text-center leading-tight">
                {time}
              </div>

              {days.map((day) => {
                const cls = schedule.find(
                  (s) => s.day === day && s.startIndex === rowIndex
                );

                const covered = schedule.find(
                  (s) =>
                    s.day === day &&
                    rowIndex > s.startIndex &&
                    rowIndex < s.startIndex + s.durationSlots
                );

                if (covered && !cls) return <div key={`${day}-${time}`} />;

                return (
                  <div
                    key={`${day}-${time}`}
                    className="border border-[#a99ae6] h-[56px] relative transition-colors duration-200 hover:bg-[rgba(157,138,219,0.04)]"
                  >
                    {cls && (
                      <div
                        onClick={() => setActiveClass(cls)}
                        className="absolute left-1 right-1 top-1 cursor-pointer"
                        style={{
                          height:
                            cls.durationSlots * ROW_HEIGHT - 8,
                        }}
                      >
                        <ClassBlock
                          title={`${cls.subject}`}
                          section={`${cls.section}`}
                          room={cls.room}
                          color={
                            cls.subject === "CPP117" &&
                            cls.section === "A"
                              ? "bg-purple-600"
                              : cls.subject === "CPP116" &&
                                cls.section === "A"
                              ? "bg-emerald-500"
                              : cls.subject === "CPP116" &&
                                cls.section === "B"
                              ? "bg-yellow-400"
                              : cls.subject === "CPP117" &&
                                cls.section === "B"
                              ? "bg-pink-500"
                              : "bg-[#9b8ae0]"
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {activeClass && (
        <div className="edu-modal-overlay fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="edu-modal-content bg-white dark:bg-[#2d2640] rounded-[20px] w-full max-w-sm p-5 sm:p-6 relative shadow-[0_8px_30px_rgba(0,0,0,0.12)]">

            <button
              onClick={() => setActiveClass(null)}
              className="absolute top-3 right-3 text-gray-400 dark:text-gray-300 hover:text-black dark:hover:text-white"
            >
              <X size={18} />
            </button>

            <h2 className="text-base sm:text-lg font-semibold mb-2 text-[#4c4172] dark:text-[#c5b8f5]">
              {activeClass.subject}
            </h2>

            <div className="text-xs sm:text-sm space-y-2 text-gray-700 dark:text-[#d0cce8]">
              <div><strong>Day:</strong> {activeClass.day}</div>
              <div><strong>Time:</strong> {activeClass.startTime}</div>
              <div><strong>Section:</strong> {activeClass.section}</div>
              <div><strong>Room:</strong> {activeClass.room}</div>
              {activeClass.classCode && (
                  <div className="mt-3 p-2 sm:p-3 bg-[#f5f3ff] dark:bg-[#3a3456] rounded-lg">
                  <strong className="text-[#4c4172] dark:text-[#c5b8f5]">Class Code:</strong>{" "}
                  <span className="font-mono text-[#9d8adb] dark:text-[#c5b8f5] tracking-wider">
                    {activeClass.classCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
