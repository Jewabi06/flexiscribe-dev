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
        relative overflow-visible
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        rounded-[16px] md:rounded-[24px] lg:rounded-[36px]
        px-3 sm:px-4 md:px-3 lg:px-4 pt-3 sm:pt-4 pb-4 sm:pb-6
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        text-white min-h-[360px] sm:min-h-[420px] md:min-h-[400px] lg:min-h-[720px] xl:min-h-[760px]
        flex flex-col
        transition-all duration-300
        hover:translate-y-[-4px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
      "
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2 sm:mb-3 px-4 sm:px-6 md:px-8 lg:px-10">
        <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">
          Lecture Recordings
        </h3>
      </div>

      {/* LIST */}
      <div className="space-y-4 flex-1">
        {loading ? (
          <>  
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between px-1 sm:px-2">
                  <span className="inline-block w-20 h-3 bg-white/20 rounded animate-pulse" />
                  <span className="inline-block w-12 h-3 bg-white/20 rounded animate-pulse" />
                </div>
                <div className="bg-white/20 rounded-full px-4 sm:px-8 py-2 sm:py-3 h-10 animate-pulse" />
              </div>
            ))}
          </>
        ) : (
          lectures.map((lecture, index) => (
            <LectureItem key={index} {...lecture} />
          ))
        )}
      </div>

      {/* ILLUSTRATION */}
      <Image
        src="/speech-text-sticker.png"
        alt="Speech to Text"
        width={500}
        height={500}
        className="
          absolute bottom-[-20px] left-[-85px]
          max-w-none pointer-events-none select-none
          hidden md:block
        "
      />
    </div>
  );
}

/* ================= ITEM ================= */

function LectureItem({ date, duration, course }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs sm:text-sm text-white/90 px-1 sm:px-2">
        <span>{date}</span>
        <span>{duration}</span>
      </div>

      <div className="bg-white dark:bg-[#2d2640] rounded-full px-4 sm:px-8 py-2 sm:py-3 flex items-center gap-4 sm:gap-7 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-2px]">
        <Link
          href={`/educator/transcriptions?course=${course}`}
          className="text-[#6f63a8] font-medium hover:underline transition-colors duration-200"
        >
          View Transcript
        </Link>

        <span className="text-[#6f63a8]">|</span>

        <span className="font-semibold text-[#6f63a8]">
          {course}
        </span>
      </div>
    </div>
  );
}
