"use client";

import { useState } from "react";
import ClassesTable from "@/components/admin/modals/ClassesTable";
import AddClassModal from "@/components/admin/modals/AddClassModal";

export default function ManageClassesPage() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="p-3 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-[#4c4172]">Manage Classes</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-5 py-2.5 bg-[#9d8adb] text-white rounded-full font-semibold hover:opacity-90 transition"
        >
          + Add Class
        </button>
      </div>

      <ClassesTable />

      {addOpen && (
        <AddClassModal
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
