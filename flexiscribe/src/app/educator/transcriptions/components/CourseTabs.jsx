"use client";

/* STRONG, VIBRANT COLORS */
const courseColors = {
  CPP117: { from: "#8b7ae6", to: "#6b5fd1" },
  CPP116: { from: "#ef4444", to: "#b91c1c" },
  CPP118: { from: "#14b8a6", to: "#0f766e" },
  CPP119: { from: "#facc15", to: "#ca8a04" },
  CPP120: { from: "#22c55e", to: "#15803d" },
  CPP121: { from: "#f97316", to: "#c2410c" },
};

export default function CourseTabs({
  courses,
  activeCourse,
  onChange,
}) {
  return (
    <div className="-translate-y-[5px]">
      <div
        className="
          flex gap-2 sm:gap-3
          overflow-x-auto
          no-scrollbar
          pb-2
          px-1
        "
      >
        {courses.map((course) => {
          const isActive =
            course === activeCourse;

          const colors =
            courseColors[course] || {
              from: "#a78bfa",
              to: "#7c3aed",
            };

          return (
            <button
              key={course}
              onClick={() => onChange(course)}
              className={`
                shrink-0
                px-3 sm:px-5 lg:px-8
                py-2 sm:py-3
                rounded-t-[16px] sm:rounded-t-[22px]
                text-[11px] sm:text-sm
                font-bold
                text-white
                transition-all duration-300 ease-out
                transform
                ${
                  isActive
                    ? "opacity-100"
                    : "opacity-70 hover:opacity-100"
                }
                active:scale-[0.96]
                active:-translate-y-[2px]
                hover:translate-y-[-2px] hover:shadow-lg
              `}
              style={{
                background: `linear-gradient(to bottom, ${colors.from}, ${colors.to})`,
                marginBottom: "-1px",
              }}
            >
              {course}
            </button>
          );
        })}
      </div>
    </div>
  );
}
