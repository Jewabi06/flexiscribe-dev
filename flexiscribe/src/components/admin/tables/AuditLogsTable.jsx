"use client";

import { useState, useMemo, useEffect } from "react";

/* ================= HELPERS ================= */

function formatDateTime(value) {
  const d = new Date(value);
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString(),
  };
}

const ROLE_STYLES = {
  ADMIN: "bg-purple-100 text-purple-700",
  EDUCATOR: "bg-blue-100 text-blue-700",
  STUDENT: "bg-green-100 text-green-700",
};

/* ================= UI PARTS ================= */

function RoleBadge({ role }) {
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-medium inline-block ${
        ROLE_STYLES[role] || "bg-gray-100 text-gray-700"
      }`}
    >
      {role}
    </span>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span className="ml-1 text-xs">{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
  );
}

function MobileLogCard({ log }) {
  const { date, time } = formatDateTime(log.createdAt);

  return (
    <div className="border rounded-xl p-4 bg-white space-y-3 shadow-sm">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">{date} • {time}</span>
        <RoleBadge role={log.userRole} />
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-gray-900">{log.userName}</p>

        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Action</p>
          <p className="text-sm text-gray-800 break-words">{log.action}</p>
        </div>

        {log.details && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Details</p>
            <p className="text-sm text-gray-800 break-words">{log.details}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= MAIN ================= */

export default function AuditLogsTable() {
  const [date, setDate] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.auditLogs || []);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  /* FILTER */
  const filteredLogs = useMemo(() => {
    if (!date) return auditLogs;
    return auditLogs.filter((log) =>
      new Date(log.createdAt).toISOString().startsWith(date)
    );
  }, [date, auditLogs]);

  /* SORT */
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let A = a[sortKey];
      let B = b[sortKey];

      if (sortKey === "createdAt") {
        A = new Date(A);
        B = new Date(B);
      }

      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg">
      {/* HEADER - Always flex row on all screens */}
      <div className="flex flex-row items-start justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#4c4172]">Activity Logs</h2>
          <p className="text-xs sm:text-sm text-gray-500">Track system activities</p>
        </div>
        
        {/* Date filter - Always visible on the right */}
        <div className="flex-shrink-0">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[140px] sm:w-auto border px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm text-gray-700"
            placeholder="mm/dd/yyyy"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 sm:py-10 text-[#9d8adb]">Loading audit logs...</div>
      ) : sortedLogs.length === 0 ? (
        <div className="text-center py-8 sm:py-10 text-[#9d8adb]">No audit logs found</div>
      ) : (
        <>
          {/* MOBILE VIEW - Cards */}
          <div className="block sm:hidden space-y-3">
            {sortedLogs.map((log) => (
              <MobileLogCard key={log.id} log={log} />
            ))}
          </div>

          {/* TABLET/DESKTOP VIEW - Table with horizontal scroll */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f4f1fb]">
                  <th className="p-3 text-center w-[50px] text-[#4c4172]">#</th>

                  <th
                    onClick={() => handleSort("createdAt")}
                    className="p-3 text-center cursor-pointer text-[#4c4172] whitespace-nowrap"
                  >
                    Date
                    <SortIcon active={sortKey === "createdAt"} dir={sortDir} />
                  </th>

                  <th className="p-3 text-center text-[#4c4172] whitespace-nowrap">Time</th>

                  <th
                    onClick={() => handleSort("userName")}
                    className="p-3 text-center cursor-pointer text-[#4c4172] whitespace-nowrap"
                  >
                    Name
                    <SortIcon active={sortKey === "userName"} dir={sortDir} />
                  </th>

                  <th className="p-3 text-center text-[#4c4172] whitespace-nowrap">Role</th>

                  <th className="p-3 text-center text-[#4c4172] whitespace-nowrap">Action</th>
                </tr>
              </thead>

              <tbody>
                {sortedLogs.map((log, i) => {
                  const { date, time } = formatDateTime(log.createdAt);

                  return (
                    <tr
                      key={log.id}
                      className="border-b transition hover:bg-[#f7f5ff]"
                    >
                      <td className="p-3 text-center text-gray-500">{i + 1}</td>

                      <td className="p-3 text-center text-gray-800 whitespace-nowrap">{date}</td>

                      <td className="p-3 text-center text-gray-800 whitespace-nowrap">{time}</td>

                      <td className="p-3 text-center font-medium text-gray-900 whitespace-nowrap">
                        {log.userName}
                      </td>

                      <td className="p-3 text-center">
                        <RoleBadge role={log.userRole} />
                      </td>

                      <td className="p-3 text-center text-gray-800 max-w-[200px] truncate">
                        {log.details || log.action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Mobile results count */}
          <div className="block sm:hidden mt-4 text-xs text-gray-500 text-center">
            Showing {sortedLogs.length} {sortedLogs.length === 1 ? 'log' : 'logs'}
          </div>
        </>
      )}
    </div>
  );
}