"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ScheduleCard() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch("/api/educator/schedule");
        if (res.ok) {
          const data = await res.json();
          const today = new Date().toLocaleString("en-US", {
            weekday: "long",
          });
          
          // Filter for today's classes
          const todaysSchedule = data.schedule.filter(
            (item) => item.day === today
          );
          
          setSchedules(todaysSchedule);
        }
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  return (
    <Link href="/educator/schedule" className="block cursor-pointer">
      <div
        className="
          w-full
          min-h-[220px] sm:min-h-[250px] md:min-h-[275px] lg:min-h-[310px] xl:min-h-[340px]
          bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
          rounded-[16px] md:rounded-[24px] lg:rounded-[36px]
          shadow-[0_4px_20px_rgba(0,0,0,0.08)]
          text-white
          overflow-hidden
          transition-all duration-300
          hover:translate-y-[-4px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
        "
      >
        {/* HEADER */}
        <div
          className="
            text-center
            text-base sm:text-lg md:text-xl lg:text-xl
            font-semibold
            py-3 sm:py-4 lg:py-4
            bg-white/15
            shadow-[inset_0_-5px_6px_rgba(0,0,0,0.25)]
          "
        >
          Today’s Schedule
        </div>

        {/* ITEMS (SCROLLABLE) */}
        <div
          className="
            space-y-2
            px-3 sm:px-4 lg:px-5 py-2 sm:py-3 lg:py-4
            max-h-[160px] sm:max-h-[180px] md:max-h-[200px] lg:max-h-[250px] xl:max-h-[280px]
            overflow-y-auto
            pr-3 lg:pr-4
          "
        >
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-[18px] sm:rounded-[22px] bg-white/18 h-[52px] sm:h-[60px] animate-pulse" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-center text-white/80">
              No schedule for today 🎉
            </p>
          ) : (
            schedules.map((item, index) => (
              <ScheduleItem key={index} {...item} />
            ))
          )}
        </div>
      </div>
    </Link>
  );
}

/* ================= ITEM ================= */

function ScheduleItem({ subject, section, startTime, room }) {
  return (
    <div
      className="
        relative
        flex gap-8
        pl-12 sm:pl-16 pr-4 sm:pr-6 py-2 sm:py-3
        rounded-[18px] sm:rounded-[22px]
        bg-white/18
        shadow-[0_6px_14px_rgba(0,0,0,0.25)]
      "
    >
      <Image
        src="/pin.png"
        alt="Pin"
        width={80}
        height={40}
        className="
          absolute
          left-[-15px]
          top-1/2
          -translate-y-1/2
          drop-shadow-md
          pointer-events-none
        "
      />

      <div>
        <p className="text-sm sm:text-base md:text-base lg:text-lg font-semibold">
          {subject} - Section {section}
        </p>
        <p className="text-xs sm:text-sm lg:text-sm text-white/75">
          {startTime} • Room {room}
        </p>
      </div>
    </div>
  );
}
