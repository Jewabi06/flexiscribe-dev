"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { KeyRound, Check, X, Clock, ChevronDown, Search, User, Mail, Shield } from "lucide-react";

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

function RequestCard({ req, adminNotes, setAdminNotes, actionLoading, handleAction }) {
  const statusConfig = {
    pending: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: Clock, label: "Pending Review" },
    approved: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: Check, label: "Approved" },
    denied: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", icon: X, label: "Denied" },
  };

  const status = statusConfig[req.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const roleColors = {
    STUDENT: "bg-blue-100 text-blue-700",
    EDUCATOR: "bg-purple-100 text-purple-700",
    ADMIN: "bg-red-100 text-red-700",
  };

  return (
    <div className={`rounded-2xl border ${req.status === "pending" ? "border-amber-200 bg-white" : "border-[#eeeaf8] bg-white/80"} p-4 sm:p-5 transition hover:shadow-md`}>
      {/* Top row: User info + Status + Date */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9d8adb] to-[#4c4172] flex items-center justify-center shrink-0">
            <User size={18} className="text-white" />
          </div>
          {/* Name / Email / Role */}
          <div className="min-w-0">
            <div className="font-semibold text-[#2d2555] truncate">{req.userName || "Unknown User"}</div>
            <div className="flex items-center gap-1.5 text-sm text-[#7b6fae]">
              <Mail size={12} className="shrink-0" />
              <span className="truncate">{req.userEmail}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${roleColors[req.userRole] || "bg-gray-100 text-gray-600"}`}>
                <Shield size={10} />
                {req.userRole?.charAt(0) + req.userRole?.slice(1).toLowerCase()}
              </span>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[rgba(157,138,219,0.12)] text-[#4c4172]">
                {req.type === "reset" ? "Password Reset" : "Password Change"}
              </span>
            </div>
          </div>
        </div>

        {/* Status + Date */}
        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} ${status.border} border`}>
            <StatusIcon size={12} />
            {status.label}
          </span>
          <div className="text-xs text-gray-400 text-right">
            <div>
              {new Date(req.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div>
              {new Date(req.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Reason */}
      {req.reason && (
        <div className="mb-3 rounded-xl bg-[#f8f7fc] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-[#9d8adb] uppercase tracking-wider mb-1">Reason</div>
          <p className="text-sm text-[#4c4172] leading-relaxed">{req.reason}</p>
        </div>
      )}

      {/* Admin note (existing for resolved, input for pending) */}
      {req.status === "pending" ? (
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[#9d8adb] uppercase tracking-wider mb-1.5 block">
            Admin Note (optional)
          </label>
          <input
            type="text"
            placeholder="Add a note before approving or denying..."
            value={adminNotes[req.id] || ""}
            onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
            className="w-full text-sm px-3 py-2 rounded-xl border border-[#d6d1ee] focus:border-[#9d8adb] outline-none bg-white placeholder:text-gray-300 transition-colors"
          />
        </div>
      ) : req.adminNote ? (
        <div className="mb-3 rounded-xl bg-[#f8f7fc] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-[#9d8adb] uppercase tracking-wider mb-1">Admin Note</div>
          <p className="text-sm text-[#4c4172] italic leading-relaxed">{req.adminNote}</p>
        </div>
      ) : null}

      {/* Actions / Resolution info */}
      {req.status === "pending" ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleAction(req.id, "approve")}
            disabled={actionLoading === req.id}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Check size={14} />
            Approve
          </button>
          <button
            onClick={() => handleAction(req.id, "deny")}
            disabled={actionLoading === req.id}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <X size={14} />
            Deny
          </button>
          {actionLoading === req.id && (
            <span className="text-xs text-gray-400 ml-2">Processing...</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-1 text-xs text-gray-400">
          {req.resolvedAt && (
            <span>
              Resolved{" "}
              {new Date(req.resolvedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {req.resolvedBy && <span>• by Admin</span>}
        </div>
      )}
    </div>
  );
}

export default function PasswordRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/password-requests?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch password requests:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId, action) => {
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/admin/password-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          adminNote: adminNotes[requestId] || "",
        }),
      });
      if (res.ok) {
        fetchRequests();
        setAdminNotes((prev) => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
      } else {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.userName?.toLowerCase().includes(q) ||
      r.userEmail?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className=" max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full border text-sm bg-white border-[#d6d1ee] text-[#4c4172] focus:border-[#9d8adb] outline-none transition-colors"
          />
        </div>
        <Dropdown
          value={statusFilter}
          onChange={setStatusFilter}
          label="Status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "denied", label: "Denied" },
            { value: "", label: "All Requests" },
          ]}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#9d8adb] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-[#9d8adb]">Loading requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <KeyRound size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-gray-500">
            No {statusFilter || ""} requests found
          </p>
          <p className="text-sm mt-1">Password change and reset requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-gray-400 font-medium px-1">
            Showing {filtered.length} request{filtered.length !== 1 ? "s" : ""}
          </div>
          {filtered.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              adminNotes={adminNotes}
              setAdminNotes={setAdminNotes}
              actionLoading={actionLoading}
              handleAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}