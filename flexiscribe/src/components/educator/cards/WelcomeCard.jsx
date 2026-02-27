"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function WelcomeCard({
  subtitle = "Ready to manage your classes today?",
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/educator/profile");
        if (res.ok) {
          const data = await res.json();
          const parts = data.educator.fullName?.trim().split(/\s+/) || [];
          setName(parts[0] || "Professor");
        } else {
          setName("Professor");
        }
      } catch (error) {
        console.error("Failed to fetch educator profile:", error);
        setName("Professor");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);
  return (
    <div
      className="
        edu-welcome-banner
        relative
        min-h-[90px] lg:min-h-[110px] xl:min-h-[130px]
        w-full
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        rounded-[16px] md:rounded-[24px] lg:rounded-[30px]
        px-6 md:px-10 lg:px-12 xl:px-16
        py-5 md:py-6 lg:py-7
        flex items-center
        overflow-visible
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
      "
    >
      {/* TEXT */}
      <div className="z-10">
        <h2 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-white leading-tight">
          {loading ? (
            <span className="inline-block w-48 h-8 bg-white/20 rounded animate-pulse" />
          ) : (
            <>Welcome, {name}!</>
          )}
        </h2>

        <p className="text-xs md:text-sm lg:text-base text-white/90 mt-1 opacity-90">
          {loading ? (
            <span className="inline-block w-64 h-4 bg-white/15 rounded animate-pulse mt-1" />
          ) : (
            subtitle
          )}
        </p>
      </div>

      {/* DESKTOP IMAGE */}
      <div className="hidden md:block absolute right-4 lg:right-2 bottom-0">
        <Image
          src="/owl-prof.png"
          alt="Welcome illustration"
          width={200}
          height={300}
          className="lg:w-[140px] xl:w-[180px]"
          priority
        />
      </div>

      {/* MOBILE IMAGE */}
      <div className="md:hidden absolute right-3 bottom-2">
        <Image
          src="/owl-prof.png"
          alt="Welcome illustration"
          width={90}
          height={120}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
