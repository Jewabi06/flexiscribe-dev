"use client";

import { useRef, useState } from "react";

export default function PreviewPanel({ transcript }) {
  const pdfRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState("summary"); // "summary" | "transcript" | "minutes"

  const download = async () => {
    if (!pdfRef.current || !transcript) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf()
      .set({
        margin: [15, 15, 15, 15],
        filename: `${transcript.title}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4" },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(pdfRef.current)
      .save();
  };

  // Parse JSON data from the transcript record
  const summaryData = transcript?.summaryJson || null;
  const transcriptData = transcript?.transcriptJson || null;

  // Detect MOTM vs Cornell format
  const isMOTM = !!(summaryData?.meeting_title || summaryData?.agendas);

  // Extract Cornell note fields from summaryJson
  const cornellTitle = summaryData?.title || transcript?.title || "Untitled";
  const keyConcepts = summaryData?.key_concepts || summaryData?.cue_questions || [];
  const notes = summaryData?.notes || [];
  const summaryArr = Array.isArray(summaryData?.summary) ? summaryData.summary : (summaryData?.summary ? [summaryData.summary] : []);
  const summaryText = summaryArr.join(" ");

  // Extract MOTM fields
  const motmTitle = summaryData?.meeting_title || summaryData?.title || transcript?.title || "Untitled Meeting";
  const motmDate = summaryData?.date || transcript?.date || "Not specified";
  const motmTime = summaryData?.time || "Not specified";
  const motmAgendas = summaryData?.agendas || [];
  const motmNextMeeting = summaryData?.next_meeting || null;
  const motmPreparedBy = summaryData?.prepared_by || "To be determined";

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
              <button
                onClick={() => setActiveTab("minutes")}
                className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                  activeTab === "minutes"
                    ? "bg-white/25 text-white font-semibold"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                Minutes
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
                  className="bg-white w-full sm:w-[560px] min-h-[380px] sm:min-h-[560px] lg:min-h-[792px] border border-black shadow-[0_14px_40px_rgba(0,0,0,0.35)]" style={{ fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}
                >
                  {/* ═══════ SUMMARY VIEW ═══════ */}
                  {activeTab === "summary" && (
                    <>
                      {isMOTM ? (
                        /* ─── MOTM Layout (sequential) ─── */
                        <div className="p-5 sm:p-7" style={{ textAlign: 'justify' }}>
                          {/* TOP: Title, Date, Time on separate lines */}
                          <div className="text-center pb-4 mb-5 border-b-2 border-gray-800">
                            <h1 className="text-base font-bold text-gray-900 mb-2">{motmTitle}</h1>
                            <p className="text-xs text-gray-600 mb-0.5">Date: {motmDate}</p>
                            <p className="text-xs text-gray-600">Time: {motmTime}</p>
                          </div>

                          {/* MIDDLE: Agendas with subcontent */}
                          {motmAgendas.map((agenda, idx) => (
                            <div key={idx} className="mb-5">
                              <h3 className="text-xs font-bold text-gray-900 mb-2">{idx + 1}. {agenda.title || `Agenda ${idx + 1}`}</h3>
                              {agenda.key_points && agenda.key_points.length > 0 && (
                                <>
                                  <p className="text-[10px] font-semibold text-gray-700 mb-1">Key Points:</p>
                                  <ul className="list-disc ml-5 space-y-1 text-xs text-[#333] mb-3">
                                    {agenda.key_points.map((pt, i) => (
                                      <li key={i}>{pt}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              {agenda.important_clarifications && agenda.important_clarifications.length > 0 && (
                                <>
                                  <p className="text-[10px] font-semibold text-gray-700 mb-1">Important Clarifications:</p>
                                  <ul className="list-disc ml-5 space-y-1 text-xs text-[#333]">
                                    {agenda.important_clarifications.map((c, i) => (
                                      <li key={i}>{c}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Next meeting if present */}
                          {motmNextMeeting && (
                            <div className="mt-3 text-xs text-[#333]">
                              <p><strong>Next Meeting:</strong> {typeof motmNextMeeting === 'string' ? motmNextMeeting : JSON.stringify(motmNextMeeting)}</p>
                            </div>
                          )}

                          {/* BOTTOM: Prepared by */}
                          <div className="border-t-2 border-gray-800 mt-6 pt-4">
                            <p className="text-xs text-[#333]"><strong>Prepared by:</strong> {motmPreparedBy}</p>
                          </div>
                        </div>
                      ) : (
                        /* ─── Cornell Notes Layout ─── */
                        <>
                          {/* TOP: Date (left) | Title (right) */}
                          <div className="grid grid-cols-1 sm:grid-cols-[35%_65%] border-b-2 border-gray-800 text-xs">
                            <div className="px-4 py-3 text-left text-gray-600">
                              <strong>Date:</strong> {transcript.date}
                            </div>
                            <div className="px-4 py-3 text-right font-bold text-sm text-[#5b21b6]">
                              {cornellTitle}
                            </div>
                          </div>

                          {/* MIDDLE: Key Concepts (left) | Notes (right) */}
                          <div className="grid grid-cols-1 sm:grid-cols-[35%_65%] min-h-[300px]">
                            {/* Key Concepts */}
                            <div className="p-4 sm:p-5 sm:border-r-2 border-gray-800" style={{ textAlign: 'justify' }}>
                              <p className="text-xs font-semibold uppercase mb-3 text-[#5b21b6] tracking-wide">
                                Key Concepts
                              </p>
                              <ul className="list-disc ml-4 space-y-2 text-xs text-[#333]">
                                {keyConcepts.map((concept, i) => (
                                  <li key={i}>{concept}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Notes */}
                            <div className="p-4 sm:p-5 leading-relaxed" style={{ textAlign: 'justify' }}>
                              <p className="text-xs font-semibold uppercase mb-3 text-[#5b21b6] tracking-wide">Notes</p>
                              {Array.isArray(notes) && notes.length > 0 ? (
                                <div className="space-y-3">
                                  {notes.map((note, i) => (
                                    typeof note === "object" && note !== null ? (
                                      <div key={i} className="mb-3">
                                        {note.term && <p className="text-xs font-bold text-gray-900 mb-0.5">{note.term}</p>}
                                        {note.definition && <p className="text-xs text-[#333] mb-0.5">{note.definition}</p>}
                                        {note.example && <p className="text-[10px] text-gray-500 italic">Example: {note.example}</p>}
                                      </div>
                                    ) : (
                                      <p key={i} className="text-xs text-[#333]">{note}</p>
                                    )
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-[#333]">{notes}</p>
                              )}
                            </div>
                          </div>

                          {/* BOTTOM: Summary */}
                          <div className="border-t-2 border-gray-800 p-4 sm:p-5" style={{ textAlign: 'justify' }}>
                            <p className="text-xs font-semibold uppercase mb-2 text-[#5b21b6] tracking-wide">Summary</p>
                            {summaryArr.length > 0 ? (
                              <ul className="list-disc ml-4 space-y-1 text-xs text-[#333]">
                                {summaryArr.map((pt, i) => (
                                  <li key={i}>{pt}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-[#333]">{summaryText}</p>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* ═══════ TRANSCRIPT VIEW (Timestamped) ═══════ */}
                  {activeTab === "transcript" && (
                    <>
                      {/* TOP BAR */}
                      <div className="border-b-2 border-gray-800 text-[10px] sm:text-xs px-3 sm:px-5 py-3 flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                        <span className="shrink-0 text-gray-600">{transcript.date}</span>
                        <span className="truncate min-w-0 flex-1 text-center px-1 font-bold text-gray-900">{transcript.title}</span>
                        <span className="shrink-0 text-gray-600">{transcript.duration}</span>
                      </div>

                      {/* TRANSCRIPT CHUNKS */}
                      <div className="p-4 sm:p-6" style={{ textAlign: 'justify' }}>
                        <p className="text-xs font-semibold uppercase mb-4 text-[#5b21b6] tracking-wide">
                          Transcript ({chunks.length} segments)
                        </p>

                        {chunks.length > 0 ? (
                          <div className="space-y-3">
                            {chunks.map((chunk, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <span className="text-[10px] font-mono text-white bg-[#7c3aed] px-2 py-0.5 rounded shrink-0 mt-0.5">
                                  {chunk.timestamp || `MIN ${chunk.minute}`}
                                </span>
                                <p className="text-xs text-[#333] leading-relaxed flex-1" style={{ textAlign: 'justify' }}>
                                  {chunk.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            className="text-xs text-[#333] leading-relaxed"
                            style={{ textAlign: 'justify' }}
                            dangerouslySetInnerHTML={{
                              __html: transcript.content || "<p>No transcript data available.</p>",
                            }}
                          />
                        )}
                      </div>
                    </>
                  )}

                  {/* ═══════ MINUTES VIEW ═══════ */}
                  {activeTab === "minutes" && (
                    <>
                      {/* MOTM-style Minutes Layout (sequential) */}
                      <div className="p-5 sm:p-7" style={{ textAlign: 'justify' }}>
                        {/* TOP: Title, Date, Time */}
                        <div className="text-center pb-4 mb-5 border-b-2 border-gray-800">
                          <h1 className="text-base font-bold text-gray-900 mb-2">{motmTitle} - Meeting Minutes</h1>
                          <p className="text-xs text-gray-600 mb-0.5">Date: {motmDate}</p>
                          <p className="text-xs text-gray-600">Time: {motmTime}</p>
                        </div>

                        {/* MIDDLE: Agendas */}
                        {motmAgendas.length > 0 ? (
                          motmAgendas.map((agenda, idx) => (
                            <div key={idx} className="mb-5">
                              <h3 className="text-xs font-bold text-gray-900 mb-2">{idx + 1}. {agenda.title || `Agenda ${idx + 1}`}</h3>
                              {agenda.key_points && agenda.key_points.length > 0 && (
                                <>
                                  <p className="text-[10px] font-semibold text-gray-700 mb-1">Key Points:</p>
                                  <ul className="list-disc ml-5 space-y-1 text-xs text-[#333] mb-3">
                                    {agenda.key_points.map((pt, i) => (
                                      <li key={i}>{pt}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              {agenda.important_clarifications && agenda.important_clarifications.length > 0 && (
                                <>
                                  <p className="text-[10px] font-semibold text-gray-700 mb-1">Important Clarifications:</p>
                                  <ul className="list-disc ml-5 space-y-1 text-xs text-[#333]">
                                    {agenda.important_clarifications.map((c, i) => (
                                      <li key={i}>{c}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-xs text-gray-500 italic">No meeting minutes available.</p>
                          </div>
                        )}

                        {/* Next meeting if present */}
                        {motmNextMeeting && (
                          <div className="mt-3 text-xs text-[#333]">
                            <p><strong>Next Meeting:</strong> {typeof motmNextMeeting === 'string' ? motmNextMeeting : JSON.stringify(motmNextMeeting)}</p>
                          </div>
                        )}

                        {/* BOTTOM: Prepared by */}
                        <div className="border-t-2 border-gray-800 mt-6 pt-4">
                          <p className="text-xs text-[#333]"><strong>Prepared by:</strong> {motmPreparedBy}</p>
                        </div>
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