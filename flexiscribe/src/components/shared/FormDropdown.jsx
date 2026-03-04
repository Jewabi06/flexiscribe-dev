"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function FormDropdown({
  value,
  options = [],
  onChange,
  placeholder = "Select…",
  icon: Icon,
  className = "",
  dropUp = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-3 w-full bg-gray-100 border rounded-xl px-4 py-3 mt-1 text-left cursor-pointer"
      >
        {Icon && <Icon size={18} className="text-gray-600 shrink-0" />}
        <span className={`flex-1 ${selected ? "text-gray-800" : "text-gray-500"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className={`absolute left-0 right-0 z-50 rounded-xl bg-white border border-[#d6d1ee] shadow-lg py-1 max-h-52 overflow-y-auto ${
          dropUp ? "bottom-full mb-1" : "top-full mt-1"
        }`}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(76,65,114,0.25) transparent",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150
                ${opt.value === value
                  ? "bg-[#9d8adb] text-white font-medium"
                  : "text-[#4c4172] hover:bg-[#9d8adb55] hover:text-white"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
