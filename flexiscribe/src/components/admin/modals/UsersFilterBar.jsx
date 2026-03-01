"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Upload } from "lucide-react";

function Dropdown({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayLabel = options.find((o) => o.value === value)?.label || label;
  const isActive = value !== options[0]?.value;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition cursor-pointer
          ${isActive
            ? "bg-[#f1effa] border-[#9d8adb] text-[#4c4172]"
            : "bg-white border-[#d6d1ee] text-[#4c4172] hover:bg-[#f1effa]"
          }`}
        aria-label={label}
      >
        {displayLabel}
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl bg-white border border-[#d6d1ee] shadow-lg py-1 overflow-hidden">
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

export default function UsersFilterBar({
  role,
  status,
  date,
  onRoleChange,
  onStatusChange,
  onDateChange,
  onExport,
}) {
  const roleOptions = [
    { value: "All", label: "All Roles" },
    { value: "Student", label: "Student" },
    { value: "Educator", label: "Educator" },
    { value: "Admin", label: "Admin" },
  ];

  const statusOptions = [
    { value: "All", label: "All Status" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Banned", label: "Banned" },
  ];

  const dateOptions = [
    { value: "All", label: "Joined date" },
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 3 months" },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* LEFT - FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        <Dropdown value={role} options={roleOptions} onChange={onRoleChange} label="All Roles" />
        <Dropdown value={status} options={statusOptions} onChange={onStatusChange} label="All Status" />
        <Dropdown value={date} options={dateOptions} onChange={onDateChange} label="Joined date" />
      </div>

      {/* RIGHT - EXPORT BUTTON */}
      <div className="flex items-center">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#9d8adb] text-white text-sm font-medium hover:bg-[#8b78d1] transition shadow-sm hover:shadow"
        >
          <Upload size={14} />
          Export Users
        </button>
      </div>
    </div>
  );
}