"use client";

import {
  GraduationCap,
  UserSquare2,
  Activity,
} from "lucide-react";

function Icon({ label }) {
  const common =
    "absolute -top-10 -right-10 opacity-15";
  const size = 150;

  switch (label) {
    case "Total Students":
      return (
        <GraduationCap
          size={size}
          className={common}
        />
      );

    case "Total Educators":
      return (
        <UserSquare2
          size={size}
          className={common}
        />
      );

    case "Active Users":
      return (
        <Activity
          size={size}
          className={common}
        />
      );

    default:
      return null;
  }
}

export default function StatCard({
  label,
  value,
}) {
  return (
    <div
      className="
        relative
        h-[160px]
        rounded-[32px]
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        px-5 sm:px-10
        py-6 sm:py-8
        overflow-hidden
        text-white
        shadow-[0_22px_50px_rgba(76,65,114,0.45)]
        transition-all duration-300
        hover:-translate-y-[4px]
        hover:shadow-[0_30px_70px_rgba(76,65,114,0.55)]
      "
    >
      <Icon label={label} />

      <div className="relative z-10">
        <div className="text-4xl sm:text-[56px] font-extrabold leading-none tracking-tight">
          {value}
        </div>

        <div className="mt-2 sm:mt-4 text-sm sm:text-base font-medium opacity-90">
          {label}
        </div>
      </div>
    </div>
  );
}
