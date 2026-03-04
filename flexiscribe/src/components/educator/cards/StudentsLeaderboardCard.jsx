"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

/* ================= PODIUM STUDENT ================= */

function PodiumStudent({ name, exp, rank }) {
  const badges = {
    1: "/leaderboard/gold.png",
    2: "/leaderboard/silver.png",
    3: "/leaderboard/bronze.png"
  };

  const podiumHeights = {
    1: "h-8",
    2: "h-5",
    3: "h-5"
  };

  const iconSizes = {
    1: "w-10 h-10 md:w-12 md:h-12",
    2: "w-8 h-8 md:w-10 md:h-10",
    3: "w-8 h-8 md:w-10 md:h-10"
  };

  const isFirst = rank === 1;

  return (
    <div className={`flex flex-col items-center ${isFirst ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'} flex-1`}>
      {/* Rank Badge */}
      <div className="bg-yellow-400 text-purple-900 font-bold text-[8px] px-1 py-0.5 rounded-full mb-0.5 shadow-md">
        #{rank}
      </div>

      {/* Icon */}
      <Image
        src={badges[rank]}
        alt={`rank ${rank}`}
        width={50}
        height={50}
        className={`${iconSizes[rank]} object-contain transition-transform hover:scale-110`}
      />

      {/* Name and XP */}
      <div className="text-center mt-0.5 max-w-[70px]">
        <div className="font-semibold text-[10px] truncate text-white">
          {name}
        </div>
        <div className="text-[7px] text-white/70">
          {exp}
        </div>
      </div>

      {/* Podium Bar */}
      <div className={`w-full ${podiumHeights[rank]} bg-white/10 rounded-t-lg mt-0.5 relative overflow-hidden`}>
        <div 
          className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-yellow-400 to-yellow-300"
          style={{ height: `${rank === 1 ? '100%' : rank === 2 ? '70%' : '40%'}` }}
        />
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

  const top3 = students.slice(0, 3).map((s, idx) => ({
    name: s.fullName,
    exp: `${s.xp} XP`,
    rank: idx + 1
  }));

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Main Card */}
      <div
        className="
          relative
          bg-gradient-to-br from-[#8f7acb] to-[#5a4a86]
          rounded-2xl md:rounded-3xl
          px-6 py-2.5
          text-white
          shadow-lg
          overflow-visible
          min-h-[120px]
          z-10
        "
      >
        {/* Content Container - Left side */}
        <div className="pr-32 md:pr-40 lg:pr-48">
          {/* Header */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🏆</span>
              <h3 className="text-xs font-semibold">
                Top 3 Leaders
              </h3>
            </div>
            <span className="text-[8px] text-white/70 bg-white/10 px-1.5 py-0.5 rounded-full">
              Weekly
            </span>
          </div>

          {/* Podium */}
          {loading ? (
            <div className="flex items-end justify-center gap-2 h-16">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-white/20 animate-pulse mb-1" />
                  <div className="w-10 h-1.5 bg-white/20 rounded animate-pulse mb-0.5" />
                  <div className="w-6 h-1.5 bg-white/15 rounded animate-pulse mb-1" />
                  <div className="w-full h-4 bg-white/10 rounded-t-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-end justify-center gap-1">
              {top3.length > 0 ? (
                <>
                  {top3[1] && <PodiumStudent {...top3[1]} />} {/* 2nd */}
                  {top3[0] && <PodiumStudent {...top3[0]} />} {/* 1st */}
                  {top3[2] && <PodiumStudent {...top3[2]} />} {/* 3rd */}
                </>
              ) : (
                <div className="text-center py-3 text-white/60 text-[10px]">
                  No data available
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-1 text-[7px] text-white/50">
            Updated just now
          </div>
        </div>

        {/* Trophy Image - Much larger on mobile, slightly smaller on desktop */}
        <div className="absolute -bottom-8 -right-8 sm:-bottom-6 sm:-right-6 md:-bottom-8 md:-right-8 lg:-bottom-10 lg:-right-10 z-20">
          <Image
            src="/leaderboard/awardicon.png"
            alt="Award Trophy"
            width={400}
            height={300}
            className="
              w-56 h-auto
              sm:w-44
              md:w-52
              lg:w-64
              xl:w-72
              drop-shadow-2xl
              transform rotate-6
              hover:rotate-0 hover:scale-105
              transition-all duration-300
            "
            priority
            quality={100}
          />
        </div>
      </div>

      {/* Subtle glow effect behind the trophy - Larger on mobile */}
      <div className="absolute bottom-0 right-0 w-64 h-64 sm:w-48 sm:h-48 md:w-56 md:h-56 bg-white/10 rounded-full blur-3xl -z-0" />
    </div>
  );
}