"use client";

import { useState } from "react";
import UsersFilterBar from "@/components/admin/modals/UsersFilterBar";
import UsersTable from "@/components/admin/modals/UsersTable";

export default function ManageAccountsPage() {
  const [role, setRole] = useState("All");
  const [status, setStatus] = useState("All");
  const [date, setDate] = useState("All");

  const handleExport = async () => {
    try {
      const res = await fetch("/api/admin/users/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting users:", error);
    }
  };

  return (
    <div className="p-3 space-y-5">
      <UsersFilterBar
        role={role}
        status={status}
        date={date}
        onRoleChange={setRole}
        onStatusChange={setStatus}
        onDateChange={setDate}
        onExport={handleExport}
      />

      <UsersTable
        roleFilter={role}
        statusFilter={status}
        dateFilter={date}
      />
    </div>
  );
}
