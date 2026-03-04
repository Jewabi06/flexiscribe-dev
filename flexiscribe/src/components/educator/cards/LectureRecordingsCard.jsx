"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LectureRecordingsCard() {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTranscriptions() {
      try {
        const res = await fetch("/api/educator/transcriptions");
        if (res.ok) {
          const data = await res.json();
          const latestThree = data.transcriptions.slice(0, 3);
          setLectures(latestThree);
        }
      } catch (error) {
        console.error("Failed to fetch transcriptions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTranscriptions();
  }, []);

  return (
    <div
      className="
        relative overflow-hidden
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        rounded-[16px] md:rounded-[24px] lg:rounded-[36px]
        px-3 sm:px-4 md:px-3 lg:px-4 pt-3 sm:pt-4 pb-4 sm:pb-6
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        text-white
        h-[580px] sm:h-[600px] md:h-[680px] lg:h-[720px] xl:h-[640px]
        flex flex-col
        transition-all duration-300
        hover:translate-y-[-4px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
      "
    >
      {/* HEADER - Centered */}
      <div className="flex items-center justify-center mb-2 sm:mb-3 px-2 sm:px-4 md:px-6">
        <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold">
          Lecture Recordings
        </h3>
      </div>

      {/* ILLUSTRATION - Above the transcript items */}
      <div className="relative flex justify-center mb-3 sm:mb-4">
        <Image
          src="/speech-text-sticker.png"
          alt="Speech to Text"
          width={500}
          height={500}
          className="
            w-[400px] sm:w-[420px] md:w-[440px] lg:w-[460px] xl:w-[480px]
            object-contain
          "
        />
      </div>

      <div className="text-right p-2">Recents</div>

      {/* LIST - Grouped as chunks */}
      <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto px-1">
        {loading ? (
          <>  
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/10 rounded-lg p-2 space-y-2">
                <div className="flex justify-between px-1">
                  <span className="inline-block w-20 h-3 bg-white/20 rounded animate-pulse" />
                  <span className="inline-block w-12 h-3 bg-white/20 rounded animate-pulse" />
                </div>
                <div className="bg-white/20 rounded-full px-4 py-2 h-8 animate-pulse" />
              </div>
            ))}
          </>
        ) : (
          lectures.map((lecture, index) => (
            <LectureItem key={index} {...lecture} />
          ))
        )}
      </div>
    </div>
  );
}

/* ================= ITEM ================= */

function LectureItem({ date, duration, course }) {
  return (
    <div className="bg-white/5 rounded-lg p-2 sm:p-3 space-y-3 backdrop-blur-sm transition-all duration-300 hover:bg-white/10">
      {/* Date and Time - Side by side with minimalist icons */}
      <div className="flex items-center justify-between px-1">
        {/* Date with icon */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] sm:text-xs text-white/80">{date}</span>
        </div>
        
        {/* Time with icon */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] sm:text-xs font-medium text-white/90">{duration}</span>
        </div>
      </div>

      {/* Transcript Link and Course - Grouped together */}
      <div className="bg-white dark:bg-[#2d2640] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-2 sm:gap-3 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-2px] text-xs sm:text-sm">
        <Link
          href={`/educator/transcriptions?course=${course}`}
          className="text-[#6f63a8] text-[16px] font-medium hover:underline transition-colors duration-200 whitespace-nowrap"
        >
          View Transcript
        </Link>

        <span className="text-[#6f63a8]">|</span>

        <span className="font-semibold text-[#6f63a8] text-[16px] whitespace-nowrap">
          {course}
        </span>
      </div>
    </div>
  );
}