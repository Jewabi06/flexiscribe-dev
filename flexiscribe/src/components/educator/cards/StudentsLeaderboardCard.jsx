"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

/* ================= STUDENT ================= */

function Student({ name, exp, rank }) {
  const badge =
    rank === 1
      ? "/leaderboard/gold.png"
      : rank === 2
      ? "/leaderboard/silver.png"
      : rank === 3
      ? "/leaderboard/bronze.png"
      : "/leaderboard/lilac.png";

  return (
    <div
      className={`
        group flex items-center gap-3
        p-2.5 rounded-xl
        transition-all duration-300 ease-out
        hover:bg-white/10 hover:translate-x-1
        bg-white/15 shadow-sm
      `}
    >
      <Image
        src={badge}
        alt="rank badge"
        width={44}
        height={44}
        className="shrink-0 transition group-hover:scale-110"
      />

      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold tracking-wide truncate">
          #{rank} {name}
        </div>

        <div className="text-xs text-white/80">
          {exp}
        </div>
      </div>
    </div>
  );
}

/* ================= MAIN ================= */

export default function StudentsLeaderboardCard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/educator/leaderboard?limit=3");
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  const topStudents = students.slice(0, 3).map((s) => ({
    name: s.fullName,
    exp: `${s.xp} XP`,
  }));

  return (
    <div
      className="
        relative
        bg-gradient-to-br from-[#8f7acb] to-[#5a4a86]
        rounded-[16px] md:rounded-[24px]
        px-5 py-4 md:px-6 md:py-5
        text-white
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        overflow-visible
        transition-all duration-300
        hover:translate-y-[-2px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <h3 className="text-sm md:text-base font-semibold tracking-wide">
            Top Students
          </h3>
        </div>
      </div>

      {/* TROPHY IMAGE */}
      <Image
        src="/leaderboard/awardicon.png"
        alt="Award"
        width={250}
        height={188}
        className="absolute -bottom-6 -right-4 hidden md:block pointer-events-none"
      />

      {/* CONTENT */}
      <div className="space-y-2">
        {loading ? (
          [1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 p-2.5">
              <div className="w-10 h-10 rounded-full bg-white/20 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="w-24 h-3 bg-white/20 rounded animate-pulse" />
                <div className="w-16 h-2 bg-white/15 rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : topStudents.length === 0 ? (
          <div className="text-center text-white/60 text-sm py-4">
            No students yet
          </div>
        ) : (
          topStudents.map((s, i) => (
            <Student key={s.name} {...s} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}
