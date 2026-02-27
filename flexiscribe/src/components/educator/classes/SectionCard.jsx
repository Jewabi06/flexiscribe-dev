"use client";

import { Users, BookOpen, Clock, Copy } from "lucide-react";
import { useState } from "react";

export default function SectionCard({
  section,
  classCode,
  students,
  room,
  day,
  time,
  active = false,
  onClick,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!classCode) return;

    navigator.clipboard.writeText(classCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`
        w-full
        rounded-[20px] sm:rounded-[30px] lg:rounded-[36px]
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        p-[5px] sm:p-[6px]
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        cursor-pointer
        transition-all duration-300
        hover:translate-y-[-6px] hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        ${active ? "ring-2 ring-[#9b8ae0]" : ""}
      `}
    >
      {/* INNER */}
      <div className="rounded-[22px] sm:rounded-[30px] bg-white dark:bg-[#2d2640] overflow-hidden">

        {/* HEADER */}
        <div
          className="
            bg-gradient-to-b from-[#9d8adb] to-[#6f63b5]
            text-white text-center
            py-5 sm:py-8
          "
        >
          <h2 className="text-base sm:text-[22px] font-bold tracking-wide">
            SECTION – {section || "-"}
          </h2>

          {/* CODE */}
          <div
            className="
              mt-1
              flex flex-wrap
              items-center justify-center
              gap-2
              text-[10px] sm:text-sm
              opacity-90
            "
          >
            <span>CLASS CODE:</span>
            <span className="font-semibold select-all">
              {classCode || "N/A"}
            </span>

            <button
              onClick={handleCopy}
              disabled={!classCode}
              className="p-1 rounded hover:bg-white/20 disabled:opacity-40"
            >
              <Copy size={13} />
            </button>

            {copied && (
              <span className="text-[10px] sm:text-xs text-green-200">
                Copied
              </span>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="px-4 sm:px-6 py-5 sm:py-8 text-[#6b5fcf] dark:text-[#c5b8f5]">

          {/* TOP */}
          <div className="flex justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Users size={20} className="text-[#8f7cc8] dark:text-[#b0a8d4] sm:w-6 sm:h-6" />
              <span className="font-semibold text-sm sm:text-lg text-[#8f7cc8] dark:text-[#b0a8d4]">
                {students ?? 0}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-semibold text-sm sm:text-lg text-[#8f7cc8] dark:text-[#b0a8d4]">
                Lecture
              </span>
              <BookOpen size={20} className="text-[#8f7cc8] dark:text-[#b0a8d4] sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* DIVIDER */}
          <div className="my-4 sm:my-6 h-px bg-[#e3def7] dark:bg-[rgba(139,127,199,0.3)]" />

          {/* BOTTOM */}
          <div
            className="
              flex justify-between
              text-xs sm:text-base
            "
          >
            <span className="font-semibold text-[#8f7cc8] dark:text-[#b0a8d4]">
              ROOM : {room || "-"}
            </span>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right leading-tight">
                <div className="font-semibold text-[#8f7cc8] dark:text-[#b0a8d4]">
                  {day || "-"}
                </div>
                <div className="text-[10px] sm:text-sm text-[#8f7cc8]/80 dark:text-[#b0a8d4]/70">
                  {time || "-"}
                </div>
              </div>

              <Clock size={18} className="text-[#8f7cc8] dark:text-[#b0a8d4] sm:w-5 sm:h-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
