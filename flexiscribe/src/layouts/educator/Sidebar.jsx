"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  GraduationCap,
  FileText,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";

/* ---------------- CLOCK ---------------- */

function AnalogClock({ size = 140 }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {[...Array(12)].map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={50 + Math.sin(a) * 36}
            y1={50 - Math.cos(a) * 36}
            x2={50 + Math.sin(a) * 44}
            y2={50 - Math.cos(a) * 44}
            stroke="white"
            strokeWidth="2"
          />
        );
      })}

      <line
        x1="50"
        y1="50"
        x2={50 + Math.sin((hours * 30 * Math.PI) / 180) * 20}
        y2={50 - Math.cos((hours * 30 * Math.PI) / 180) * 20}
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <line
        x1="50"
        y1="50"
        x2={50 + Math.sin((minutes * 6 * Math.PI) / 180) * 30}
        y2={50 - Math.cos((minutes * 6 * Math.PI) / 180) * 30}
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      <line
        x1="50"
        y1="50"
        x2={50 + Math.sin((seconds * 6 * Math.PI) / 180) * 34}
        y2={50 - Math.cos((seconds * 6 * Math.PI) / 180) * 34}
        stroke="#9170adff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <circle cx="50" cy="50" r="3" fill="white" />
    </svg>
  );
}

/* ---------------- SIDEBAR ---------------- */

export default function Sidebar() {
  const pathname = usePathname();
  const [openClasses, setOpenClasses] = useState(false);
  const [time, setTime] = useState("");
  const [day, setDay] = useState("");
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      setDay(now.toLocaleDateString([], { weekday: "long" }));
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  // Fetch classes and extract unique courses
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/educator/classes");
        if (res.ok) {
          const data = await res.json();
          const uniqueCourses = Array.from(
            new Set(data.classes.map((c) => c.subject))
          );
          setCourses(uniqueCourses);
        }
      } catch (error) {
        console.error("Failed to fetch classes:", error);
      } finally {
        setLoadingCourses(false);
      }
    }
    fetchClasses();
  }, []);

  return (
    <aside className="edu-sidebar h-screen w-[300px] bg-gradient-to-b from-[#9d8adb] to-[#4c4172] text-white flex flex-col px-5 overflow-y-auto">
      
      {/* Logo */}
      <div className="flex align-center gap-12px width-full py-6 px-2 mb-4">
        <img
          src="/img/flexiscribe-logo.png"
          alt="fLexiScribe Logo"
          className="h-16 w-16"
        />
        <div className="flex flex-col items-start">
          <h1 className="text-2xl font-bold tracking-wide">fLexiScribe</h1>
          <p className="text-xs">Your Note-Taking Assistant</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">

        <NavItem
          icon={Home}
          label="Dashboard"
          href="/educator/dashboard"
          active={pathname === "/educator/dashboard"}
        />

        <NavItem
          icon={Calendar}
          label="Schedule"
          href="/educator/schedule"
          active={pathname === "/educator/schedule"}
        />

        {/* Classes */}
        <button
          onClick={() => setOpenClasses(!openClasses)}
          className={`edu-nav-item flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-300 ${
            openClasses ? "active" : ""
          }`}
        >
          <GraduationCap size={24} className="opacity-90" />
          <span className="text-[15px] flex-1 text-left">Classes</span>
          <ChevronDown
            size={18}
            className={`transition-transform duration-300 ${
              openClasses ? "rotate-180" : ""
            }`}
          />
        </button>

        {openClasses && (
          <div className="ml-10 mt-1 space-y-1">
            {loadingCourses ? (
              <div className="px-4 py-3">
                <div className="w-24 h-3 bg-white/20 rounded animate-pulse mb-2" />
                <div className="w-20 h-3 bg-white/20 rounded animate-pulse" />
              </div>
            ) : (
              <>
                {courses.map((course) => (
                  <Link
                    key={course}
                    href={`/educator/classes/${course.toLowerCase()}`}
                    className="edu-nav-sub-item block px-4 py-2.5 rounded-lg bg-white/10 text-sm"
                  >
                    {course}
                  </Link>
                ))}
                {courses.length === 0 && (
                  <p className="px-4 py-3 text-sm text-white/60">
                    No classes assigned yet
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <NavItem
          icon={FileText}
          label="Transcriptions"
          href="/educator/transcriptions"
          active={pathname === "/educator/transcriptions"}
        />
      </nav>

      {/* Clock */}
      <div className="edu-clock-widget mt-auto mb-8">
        <AnalogClock size={130} />
        <p className="edu-clock-time mt-3">
          {time}, {day}
        </p>
      </div>
    </aside>
  );
}

/* ---------------- NAV ITEM ---------------- */

function NavItem({ icon: Icon, label, href, active }) {
  return (
    <Link
      href={href}
      className={`edu-nav-item flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-300 ${
        active ? "active" : ""
      }`}
    >
      <Icon size={24} className="opacity-90" />
      <span className="text-[15px]">{label}</span>
    </Link>
  );
}
