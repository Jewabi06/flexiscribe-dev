"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, Copy, Check } from "lucide-react";
import EditClassModal from "./EditClassModal";
import MessageModal from "@/components/shared/MessageModal";

const GRID =
  "grid-cols-[2fr_1fr_1fr_1fr_1fr_1.2fr_1fr] ";

export default function ClassesTable() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editClass, setEditClass] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/classes");
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (classId, subject) => {
    setDeleteTarget({ classId, subject });
    setModalInfo({ isOpen: true, title: "Confirm Delete", message: `Are you sure you want to delete ${subject}?`, type: "error" });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setModalInfo({ ...modalInfo, isOpen: false });
    try {
      const res = await fetch(`/api/admin/classes/${deleteTarget.classId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        setModalInfo({ isOpen: true, title: "Success", message: "Class deleted successfully.", type: "success" });
        fetchClasses();
      } else {
        const error = await res.json();
        setDeleteTarget(null);
        setModalInfo({ isOpen: true, title: "Error", message: error.error || "Failed to delete class.", type: "error" });
      }
    } catch {
      setDeleteTarget(null);
      setModalInfo({ isOpen: true, title: "Error", message: "An error occurred while deleting.", type: "error" });
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-[0_24px_60px_rgba(76,65,114,0.18)] p-10 text-center">
        <p className="text-[#9d8adb]">Loading classes...</p>
      </div>
    );
  }

  return (
    <>
      {/* ================= DESKTOP TABLE ================= */}
      <div className="hidden sm:block bg-white rounded-3xl shadow-[0_24px_60px_rgba(76,65,114,0.18)] overflow-hidden">
        {/* HEADER */}
        <div
          className={`grid ${GRID} bg-[#9d8adb] px-5 py-4 text-white text-sm font-semibold items-center`}
        >
          <span>Subject</span>
          <span>Section</span>
          <span>Day</span>
          <span>Time</span>
          <span>Room</span>
          <span>Educator</span>
          <span className="text-center">Actions</span>
        </div>

        {/* ROWS */}
        <div className="divide-y divide-[#eeeaf8]">
          {classes.length === 0 ? (
            <div className="px-5 py-10 text-center text-[#9d8adb]">
              No classes found. Click "+ Add Class" to create one.
            </div>
          ) : (
            classes.map((c) => (
              <div
                key={c.id}
                className={`grid ${GRID} px-5 py-4 items-center hover:bg-[#f7f5fc] transition`}
              >
                {/* SUBJECT */}
                <div>
                  <p className="font-semibold text-[#4c4172]">{c.subject}</p>
                  <button
                    onClick={() => handleCopyCode(c.classCode)}
                    className="flex items-center gap-1 text-xs text-[#9d8adb] hover:text-[#7b6fae] mt-0.5"
                  >
                    {copiedId === c.classCode ? (
                      <>
                        <Check size={12} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Code: {c.classCode}
                      </>
                    )}
                  </button>
                </div>

                {/* SECTION */}
                <div className="text-[#6f63a6]">{c.section}</div>

                {/* DAY */}
                <div className="text-[#6f63a6]">{c.day}</div>

                {/* TIME */}
                <div className="text-[#6f63a6]">{c.startTime}</div>

                {/* ROOM */}
                <div className="text-[#6f63a6]">{c.room}</div>

                {/* EDUCATOR */}
                <div>
                  <p className="font-medium text-[#4c4172]">{c.educatorName}</p>
                  <p className="text-xs text-[#9d8adb]">{c.department}</p>
                </div>

                {/* ACTIONS */}
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setEditClass(c)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[#6f63a6] hover:bg-[#ede9fe]"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.subject)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 hover:bg-[#fdecec]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ================= MOBILE CARDS ================= */}
      <div className="sm:hidden space-y-4">
        {classes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-[#9d8adb]">
            No classes found
          </div>
        ) : (
          classes.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-[#4c4172]">{c.subject}</p>
                  <p className="text-sm text-[#7b6fae]">Section {c.section}</p>
                </div>
                <button
                  onClick={() => handleCopyCode(c.classCode)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-[#f5f3ff] text-[#9d8adb] border border-[#e6e2fb]"
                >
                  {copiedId === c.classCode ? (
                    <><Check size={12} /> Copied!</>
                  ) : (
                    <><Copy size={12} /> {c.classCode}</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Day</p>
                  <p className="font-medium text-[#4c4172]">{c.day}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Time</p>
                  <p className="font-medium text-[#4c4172]">{c.startTime}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Room</p>
                  <p className="font-medium text-[#4c4172]">{c.room}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Educator</p>
                  <p className="font-medium text-[#4c4172]">{c.educatorName}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => setEditClass(c)}
                  className="px-4 py-2 text-sm rounded-full border text-[#6f63a6]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c.id, c.subject)}
                  className="px-4 py-2 text-sm rounded-full bg-red-100 text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* EDIT MODAL */}
      {editClass && (
        <EditClassModal
          classData={editClass}
          onClose={() => {
            setEditClass(null);
            fetchClasses();
          }}
        />
      )}

      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => {
          setModalInfo({ ...modalInfo, isOpen: false });
          setDeleteTarget(null);
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
        onConfirm={deleteTarget ? executeDelete : undefined}
      />
    </>
  );
}
