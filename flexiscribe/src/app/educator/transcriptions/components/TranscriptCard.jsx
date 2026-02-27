"use client";

const statusStyles = {
  COMPLETED: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
  PROCESSING: { bg: "bg-blue-100", text: "text-blue-700", label: "Processing" },
};

export default function TranscriptCard({
  transcript = {},
  selected = false,
  onSelect,
}) {
  function handleClick() {
    if (onSelect) onSelect();
  }

  const status = transcript.status || "COMPLETED";
  const style = statusStyles[status] || statusStyles.COMPLETED;

  // Determine chunk count from JSON data
  const chunkCount = transcript.transcriptJson?.chunks?.length || 0;
  const hasSummary = !!transcript.summaryJson;

  return (
    <div
      className={`bg-white dark:bg-[#2d2640] rounded-[20px] sm:rounded-[28px] overflow-hidden transition-all duration-300 ease-out cursor-pointer hover:translate-y-[-4px] ${
        selected
          ? "ring-2 ring-[#9d8adb] shadow-[0_12px_30px_rgba(157,138,219,0.28)]"
          : "shadow-[0_8px_22px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
      }`}
      onClick={handleClick}
    >
      {/* HEADER */}
      <div className="bg-gradient-to-br from-[#8f7bd1] to-[#7d6ac4] px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-start gap-4">
        <h3 className="text-white font-semibold text-[13px] sm:text-sm lg:text-[15px] leading-snug max-w-[75%] break-words">
          {transcript.title || "No title"}
        </h3>
        <span className="text-[11px] text-white bg-white/20 px-3 py-1.5 rounded-full font-medium shrink-0">
          {transcript.course || "-"}
        </span>
      </div>

      {/* BODY */}
      <div className="px-5 sm:px-6 py-4 sm:py-5 text-[13px] space-y-4">
        {[
          ["Date", transcript.date],
          ["Duration", transcript.duration],
          ["Segments", chunkCount > 0 ? `${chunkCount} chunks` : "-"],
          ["Summary", hasSummary ? "Cornell Notes" : "Not available"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-start gap-3">
            <span className="font-semibold text-[#5f54a6]">{label}</span>
            <span className="text-[#6f63a8] text-right">{value || "-"}</span>
          </div>
        ))}

        {/* STATUS BADGE */}
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[#5f54a6]">Status</span>
          <span className={`text-[11px] px-3 py-1 rounded-full font-medium ${style.bg} ${style.text}`}>
            {style.label}
          </span>
        </div>

        {/* ACTION */}
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
           className="mt-4 sm:mt-5 w-full rounded-[16px] border border-[#c8c1f1] py-3 sm:py-3.5 text-[#6f63a8] font-medium hover:bg-[#edeaff] hover:shadow-md transition-all duration-200"
        >
          View Transcript
        </button>
      </div>
    </div>
  );
}
