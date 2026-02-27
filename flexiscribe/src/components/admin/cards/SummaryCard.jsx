export default function SummaryCard({ value, label }) {
  return (
    <div className="
      bg-gradient-to-br
      from-[#9d8adb]
      to-[#5f568f]
      rounded-[22px]
      p-6
      text-white
      shadow-md
    ">
      <h3 className="text-3xl font-bold">
        {value}
      </h3>
      <p className="text-sm opacity-90">
        {label}
      </p>
    </div>
  );
}
