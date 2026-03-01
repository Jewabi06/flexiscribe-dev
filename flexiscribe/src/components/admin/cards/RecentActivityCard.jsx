"use client";

export default function RecentActivityCard({ activities = [] }) {
  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="h-[260px] rounded-[32px] bg-gradient-to-br from-[#9d8adb] to-[#4c4172] px-4 sm:px-8 py-5 sm:py-7 text-white shadow-[0_26px_60px_rgba(76,65,114,0.45)] overflow-hidden">
      <div className="relative h-full">
        {/* TIMELINE LINE */}
        <div className="absolute left-[18px] top-[20px] bottom-[20px] w-[2px] bg-white/20" />

        {/* CONTENT - modern scrollbar */}
        <div
          className="h-full overflow-y-auto pr-3 space-y-5"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.25) transparent",
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              width: 4px;
            }
            div::-webkit-scrollbar-track {
              background: transparent;
            }
            div::-webkit-scrollbar-thumb {
              background: rgba(255,255,255,0.25);
              border-radius: 20px;
            }
            div::-webkit-scrollbar-thumb:hover {
              background: rgba(255,255,255,0.4);
            }
          `}</style>
          {activities.length === 0 ? (
            <div className="text-center text-white/70 mt-8">
              No recent activities
            </div>
          ) : (
            activities.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-start gap-3 transition duration-200 hover:translate-x-[2px]"
              >
                {/* DOT */}
                <div className="flex-shrink-0 mt-1 flex justify-center" style={{ width: "36px" }}>
                  <span className="h-3 w-3 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]" />
                </div>

                {/* CONTENT */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white/95">
                      {item.userName}
                    </span>
                    <span className="text-[10px] text-white/50">•</span>
                    <span className="text-[10px] text-white/60">
                      {formatDate(item.createdAt)} at {formatTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-white/85 break-words">
                    {item.description || item.action}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
