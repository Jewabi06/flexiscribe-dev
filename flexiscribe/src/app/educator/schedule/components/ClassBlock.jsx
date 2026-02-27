export default function ClassBlock({ title, section, room, color }) {
  return (
    <div
      className={`h-full w-full rounded-lg px-1.5 sm:px-2 md:px-3 py-1 sm:py-2 text-white text-[9px] sm:text-[10px] md:text-xs font-semibold flex flex-col justify-center text-center transition-all duration-200 hover:brightness-110 hover:shadow-md ${color}`}
    >
      <div>{title}</div>
      <div className="opacity-90">{section}</div>
      <div className="opacity-80">{room}</div>
    </div>
  );
}
