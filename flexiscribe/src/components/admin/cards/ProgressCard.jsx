"use client";

export default function ProgressCard({
  flashcards,
  mcqs,
  fitb,
}) {
  const total = flashcards + mcqs + fitb || 1;

  const flashcardsPct = (flashcards / total) * 100;
  const mcqsPct = (mcqs / total) * 100;
  const fitbPct = (fitb / total) * 100;

  return (
    <div
      className="
        rounded-[28px]
        bg-gradient-to-br from-[#9d8adb] to-[#4c4172]
        px-4 sm:px-10
        py-6
        text-white
        shadow-[0_18px_45px_rgba(76,65,114,0.45)]
      "
    >
      {/* METRICS */}
      <div
        className="
          flex
          flex-row
          justify-between
          items-center
          text-center
        "
      >
        <Metric
          value={flashcards}
          label="Total Flashcards"
        />

        <Metric
          value={mcqs}
          label="Total MCQs"
          bordered
        />

        <Metric
          value={fitb}
          label="Total FITB"
        />
      </div>

      {/* PROGRESS BAR */}
      <div className="mt-6 h-3 sm:h-4 w-full rounded-full bg-white/25 overflow-hidden flex">
        <Segment width={flashcardsPct} color="bg-white" />
        <Segment width={mcqsPct} color="bg-[#cbb8ff]" />
        <Segment width={fitbPct} color="bg-[#a892ff]" />
      </div>
    </div>
  );
}

/* SUB COMPONENTS */

function Metric({ value, label, bordered }) {
  return (
    <div
      className={`
        flex-1
        flex flex-col
        items-center
        justify-center
        px-2
        ${bordered ? "border-x border-white/40" : ""}
      `}
    >
      <div className="text-3xl sm:text-4xl font-bold leading-none">
        {value}
      </div>

      <div className="mt-1 text-xs sm:text-sm font-medium opacity-90">
        {label} Completed
      </div>
    </div>
  );
}

function Segment({ width, color }) {
  return (
    <div
      className={`${color} h-full transition-all duration-700 ease-out`}
      style={{ width: `${width}%` }}
    />
  );
}
