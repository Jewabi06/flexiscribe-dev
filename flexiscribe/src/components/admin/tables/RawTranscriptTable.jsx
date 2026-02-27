"use client";

import { useState, useEffect } from "react";
import TranscriptPreviewModal from "@/components/admin/modals/TranscriptPreviewModal";
import MessageModal from "@/components/shared/MessageModal";

export default function RawTranscriptTable() {
  const [transcripts, setTranscripts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [course, setCourse] = useState("ALL");
  const [section, setSection] = useState("ALL");
  const [activeTranscript, setActiveTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const fetchTranscripts = async () => {
    try {
      const res = await fetch("/api/admin/transcripts");
      if (res.ok) {
        const data = await res.json();
        setTranscripts(data.transcripts || []);
        setCourses(data.courses || []);
        setSections(data.sections || []);
      }
    } catch (error) {
      console.error("Error fetching transcripts:", error);
    } finally {
      setLoading(false);
    }
  };

  const normalize = (v) => v?.toString().trim().toUpperCase();

  const filteredTranscripts = transcripts.filter((t) => {
    const courseMatch =
      course === "ALL" || normalize(t.course) === normalize(course);
    const sectionMatch =
      section === "ALL" || normalize(t.section) === normalize(section);
    return courseMatch && sectionMatch;
  });

  const handleDeleteClick = (t) => {
    setDeleteTarget(t);
    setModalInfo({
      isOpen: true,
      title: "Delete Transcript",
      message: `Are you sure you want to delete "${t.title}"? This action cannot be undone.`,
      type: "error",
    });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/transcripts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTranscripts((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
        setModalInfo({
          isOpen: true,
          title: "Deleted",
          message: "Transcript deleted successfully.",
          type: "success",
        });
      } else {
        const data = await res.json();
        setDeleteTarget(null);
        setModalInfo({
          isOpen: true,
          title: "Error",
          message: data.error || "Failed to delete transcript.",
          type: "error",
        });
      }
    } catch {
      setDeleteTarget(null);
      setModalInfo({
        isOpen: true,
        title: "Error",
        message: "An error occurred while deleting the transcript.",
        type: "error",
      });
    }
  };

  const wordCount = (text) => {
    if (!text) return "0 words";
    const count = text.split(/\s+/).filter(Boolean).length;
    return `${count.toLocaleString()} words`;
  };

  return (
    <>
      <div className="rounded-2xl overflow-hidden shadow-sm border border-[#d5cfec] bg-white">

        {/* ================= HEADER ================= */}
        <div className="bg-gradient-to-br from-[#9d8adb] to-[#4c4172] px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
                Raw Transcripts
              </h3>
              <p className="text-xs text-white/80 mt-1">
                {loading ? "Loading..." : `${filteredTranscripts.length} transcript(s)`}
              </p>
            </div>

            <div className="flex gap-2">
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-md bg-white text-[#3f3764] border"
              >
                <option value="ALL">All Courses</option>
                {courses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-md bg-white text-[#3f3764] border"
              >
                <option value="ALL">All Sections</option>
                {sections.map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ================= MOBILE VIEW ================= */}
        <div className="block sm:hidden divide-y">
          {loading ? (
            <div className="p-10 text-center text-[#6b6396]">Loading transcripts...</div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="p-10 text-center text-[#6b6396]">No transcripts available</div>
          ) : (
            filteredTranscripts.map((t) => (
              <div key={t.id} className="p-4 space-y-2">
                <div className="text-xs font-medium text-[#6b6396]">
                  {t.course} • Section {t.section}
                </div>

                <div className="font-medium text-[#3f3764]">
                  {t.title}
                </div>

                <div className="text-xs text-[#6b6396]">
                  {t.date} • {t.duration} • {wordCount(t.content)}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setActiveTranscript(t)}
                    className="
                      px-3 py-2
                      text-xs
                      rounded-md
                      font-medium
                      bg-[#9d8adb]
                      text-white
                      hover:bg-[#4c4172]
                    "
                  >
                    View
                  </button>

                  <button
                    onClick={() => handleDeleteClick(t)}
                    className="
                      px-3 py-2
                      text-xs
                      rounded-md
                      bg-red-500
                      text-white
                      hover:bg-red-600
                    "
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ================= DESKTOP TABLE ================= */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-[#3f3764]">
            <thead className="bg-[#f3f1fa] border-b border-[#e3def4]">
              <tr>
                <th className="px-5 py-3 text-center font-semibold">Course</th>
                <th className="text-center font-semibold">Title</th>
                <th className="text-center font-semibold">Date</th>
                <th className="text-center font-semibold">Duration</th>
                <th className="text-center font-semibold">Length</th>
                <th className="text-center font-semibold">Section</th>
                <th className="text-center font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#6b6396]">
                    Loading transcripts...
                  </td>
                </tr>
              ) : filteredTranscripts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-[#6b6396]">
                    No transcripts available
                  </td>
                </tr>
              ) : (
                filteredTranscripts.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`
                      border-b border-[#eeeaf8]
                      ${i % 2 === 0 ? "bg-white" : "bg-[#faf9fd]"}
                      hover:bg-[#f1effa]
                    `}
                  >
                    <td className="px-5 py-3 font-medium">{t.course}</td>
                    <td className="px-5 max-w-[180px] truncate">{t.title}</td>
                    <td className="text-[#6b6396]">{t.date}</td>
                    <td className="text-[#6b6396]">{t.duration}</td>
                    <td className="text-[#6b6396]">{wordCount(t.content)}</td>
                    <td className="text-center text-[#6b6396]">{t.section}</td>

                    <td className="pr-5 text-right">
                      <button
                        onClick={() => setActiveTranscript(t)}
                        className="
                          px-3 py-1.5
                          text-xs
                          rounded-md
                          border border-[#d5cfec]
                          text-[#3f3764]
                          hover:bg-[#edeaf7]
                          mr-2
                        "
                      >
                        View
                      </button>

                      <button
                        onClick={() => handleDeleteClick(t)}
                        className="
                          px-3 py-1.5
                          text-xs
                          rounded-md
                          bg-red-500
                          text-white
                          hover:bg-red-600
                        "
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= PREVIEW MODAL ================= */}
      {activeTranscript && (
        <TranscriptPreviewModal
          transcript={activeTranscript}
          onClose={() => setActiveTranscript(null)}
        />
      )}

      {/* ================= MESSAGE MODAL ================= */}
      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => {
          setModalInfo({ ...modalInfo, isOpen: false });
          if (deleteTarget) setDeleteTarget(null);
        }}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
        onConfirm={deleteTarget ? executeDelete : undefined}
      />
    </>
  );
}
