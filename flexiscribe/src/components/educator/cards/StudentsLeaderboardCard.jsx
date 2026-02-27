"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

/* ================= STUDENT ================= */

function Student({ name, exp, icon, rank }) {
  const badge =
    rank === 1
      ? "/leaderboard/gold.png"
      : rank === 2
      ? "/leaderboard/silver.png"
      : rank === 3
      ? "/leaderboard/bronze.png"
      : icon || "/leaderboard/lilac.png";

  const progress =
    rank === 1
      ? "100%"
      : rank === 2
      ? "85%"
      : rank === 3
      ? "70%"
      : "50%";

  return (
    <div
      className={`
        group
        flex items-center gap-3
        p-2 rounded-xl
        transition-all duration-300 ease-out
        hover:bg-white/10 hover:translate-x-1
        ${rank <= 3 ? "bg-white/20 shadow-md scale-[1.02]" : ""}
      `}
    >
      <Image
        src={badge}
        alt="rank badge"
        width={48}
        height={48}
        className="shrink-0 transition group-hover:scale-110"
      />

      <div className="flex-1">
        <div className="text-[15px] font-semibold tracking-wide">
          #{rank} {name}
        </div>

        <div className="text-xs text-white/80">
          {exp}
        </div>

        <div className="w-full h-1 bg-white/20 rounded mt-1 overflow-hidden">
          <div
            className="h-1 bg-yellow-400 rounded transition-all duration-500"
            style={{ width: progress }}
          />
        </div>
      </div>
    </div>
  );
}

/* ================= COLUMN ================= */

function LeaderboardColumn({ data, startRank }) {
  return (
    <div className="w-[150px] md:w-[180px] lg:w-[200px] xl:w-[220px] space-y-1 shrink-0">
      {data.map((s, i) => (
        <Student
          key={s.name}
          {...s}
          rank={startRank + i}
        />
      ))}
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
        const res = await fetch("/api/educator/leaderboard?limit=15");
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

  // Split into 3 columns of 5 students each
  const col1 = students.slice(0, 5).map((s) => ({ name: s.fullName, exp: `${s.xp} XP` }));
  const col2 = students.slice(5, 10).map((s) => ({ name: s.fullName, exp: `${s.xp} XP` }));
  const col3 = students.slice(10, 15).map((s) => ({ name: s.fullName, exp: `${s.xp} XP` }));

  return (
    <div
      className="
        relative
        bg-gradient-to-br from-[#8f7acb] to-[#5a4a86]
        rounded-[16px] md:rounded-[24px] lg:rounded-[32px]
        px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14
        py-2 sm:py-3 lg:py-4 xl:py-5
        text-white
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        overflow-visible
        transition-all duration-300
        hover:translate-y-[-4px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl sm:text-2xl">🏆</span>
          <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold tracking-wide">
            Students Leaderboard
          </h3>
        </div>

        <span className="text-xs sm:text-sm text-white/70">
          Weekly Ranking
        </span>
      </div>

      {/* CONTENT */}
      <div className="flex items-start overflow-x-auto md:overflow-visible edu-scrollbar">
        {loading ? (
          <div className="flex gap-10 w-full">
            {[1, 2, 3].map((col) => (
              <div key={col} className="w-[200px] space-y-2">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-white/20 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="w-24 h-3 bg-white/20 rounded animate-pulse" />
                      <div className="w-16 h-2 bg-white/15 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            <LeaderboardColumn
              data={col1}
              startRank={1}
            />
            <div className="w-10 shrink-0" />

            <LeaderboardColumn
              data={col2}
              startRank={col1.length + 1}
            />
            <div className="w-10 shrink-0" />

            <LeaderboardColumn
              data={col3}
              startRank={col1.length + col2.length + 1}
            />
            <div className="w-16 shrink-0" />
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-4 text-xs text-white/60">
        Updated just now
      </div>

      {/* TROPHY */}
      <Image
        src="/leaderboard/awardicon.png"
        alt="Award"
        width={265}
        height={200}
        className="
          absolute
          -bottom-8
          -right-6
          hidden md:block
          scale-95
          pointer-events-none
        "
      />
    </div>
  );
}
