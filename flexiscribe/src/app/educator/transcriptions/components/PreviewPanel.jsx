"use client";

import { useRef, useState } from "react";

export default function PreviewPanel({ transcript }) {
  const pdfRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState("summary"); // "summary" | "transcript"

  const download = async () => {
    if (!pdfRef.current || !transcript) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf()
      .set({
        margin: 12,
        filename: `${transcript.title}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4" },
      })
      .from(pdfRef.current)
      .save();
  };

  // Parse JSON data from the transcript record
  const summaryData = transcript?.summaryJson || null;
  const transcriptData = transcript?.transcriptJson || null;

  // Extract Cornell note fields from summaryJson
  const cornellTitle = summaryData?.title || transcript?.title || "Untitled";
  const cueQuestions = summaryData?.cue_questions || transcript?.cue || [];
  const notes = summaryData?.notes || [];
  const summaryText = summaryData?.summary || transcript?.summary || "";

  // Extract transcript chunks with timestamps
  const chunks = transcriptData?.chunks || [];

  // Determine if we have JSON-format data
  const hasJsonData = !!(summaryData || transcriptData);

  return (
    <div className="h-full rounded-[20px] sm:rounded-[28px] lg:rounded-[42px] bg-gradient-to-br from-[#9d8adb] to-[#7d6ac4] p-4 sm:p-6 flex flex-col transition-all duration-300">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-sm font-semibold">Transcribed Preview</h2>
          {transcript && hasJsonData && (
            <div className="flex bg-white/10 rounded-full p-0.5">
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                  activeTab === "summary"
                    ? "bg-white/25 text-white font-semibold"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab("transcript")}
                className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                  activeTab === "transcript"
                    ? "bg-white/25 text-white font-semibold"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                Transcript
              </button>
            </div>
          )}
        </div>
        {transcript && (
          <div className="flex items-center gap-2">
            {transcript.status === "PENDING" && (
              <span className="text-xs text-yellow-300 bg-yellow-500/20 px-3 py-1 rounded-full">
                Pending
              </span>
            )}
            <button
              onClick={download}
               className="self-start sm:self-auto text-white text-xs bg-white/20 px-4 py-1.5 rounded-full hover:bg-white/30 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* FRAME */}
       <div className="relative flex-1 rounded-[16px] sm:rounded-[24px] lg:rounded-[30px] bg-[#2f2b47] p-3 sm:p-6 overflow-hidden">
        {!transcript && (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/70 text-sm">Select a transcript to preview</p>
          </div>
        )}

        {transcript && (
          <>
            <div className="h-full overflow-auto flex justify-center">
              <div
                className="origin-top transition-transform duration-300 w-full sm:w-auto"
                style={{ transform: `scale(${zoom})` }}
              >
                <div
                  ref={pdfRef}
                  className="bg-white w-full sm:w-[560px] min-h-[380px] sm:min-h-[560px] lg:min-h-[792px] border border-black shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
                >
                  {/* ═══════ SUMMARY VIEW (Cornell Notes) ═══════ */}
                  {activeTab === "summary" && (
                    <>
                      {/* TOP BAR */}
                      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] bg-[#9d8adb] text-white font-semibold border-b border-black text-xs">
                        <div className="px-3 py-2 text-center sm:border-r border-black">
                          {transcript.date}
                        </div>
                        <div className="px-3 py-2 text-center">
                          {cornellTitle}
                        </div>
                      </div>

                      {/* CONTENT – Cornell Note Layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] min-h-[300px]">
                        {/* CUE QUESTIONS */}
                        <div className="p-4 sm:p-5 sm:border-r border-black">
                          <p className="text-xs font-semibold uppercase mb-3 text-[#6b5fcf]">
                            Cue / Questions
                          </p>
                          <ul className="list-disc list-inside space-y-2 text-[#6b5fcf] text-xs">
                            {cueQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>

                        {/* NOTES */}
                        <div className="p-4 sm:p-5 text-[#6b5fcf] leading-relaxed text-xs">
                          <p className="font-semibold uppercase mb-3">Notes</p>
                          {Array.isArray(notes) ? (
                            <ul className="space-y-2">
                              {notes.map((note, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-[#9d8adb] mt-0.5">•</span>
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>{notes}</p>
                          )}
                        </div>
                      </div>

                      {/* SUMMARY */}
                      <div className="border-t border-black p-4 sm:p-6 text-center text-xs">
                        <p className="font-semibold uppercase mb-2 text-[#6b5fcf]">Summary</p>
                        <p className="text-[#6b5fcf]">{summaryText}</p>
                      </div>
                    </>
                  )}

                  {/* ═══════ TRANSCRIPT VIEW (Timestamped) ═══════ */}
                  {activeTab === "transcript" && (
                    <>
                      {/* TOP BAR */}
                      <div className="bg-[#9d8adb] text-white font-semibold border-b border-black text-[10px] sm:text-xs px-3 sm:px-4 py-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                        <span className="shrink-0">{transcript.date}</span>
                        <span className="truncate min-w-0 flex-1 text-center px-1">{transcript.title}</span>
                        <span className="shrink-0">{transcript.duration}</span>
                      </div>

                      {/* TRANSCRIPT CHUNKS */}
                      <div className="p-4 sm:p-6">
                        <p className="text-xs font-semibold uppercase mb-4 text-[#6b5fcf]">
                          Transcript ({chunks.length} segments)
                        </p>

                        {chunks.length > 0 ? (
                          <div className="space-y-3">
                            {chunks.map((chunk, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <span className="text-[10px] font-mono text-white bg-[#9d8adb] px-2 py-0.5 rounded shrink-0 mt-0.5">
                                  {chunk.timestamp || `MIN ${chunk.minute}`}
                                </span>
                                <p className="text-xs text-[#333] leading-relaxed flex-1">
                                  {chunk.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            className="text-xs text-[#6b5fcf] leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: transcript.content || "<p>No transcript data available.</p>",
                            }}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ZOOM */}
            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-[#3a355c] text-white px-4 py-2 rounded-full text-xs">
              <button onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}>+</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
