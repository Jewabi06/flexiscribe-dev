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
          setName(data.educator.username || data.educator.fullName?.trim().split(/\s+/)[0] || "Professor");
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
        min-h-[70px] lg:min-h-[85px] xl:min-h-[100px]
        w-full
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        rounded-[16px] md:rounded-[24px] lg:rounded-[30px]
        px-6 md:px-10 lg:px-12 xl:px-16
        py-4 md:py-5 lg:py-6
        flex items-center
        overflow-visible
        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
        -mt-1 md:-mt-2 lg:-mt-3
      "
    >
      {/* TEXT - moved further left with negative margin */}
      <div className="z-10 md:-ml-4 lg:-ml-6 xl:-ml-8">
        <h2 className="text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-white leading-tight">
          {loading ? (
            <span className="inline-block w-40 h-6 bg-white/20 rounded animate-pulse" />
          ) : (
            <>Welcome, {name}!</>
          )}
        </h2>

        <p className="text-xs md:text-sm lg:text-sm text-white/90 mt-1 opacity-90">
          {loading ? (
            <span className="inline-block w-56 h-3.5 bg-white/15 rounded animate-pulse mt-1" />
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
          width={160}
          height={240}
          className="lg:w-[120px] xl:w-[150px]"
          priority
        />
      </div>

      {/* MOBILE IMAGE */}
      <div className="md:hidden absolute right-3 bottom-2">
        <Image
          src="/owl-prof.png"
          alt="Welcome illustration"
          width={80}
          height={100}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}