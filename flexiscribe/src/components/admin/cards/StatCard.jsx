"use client";

import {
  GraduationCap,
  UserSquare2,
  Activity,
  TrendingUp,
  TrendingDown,
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
  percentage,
}) {
  const isPositive = percentage > 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

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

      <div className="relative z-5 h-full">
        <div className="flex items-center justify-between">
          <div className="text-4xl sm:text-[56px] font-extrabold leading-none tracking-tight">
            {value}
          </div>

          {/* Empty div to maintain flex layout */}
          <div></div>
        </div>

        {/* Percentage absolutely positioned - adjust top value to move freely */}
        {percentage !== undefined && (
          <div className={`absolute right-1 sm:right-1 flex items-center gap-1 text-sm font-semibold ${
            isPositive ? 'text-green-300' : 'text-red-300'
          }`} style={{ top: '85px' }}>
            <TrendIcon size={16} />
            <span>{isPositive ? '+' : ''}{percentage}%</span>
          </div>
        )}

        <div className="absolute bottom-10 sm:bottom-1 left-1 sm:left-1 text-sm sm:text-base font-medium opacity-90">
          {label}
        </div>
      </div>
    </div>
  );
}