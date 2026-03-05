"use client";

import Link from "next/link";
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

function AnalogClock({ size = 160 }) {
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

export default function Sidebar({ width = "350px" }) {
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
    <aside 
      className="h-screen bg-gradient-to-b from-[#9d8adb] to-[#4c4172] text-white flex flex-col px-6 overflow-y-auto"
      style={{ width: width }}
    >
      {/* Logo */}
      <div className="flex items-center gap-1 w-full py-10 px-2 mb-0">
        <img
          src="/img/fLexiScribe-logo.png"
          alt="fLexiScribe Logo"
          className="h-20 w-20"
        />
        <div className="flex flex-col items-start">
          <h1 className="text-2xl font-bold tracking-wide">fLexiScribe</h1>
          <p className="text-sm opacity-80 mt-1">Your Note-Taking Assistant</p>
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
          className={`flex items-center gap-4 px-7 py-5 rounded-xl transition-all duration-300 w-full ${
            openClasses ? "active bg-white/15" : "hover:bg-white/10"
          }`}
        >
          <GraduationCap size={26} className="opacity-90" />
          <span className="text-base flex-1 text-left font-medium">Classes</span>
          <ChevronDown
            size={20}
            className={`transition-transform duration-300 ${
              openClasses ? "rotate-180" : ""
            }`}
          />
        </button>

        {openClasses && (
          <div className="ml-12 my-2 space-y-2">
            {loadingCourses ? (
              <div className="px-5 py-4">
                <div className="w-28 h-4 bg-white/20 rounded animate-pulse mb-2" />
                <div className="w-24 h-4 bg-white/20 rounded animate-pulse" />
              </div>
            ) : (
              <>
                {courses.map((course) => (
                  <Link
                    key={course}
                    href={`/educator/classes/${course.toLowerCase()}`}
                    className="block px-5 py-3 rounded-lg bg-white/10 text-base hover:bg-white/20 transition-colors"
                  >
                    {course}
                  </Link>
                ))}
                {courses.length === 0 && (
                  <p className="px-5 py-4 text-base text-white/60">
                    No classes assigned yet
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <NavItem
          icon={FileText}
          label="Documents"
          href="/educator/transcriptions"
          active={pathname === "/educator/transcriptions"}
        />
      </nav>

      {/* Clock - with smaller text below */}
      <div className="mt-auto mb-10 flex flex-col items-center">
        <AnalogClock size={160} />
        {/* Made the text smaller - changed from text-xl to text-base */}
        <p className="mt-4 text-base font-medium">
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
      className={`flex items-center gap-4 px-7 py-5 rounded-xl transition-all duration-300 ${
        active ? "bg-white/20" : "hover:bg-white/10"
      }`}
    >
      <Icon size={26} className="opacity-90" />
      <span className="text-base font-medium">{label}</span>
    </Link>
  );
}