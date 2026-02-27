export default function OverviewCard({
  value,
  label,
  children,
}) {
  return (
    <div className="
      bg-white/20
      backdrop-blur
      rounded-[20px]
      p-5
      text-center
      shadow-inner
    ">
      {children}
      <h3 className="text-2xl font-bold mt-2">
        {value}
      </h3>
      <p className="text-sm opacity-90">
        {label}
      </p>
    </div>
  );
}
