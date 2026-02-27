"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarCard() {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const monthName = new Date(year, month).toLocaleString("default", {
    month: "long",
  });

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  /* ALWAYS 42 CELLS */
  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const arr = [];

    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= totalDays; d++) arr.push(d);
    while (arr.length < 42) arr.push(null);

    return arr;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <div
      className="
        relative
        w-full
        h-[220px] sm:h-[240px] md:h-[260px] lg:h-[300px] xl:h-[340px]
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        rounded-[16px] md:rounded-[24px] lg:rounded-[36px]
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        overflow-hidden
        transition-all duration-300
        hover:translate-y-[-4px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
      "
    >
      <div
        className="
          absolute
          inset-3
          bg-white dark:bg-[#1e1b2e]
          rounded-[12px] md:rounded-[20px] lg:rounded-[32px]
          shadow-[0_10px_30px_rgba(0,0,0,0.10)]
          overflow-hidden
          flex flex-col
        "
      >
        {/* HEADER */}
        <div className="bg-black text-white flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm lg:text-base font-semibold">
          <button onClick={prevMonth} className="hover:scale-110 active:scale-95 transition-transform duration-200">
            <ChevronLeft size={18} />
          </button>

          <span>
            {monthName.toUpperCase()} {year}
          </span>

          <button onClick={nextMonth} className="hover:scale-110 active:scale-95 transition-transform duration-200">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* WEEKDAYS */}
        <div className="grid grid-cols-7 text-[10px] sm:text-[11px] lg:text-xs text-gray-500 dark:text-[#9d8adb] text-center py-1 sm:py-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        {/* DAYS */}
        <div className="grid grid-cols-7 grid-rows-6 flex-1 px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3 text-[11px] sm:text-xs lg:text-sm">
          {days.map((day, i) => {
            const isToday =
              day && isCurrentMonth && day === today.getDate();

            return (
              <div
                key={i}
                className="flex items-center justify-center"
              >
                {day ? (
                  <span
                    className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                      isToday
                        ? "bg-[#e07a86] text-white font-semibold shadow-md"
                        : "text-gray-800 dark:text-[#d0cce8] hover:bg-[rgba(157,138,219,0.15)] hover:text-[#4c4172] dark:hover:text-white"
                    }`}
                  >
                    {day}
                  </span>
                ) : (
                  <span className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
