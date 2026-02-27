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
      className={`text-xs px-5 py-1 rounded-full font-medium ${
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
    <div className="border rounded-xl p-4 sm:p-6 bg-white space-y-3 shadow-sm">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{date}</span>
        <span>{time}</span>
      </div>

      <div className="flex justify-between items-center">
        <p className="font-semibold text-gray-900">{log.userName}</p>
        <RoleBadge role={log.userRole} />
      </div>

      <div>
        <p className="text-xs text-gray-500">Action</p>
        <p className="text-sm text-gray-800">{log.action}</p>
      </div>

      {log.details && (
        <div>
          <p className="text-xs text-gray-500">Details</p>
          <p className="text-sm text-gray-800">{log.details}</p>
        </div>
      )}
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
    <div className="bg-white rounded-2xl p-5 shadow-lg">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#4c4172]">Activity Logs</h2>
          <p className="text-sm text-gray-500">Track system activities</p>
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm text-gray-700"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-[#9d8adb]">Loading audit logs...</div>
      ) : sortedLogs.length === 0 ? (
        <div className="text-center py-10 text-[#9d8adb]">No audit logs found</div>
      ) : (
        <>
          {/* MOBILE */}
          <div className="md:hidden space-y-4">
            {sortedLogs.map((log) => (
              <MobileLogCard key={log.id} log={log} />
            ))}
          </div>

          {/* DESKTOP */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f4f1fb]">
                  <th className="p-3 text-center w-[60px] text-[#4c4172]">#</th>

                  <th
                    onClick={() => handleSort("createdAt")}
                    className="p-3 text-center cursor-pointer text-[#4c4172]"
                  >
                    Date
                    <SortIcon active={sortKey === "createdAt"} dir={sortDir} />
                  </th>

                  <th className="text-center text-[#4c4172]">Time</th>

                  <th
                    onClick={() => handleSort("userName")}
                    className="text-center cursor-pointer text-[#4c4172]"
                  >
                    Name
                    <SortIcon active={sortKey === "userName"} dir={sortDir} />
                  </th>

                  <th className="text-center text-[#4c4172]">Role</th>

                  <th className="text-center text-[#4c4172]">Action</th>
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
                      <td className="text-center text-gray-500">{i + 1}</td>

                      <td className="p-4 text-center text-gray-800">{date}</td>

                      <td className="text-center text-gray-800">{time}</td>

                      <td className="text-center font-medium text-gray-900">
                        {log.userName}
                      </td>

                      <td className="text-center">
                        <RoleBadge role={log.userRole} />
                      </td>

                      <td className="text-center text-gray-800 max-w-md truncate">
                        {log.details || log.action}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
