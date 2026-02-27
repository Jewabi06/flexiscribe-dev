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

import { classAnalyticsData } from "@/lib/mock/classAnalytics";

export default function ClassAnalyticsCard() {
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
          Activity Signals
        </h3>
        <p className="text-sm text-white/70">
          Engagement patterns by type
        </p>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-4 text-xs text-white mb-2">
        <LegendItem color="#00E5FF" label="Section A" />
        <LegendItem color="#FFD166" label="Section B" />
        <LegendItem color="#EF476F" label="Quiz" />
        <LegendItem color="#06D6A0" label="FITB" />
        <LegendItem color="#A78BFA" label="Flashcards" />
      </div>

      {/* CHART */}
      <div className="flex-1 -mx-2 rounded-xl bg-[#6f63a8]/35 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={classAnalyticsData}>
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
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />

            <Tooltip
              labelFormatter={(label) => `Day: ${label}`}
              formatter={(value) => [`${value ?? 0}%`, ""]}
              contentStyle={{
                background: "#6f63a8",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "12px",
              }}
            />

            <Line type="monotone" dataKey="sectionA" stroke="#00E5FF" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="sectionB" stroke="#FFD166" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="quizzes"  stroke="#EF476F" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="fitb"     stroke="#06D6A0" strokeWidth={2.5} dot={false} />
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
