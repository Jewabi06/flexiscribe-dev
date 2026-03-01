"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Clock, ChevronDown } from "lucide-react";

/**
 * Visual clock-hand time picker with hour/minute selection.
 * Returns time in "H:MM AM/PM" format via onChange.
 */
export default function ClockTimePicker({
  value = "",
  onChange,
  placeholder = "Select time",
  minTime,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour"); // "hour" | "minute"
  const [period, setPeriod] = useState("AM");
  const [selectedHour, setSelectedHour] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const ref = useRef(null);
  const clockRef = useRef(null);

  // Parse existing value
  useEffect(() => {
    if (!value) return;
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      setSelectedHour(parseInt(match[1]));
      setSelectedMinute(parseInt(match[2]));
      setPeriod(match[3].toUpperCase());
    }
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const commitTime = useCallback(
    (h, m, p) => {
      if (h == null || m == null) return;
      const timeStr = `${h}:${m.toString().padStart(2, "0")} ${p}`;
      onChange(timeStr);
    },
    [onChange]
  );

  const handleHourClick = (h) => {
    setSelectedHour(h);
    setMode("minute");
  };

  const handleMinuteClick = (m) => {
    setSelectedMinute(m);
    commitTime(selectedHour, m, period);
    setOpen(false);
    setMode("hour");
  };

  const togglePeriod = (p) => {
    setPeriod(p);
    if (selectedHour != null && selectedMinute != null) {
      commitTime(selectedHour, selectedMinute, p);
    }
  };

  // Clock face geometry
  const SIZE = 200;
  const CENTER = SIZE / 2;
  const RADIUS = 78;

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const getPos = (index, total) => {
    const angle = (index * 360) / total - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x: CENTER + RADIUS * Math.cos(rad),
      y: CENTER + RADIUS * Math.sin(rad),
    };
  };

  const getHandAngle = () => {
    if (mode === "hour" && selectedHour != null) {
      return ((selectedHour % 12) * 30) - 90;
    }
    if (mode === "minute" && selectedMinute != null) {
      return ((selectedMinute / 60) * 360) - 90;
    }
    return null;
  };

  const handAngle = getHandAngle();

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-3 w-full bg-gray-100 border rounded-xl px-4 py-3 mt-1 text-left cursor-pointer"
      >
        <Clock size={18} className="text-gray-600 shrink-0" />
        <span className={`flex-1 ${value ? "text-gray-800" : "text-gray-500"}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Clock popup */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#d6d1ee] rounded-2xl shadow-xl p-4 w-[240px]">
          {/* Mode tabs */}
          <div className="flex items-center justify-center gap-1 mb-3">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                mode === "hour"
                  ? "bg-[#4c4172] text-white"
                  : "text-[#4c4172] hover:bg-[#f1effa]"
              }`}
            >
              {selectedHour != null ? selectedHour : "--"}
            </button>
            <span className="text-[#4c4172] font-bold">:</span>
            <button
              type="button"
              onClick={() => selectedHour != null && setMode("minute")}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                mode === "minute"
                  ? "bg-[#4c4172] text-white"
                  : "text-[#4c4172] hover:bg-[#f1effa]"
              }`}
            >
              {selectedMinute != null
                ? selectedMinute.toString().padStart(2, "0")
                : "--"}
            </button>

            {/* AM/PM */}
            <div className="ml-2 flex flex-col gap-0.5">
              {["AM", "PM"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePeriod(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    period === p
                      ? "bg-[#9d8adb] text-white"
                      : "text-[#4c4172] hover:bg-[#f1effa]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Clock face */}
          <div className="flex justify-center">
            <svg
              ref={clockRef}
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="select-none"
            >
              {/* Background circle */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS + 16}
                fill="#f5f3ff"
                stroke="#d6d1ee"
                strokeWidth={1}
              />

              {/* Center dot */}
              <circle cx={CENTER} cy={CENTER} r={3} fill="#4c4172" />

              {/* Hand */}
              {handAngle != null && (
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={CENTER + (RADIUS - 16) * Math.cos((handAngle * Math.PI) / 180)}
                  y2={CENTER + (RADIUS - 16) * Math.sin((handAngle * Math.PI) / 180)}
                  stroke="#9d8adb"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}

              {/* Numbers */}
              {(mode === "hour" ? hours : minutes).map((n, i) => {
                const total = mode === "hour" ? 12 : 12;
                const pos = getPos(i, total);
                const isSelected =
                  mode === "hour"
                    ? n === selectedHour
                    : n === selectedMinute;

                return (
                  <g
                    key={n}
                    onClick={() =>
                      mode === "hour"
                        ? handleHourClick(n)
                        : handleMinuteClick(n)
                    }
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={14}
                      fill={isSelected ? "#4c4172" : "transparent"}
                      className="transition-colors duration-150"
                    />
                    <text
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={isSelected ? 700 : 500}
                      fill={isSelected ? "#fff" : "#4c4172"}
                      className="transition-colors duration-150 pointer-events-none"
                    >
                      {mode === "minute" ? n.toString().padStart(2, "0") : n}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
