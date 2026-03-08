"use client";

import { useState } from "react";
import ClassesTable from "@/components/admin/modals/ClassesTable";
import AddClassModal from "@/components/admin/modals/AddClassModal";

export default function ManageClassesPage() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-end items-center">
        <button
          onClick={() => setAddOpen(true)}
          className="px-6 py-2.5 bg-[#9d8adb] text-white rounded-full font-semibold hover:opacity-90 transition flex items-center gap-2 shadow-md hover:shadow-lg min-w-[140px] justify-center"
        >
          <span className="text-lg">+</span>
          <span>Add Class</span>
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
