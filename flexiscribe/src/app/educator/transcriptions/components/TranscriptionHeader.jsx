"use client";

import { FileText, Search } from "lucide-react";
import { useState, useEffect } from "react";
import EducatorHeader from "@/layouts/educator/EducatorHeader";

export default function TranscriptionHeader() {
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

  return (
    <div className="mb-4 sm:mb-6">

      {/* ===== TOP BAR ===== */}
      <div className="flex items-center justify-between gap-3">

        {/* LEFT */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#9b8ae0] flex items-center justify-center text-white shadow-md">
            <FileText size={18} />
          </div>

          <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-[#6b5fcf] dark:text-[#c5b8f5]">
            Transcriptions
          </h1>

          {/* DESKTOP SEARCH */}
          <div className="hidden lg:block relative w-[300px] xl:w-[500px] 2xl:w-[600px]">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ffffff]"
            />
            <input
              type="text"
              placeholder="Search"
              className="
                w-full
                pl-[48px] pr-4 py-3
                rounded-full
                bg-[#9d8adb]
                text-sm
                text-[#ffffff]
                placeholder:text-[#ffffff]
                outline-none
                shadow-[0_3px_15px_rgba(0,0,0,0.05)]
              "
            />
          </div>
        </div>

        {/* RIGHT */}
        <EducatorHeader userName={userName} />
      </div>

      {/* ===== MOBILE SEARCH ===== */}
      <div className="relative w-full mt-3 lg:hidden">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ffffff]"
        />
        <input
          type="text"
          placeholder="Search"
          className="
            w-full
            pl-[48px] pr-4 py-3
            rounded-full
            bg-[#9d8adb]
            text-sm
            text-[#ffffff]
            placeholder:text-[#ffffff]
            outline-none
            shadow-[0_3px_15px_rgba(0,0,0,0.05)]
          "
        />
      </div>
    </div>
  );
}
