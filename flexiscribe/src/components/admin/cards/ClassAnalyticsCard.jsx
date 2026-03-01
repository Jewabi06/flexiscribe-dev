"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ClassAnalyticsCard({ weeklyData = [] }) {
  // Ensure we always have 7 data points (Sun-Sat)
  const chartData = DAY_LABELS.map((day, i) => {
    const entry = weeklyData[i] || {};
    return {
      day,
      mcq: entry.mcq ?? 0,
      fitb: entry.fitb ?? 0,
      flashcards: entry.flashcards ?? 0,
    };
  });

  return (
    <div
      className="
        h-[260px]
        rounded-[32px]
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        px-6
        py-5
        text-white
        shadow-[0_26px_60px_rgba(76,65,114,0.45)]
        flex
        flex-col
      "
    >
      {/* HEADER */}
      <div className="mb-2">
        <h3 className="text-lg font-semibold">
          Weekly Quiz Activity
        </h3>
        <p className="text-sm text-white/70">
          Current week (Sun – Sat)
        </p>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-4 text-xs text-white mb-2">
        <LegendItem color="#EF476F" label="MCQ" />
        <LegendItem color="#06D6A0" label="FITB" />
        <LegendItem color="#A78BFA" label="Flashcards" />
      </div>

      {/* CHART */}
      <div className="flex-1 -mx-2 rounded-xl bg-[#6f63a8]/35 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              stroke="rgba(255,255,255,0.12)"
              vertical={false}
            />

            <XAxis
              dataKey="day"
              tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />

            <Tooltip
              labelFormatter={(label) => `${label}`}
              formatter={(value, name) => [
                value,
                name === "mcq" ? "MCQ" : name === "fitb" ? "FITB" : "Flashcards",
              ]}
              contentStyle={{
                background: "#6f63a8",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "12px",
              }}
            />

            <Line type="monotone" dataKey="mcq"        stroke="#EF476F" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="fitb"       stroke="#06D6A0" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="flashcards" stroke="#A78BFA" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* LEGEND ITEM */
function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
