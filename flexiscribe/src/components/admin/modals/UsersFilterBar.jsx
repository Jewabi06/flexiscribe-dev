"use client";

import { ChevronDown, Upload } from "lucide-react";

export default function UsersFilterBar({
  role,
  status,
  date,
  onRoleChange,
  onStatusChange,
  onDateChange,
  onExport,
}) {

  const pill = "flex items-center gap-2 px-4 py-2 rounded-full border border-[#d6d1ee] bg-white text-sm text-[#4c4172] hover:bg-[#f1effa] transition cursor-pointer";
  const active = "bg-[#f1effa] border-[#9d8adb]";

  const getDateDisplay = (dateValue) => {
    if (dateValue === "All") return "Joined date";
    if (dateValue === "7") return "Last 7 days";
    if (dateValue === "30") return "Last 30 days";
    if (dateValue === "90") return "Last 3 months";
    return "Joined date";
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* LEFT - FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        {/* ROLE FILTER */}
        <div className="relative">
          <div
            className={`${pill} ${role !== "All" ? active : ""}`}
          >
            <span className="flex items-center gap-2">
              {role === "All" ? "All Roles" : role}
              <ChevronDown size={14} className="shrink-0" />
            </span>
          </div>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full text-[#4c4172] cursor-pointer"
            aria-label="Select role"
          >
            <option value="All">All Roles</option>
            <option value="Student">Student</option>
            <option value="Educator">Educator</option>
            <option value="Admin">Admin</option>
          </select>
          
        </div>

        {/* STATUS FILTER */}
        <div className="relative">
          <div
            className={`${pill} ${status !== "All" ? active : ""}`}
          >
            <span className="flex items-center gap-2">
              {status === "All" ? "All Status" : status}
              <ChevronDown size={14} className="shrink-0" />
            </span>
          </div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full text-[#4c4172] cursor-pointer"
            aria-label="Select status"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Banned">Banned</option>
          </select>
        </div>

        {/* DATE FILTER */}
        <div className="relative">
          <div
            className={`${pill} ${date !== "All" ? active : ""}`}
          >
            <span className="flex items-center gap-2">
              {getDateDisplay(date)}
              <ChevronDown size={14} className="shrink-0" />
            </span>
          </div>
          <select
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full rounded-full ring-2 text-[#4c4172] cursor-pointer"
            aria-label="Select date range"
          >
            <option value="All">Joined date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
          </select>
        </div>
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