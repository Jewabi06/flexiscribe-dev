"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import EducatorHeader from "@/layouts/educator/EducatorHeader";
import LoadingScreen from "@/components/shared/LoadingScreen";

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/educator/classes");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes);
        }
      } catch (error) {
        console.error("Failed to fetch classes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/educator/profile");
        if (res.ok) {
          const data = await res.json();
          setUserName(data.educator.fullName.split(" ")[0] || "Educator");
        } else {
          setUserName("Educator");
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        setUserName("Educator");
      }
    }
    fetchProfile();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#9b8ae0] flex items-center justify-center text-white shadow-md">
            <BookOpen size={18} />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-[#6b5fcf] dark:text-[#c5b8f5]">
            Classes
          </h1>
        </div>

        <EducatorHeader userName={userName} />
      </div>

      {/* LIST */}
      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          gap-4 sm:gap-5
        "
      >
        {classes.map((cls) => (
          <Link
            key={cls.id}
            href={`/educator/classes/${cls.subject}`}
            className="block"
          >
            <div
              className="
                h-full
                p-4 sm:p-5
                bg-white dark:bg-[#2d2640]
                rounded-[16px] md:rounded-[20px]
                border border-[rgba(157,138,219,0.2)] dark:border-[rgba(139,127,199,0.25)]
                shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                transition-all duration-300
                hover:translate-y-[-4px]
                hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]
              "
            >
              <h2 className="font-semibold text-base sm:text-lg dark:text-[#e8e8e8]">
                {cls.subject} – Section {cls.section}
              </h2>

              <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-[#b0a8d4]">
                {cls.day} • {cls.startTime}
              </p>

              <p className="text-sm sm:text-base text-gray-600 dark:text-[#b0a8d4]">
                Room {cls.room}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
