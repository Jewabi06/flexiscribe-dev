"use client";

import {
  ChevronDown,
  Upload,
} from "lucide-react";

export default function UsersFilterBar({
  role,
  status,
  date,
  onRoleChange,
  onStatusChange,
  onDateChange,
  onExport,
}) {
  const pill =
    "flex items-center gap-2 px-4 py-2 rounded-full border border-[#d6d1ee] bg-white text-sm text-[#4c4172] hover:bg-[#f1effa] transition cursor-pointer";
  const active =
    "bg-[#f1effa] border-[#9d8adb]";
  const select =
    "bg-transparent outline-none appearance-none cursor-pointer w-full";

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

      {/* LEFT - FILTERS */}
      <div className="flex flex-wrap items-center gap-3">

        {/* ROLE */}
        <label
          className={`${pill} ${role !== "All" ? active : ""}`}
        >
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className={select}
          >
            <option value="All">All Roles</option>
            <option value="Student">Student</option>
            <option value="Educator">Educator</option>
            <option value="Admin">Admin</option>
          </select>
          <ChevronDown size={14} className="shrink-0" />
        </label>

        {/* STATUS */}
        <label
          className={`${pill} ${status !== "All" ? active : ""}`}
        >
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={select}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Banned">Banned</option>
          </select>
          <ChevronDown size={14} className="shrink-0" />
        </label>

        {/* DATE */}
        <label
          className={`${pill} ${date !== "All" ? active : ""}`}
        >
          <select
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className={select}
          >
            <option value="All">Joined date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
          </select>
          <ChevronDown size={14} className="shrink-0" />
        </label>

        {/* EXPORT */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#9d8adb] text-white text-sm hover:bg-[#8b78d1] transition"
        >
          <Upload size={14} />
          Export Users
        </button>
      </div>
    </div>
  );
}
