"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const Sidebar = dynamic(() => import("./Sidebar"), {
  ssr: false,
});

export default function SidebarClient() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-collapse sidebar when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* MICRO LINE TOGGLE - positioned at top */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open sidebar"
        className="
          fixed top-4 left-0
          z-40
          w-1 h-12
          bg-gradient-to-b from-[#9d8adb] to-[#4c4172]
          rounded-r-full
          shadow-md
          transition-all duration-300
          hover:w-2 hover:h-14 hover:shadow-lg
          active:scale-95
          md:hidden
          group
        "
      >
        {/* Tooltip */}
        <span className="
          absolute left-3 top-1/2 -translate-y-1/2
          px-2 py-1
          bg-[#4c4172] text-white text-xs
          rounded-md
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          whitespace-nowrap
          pointer-events-none
          shadow-lg
          z-50
        ">
          Open Menu
        </span>

        {/* Indicator dot */}
        <span className="
          absolute top-1/2 left-0.5 -translate-y-1/2
          w-1.5 h-1.5
          bg-white/80
          rounded-full
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
        " />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="
            fixed inset-0 
            z-30
            bg-black/50
            md:hidden
            animate-in fade-in duration-200
          "
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0
          z-50
          h-screen
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:fixed
          shadow-xl md:shadow-none
        `}
      >
        {/* Close button inside sidebar */}
        <button
          onClick={() => setOpen(false)}
          className="
            absolute top-4 right-4 
            md:hidden
            w-8 h-8
            flex items-center justify-center
            rounded-full
            bg-black/40
            text-white
            backdrop-blur-sm
            shadow-md
            transition-all duration-200
            hover:bg-black/60 hover:scale-110
            active:scale-90
            z-50
          "
        >
          <X size={16} />
        </button>

        <Sidebar width="350px" />
      </div>
    </>
  );
}