"use client";

import { useState, useEffect, useCallback } from "react";
import { KeyRound, Check, X, Clock, ChevronDown, Search, RefreshCw } from "lucide-react";

export default function PasswordRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const [expandedId, setExpandedId] = useState(null);

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
        setExpandedId(null);
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
      r.userEmail?.toLowerCase().includes(q)
    );
  });

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-700",
  };

  const typeLabels = {
    change: "Password Change",
    reset: "Password Reset",
  };

  return (
    <div className="p-3 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9d8adb] to-[#4c4172] flex items-center justify-center">
            <KeyRound size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2d2555]">Password Requests</h1>
            <p className="text-sm text-gray-500">Review and manage password change & reset requests</p>
          </div>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-[rgba(157,138,219,0.3)] text-[#4c4172] hover:bg-[rgba(157,138,219,0.1)] transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[#9d8adb] border-2 border-[rgba(157,138,219,0.3)] outline-none focus:border-[#9d8adb] transition-colors text-sm"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-10 rounded-xl text-[#9d8adb] border-2 border-[rgba(157,138,219,0.3)] outline-none focus:border-[#9d8adb] transition-colors text-sm cursor-pointer"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="">All</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <KeyRound size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No {statusFilter || ""} requests found</p>
          <p className="text-sm">Password change and reset requests will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[rgba(157,138,219,0.2)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-[#f5f0ff] to-[#ece6ff] text-[#4c4172]">
                <th className="text-left px-5 py-3 font-semibold">User</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Reason</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                <th className="text-left px-5 py-3 font-semibold">Date</th>
                <th className="text-center px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id} className="border-t border-[rgba(157,138,219,0.1)] hover:bg-[rgba(157,138,219,0.04)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[#2d2555]">{req.userName || "Unknown"}</div>
                    <div className="text-xs text-gray-400">{req.userEmail}</div>
                    <div className="text-xs text-gray-400 capitalize">{req.userRole?.toLowerCase()}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[rgba(157,138,219,0.15)] text-[#4c4172]">
                      {typeLabels[req.type] || req.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-[200px]">
                    <span className="text-gray-600 line-clamp-2">{req.reason || "—"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[req.status]}`}>
                      {req.status === "pending" && <Clock size={12} />}
                      {req.status === "approved" && <Check size={12} />}
                      {req.status === "denied" && <X size={12} />}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    <div className="text-xs text-gray-400">
                      {new Date(req.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {req.status === "pending" ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(req.id, "approve")}
                            disabled={actionLoading === req.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                          >
                            <Check size={13} />
                            Approve
                          </button>
                          <button
                            onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                          >
                            <X size={13} />
                            Deny
                          </button>
                        </div>
                        {expandedId === req.id && (
                          <div className="w-full space-y-2">
                            <input
                              type="text"
                              placeholder="Reason for denial (optional)"
                              value={adminNotes[req.id] || ""}
                              onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                              className="w-full px-3 py-1.5 text-xs text-gray-800 rounded-lg border border-gray-200 outline-none focus:border-red-300"
                            />
                            <button
                              onClick={() => handleAction(req.id, "deny")}
                              disabled={actionLoading === req.id}
                              className="w-full px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === req.id ? "Processing..." : "Confirm Deny"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-xs text-gray-500">
                        {req.resolvedAt && (
                          <span>
                            {new Date(req.resolvedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {req.adminNote && (
                          <div className="mt-1 text-gray-700 italic">"{req.adminNote}"</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
