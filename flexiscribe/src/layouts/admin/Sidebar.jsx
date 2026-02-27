"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Home, Users, GraduationCap, BarChart3, FileText, X } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: Home },
  { label: "Manage Accounts", href: "/admin/manage-accounts", icon: Users },
  { label: "Manage Classes", href: "/admin/manage-classes", icon: GraduationCap },
  { label: "Class Analytics", href: "/admin/class-analytics", icon: BarChart3 },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
];

export default function Sidebar({ open, setOpen }) {
  const pathname = usePathname();
  const [time, setTime] = useState(new Date());
  const touchStartX = useRef(0);

  /* AUTO CLOSE ON ROUTE */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* CLOCK */
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  /* SWIPE */
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff < -80) setOpen(false);
  };

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;

  return (
    <>
      {/* OVERLAY */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 z-[60] md:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`
          fixed md:static
          top-0 left-0 z-[65]
          min-h-screen
          bg-gradient-to-b from-[#9d8adb] to-[#4c4172]
          text-white
          flex flex-col justify-between
          px-10 pt-6 pb-8
          transition-transform duration-300
          w-[345px]
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* TOP */}
        <div>
          {/* LOGO */}
          <div className="mt-6 mb-[30px] flex justify-between items-center">
            <Image
              src="/flexiscribe-logo.png"
              alt="FlexiScribe Logo"
              width={260}
              height={90}
              priority
            />

            {/* CLOSE */}
            <button
              onClick={() => setOpen(false)}
              className="md:hidden"
            >
              <X size={22} />
            </button>
          </div>

          {/* NAV */}
          <nav className="space-y-2 mt-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-5 px-8 py-4 rounded-full
                    transition-all duration-300 ease-out
                    ${
                      isActive
                        ? "bg-white/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                        : "hover:bg-white/20 hover:translate-x-1 hover:shadow"
                    }
                  `}
                >
                  <Icon size={26} strokeWidth={1.8} />
                  <span className="text-[17px] font-semibold">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* CLOCK */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 rounded-full border border-white/60 flex items-center justify-center">
            {[...Array(12)].map((_, i) => (
              <span
                key={i}
                className="absolute w-[2px] h-3 bg-white/70"
                style={{
                  transform: `rotate(${i * 30}deg) translateY(-56px)`,
                }}
              />
            ))}

            <div
              className="absolute w-[4px] h-[32px] bg-white rounded origin-bottom"
              style={{
                transform: `rotate(${hourAngle}deg)`,
                bottom: "50%",
              }}
            />

            <div
              className="absolute w-[2px] h-[44px] bg-white rounded origin-bottom"
              style={{
                transform: `rotate(${minuteAngle}deg)`,
                bottom: "50%",
              }}
            />

            <div className="absolute w-3 h-3 bg-white rounded-full z-10" />
          </div>

          <p className="text-base font-semibold">
            {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })},{" "}
            {time.toLocaleDateString([], { weekday: "long" })}
          </p>
        </div>
      </aside>
    </>
  );
}
