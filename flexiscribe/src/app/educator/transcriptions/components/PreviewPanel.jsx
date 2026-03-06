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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 flex-shrink-0">
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
          <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* FRAME - Fixed height container */}
      <div className="relative flex-1 rounded-[16px] sm:rounded-[24px] lg:rounded-[30px] bg-[#2f2b47] p-3 sm:p-6 overflow-hidden min-h-0">
        {!transcript && (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/70 text-sm">Select a transcript to preview</p>
          </div>
        )}

        {transcript && (
          <>
            {/* Scrollable content area */}
            <div className="h-full overflow-y-auto flex justify-center">
              <div
                className="origin-top transition-transform duration-300 w-full sm:w-auto"
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center'
                }}
              >
                <div
                  ref={pdfRef}
                  style={{
                    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                    backgroundColor: '#ffffff',
                    width: '560px',
                    minHeight: 'auto',
                    height: 'auto',
                    border: '1px solid #1a1a1a',
                    boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
                  }}
                  className="w-full sm:w-[560px]"
                >
                  {/* ═══════ SUMMARY VIEW ═══════ */}
                  {activeTab === "summary" && (
                    <>
                      {isMOTM ? (
                        /* ─── MOTM Layout (sequential) ─── */
                        <div style={{ padding: '20px 28px', textAlign: 'justify' }}>
                          {/* TOP: Title, Date, Time — purple fill */}
                          <div style={{ backgroundColor: '#4c4172', borderRadius: '6px', padding: '16px 20px', marginBottom: '20px', textAlign: 'center' }}>
                            <h1 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>{motmTitle}</h1>
                            <p style={{ fontSize: '11px', color: '#e0d8f0', margin: '2px 0' }}>Date: {motmDate}</p>
                            <p style={{ fontSize: '11px', color: '#e0d8f0', margin: '2px 0' }}>Time: {motmTime}</p>
                          </div>

                          {/* MIDDLE: Agendas with subcontent */}
                          {motmAgendas.map((agenda, idx) => (
                            <div key={idx} style={{ marginBottom: '20px' }}>
                              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#4c4172', marginBottom: '8px' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9d8adb', marginRight: '8px', verticalAlign: 'middle' }} />
                                {idx + 1}. {agenda.title || `Agenda ${idx + 1}`}
                              </h3>
                              {agenda.key_points && agenda.key_points.length > 0 && (
                                <>
                                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#4c4172', marginBottom: '4px' }}>Key Points:</p>
                                  <ul style={{ listStyleType: 'disc', marginLeft: '20px', marginBottom: '12px' }}>
                                    {agenda.key_points.map((pt, i) => (
                                      <li key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '4px' }}>{pt}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              {agenda.important_clarifications && agenda.important_clarifications.length > 0 && (
                                <>
                                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#4c4172', marginBottom: '4px' }}>Important Clarifications:</p>
                                  <ul style={{ listStyleType: 'disc', marginLeft: '20px' }}>
                                    {agenda.important_clarifications.map((c, i) => (
                                      <li key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '4px' }}>{c}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Next meeting if present */}
                          {motmNextMeeting && (
                            <div style={{ marginTop: '12px', fontSize: '11px', color: '#1a1a1a' }}>
                              <p><strong style={{ color: '#4c4172' }}>Next Meeting:</strong> {typeof motmNextMeeting === 'string' ? motmNextMeeting : JSON.stringify(motmNextMeeting)}</p>
                            </div>
                          )}

                          {/* BOTTOM: Prepared by */}
                          <div style={{ borderTop: '2px solid #4c4172', marginTop: '24px', paddingTop: '16px' }}>
                            <p style={{ fontSize: '11px', color: '#1a1a1a' }}><strong style={{ color: '#4c4172' }}>Prepared by:</strong> {motmPreparedBy}</p>
                          </div>
                        </div>
                      ) : (
                        /* ─── Cornell Notes Layout ─── */
                        <>
                          {/* TOP: Date (left) | Title (right) — purple fill */}
                          <div style={{ display: 'flex', backgroundColor: '#4c4172', borderBottom: '2px solid #4c4172' }}>
                            <div style={{ width: '35%', padding: '12px 16px', fontSize: '11px', color: '#e0d8f0' }}>
                              <strong style={{ color: '#ffffff' }}>Date:</strong> {transcript.date}
                            </div>
                            <div style={{ width: '65%', padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                              {cornellTitle}
                            </div>
                          </div>

                          {/* MIDDLE: Key Concepts (left) | Notes (right) */}
                          <div style={{ display: 'flex', minHeight: '300px' }}>
                            {/* Key Concepts */}
                            <div style={{ width: '35%', padding: '16px 20px', borderRight: '2px solid #4c4172', textAlign: 'justify' }}>
                              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', color: '#4c4172', letterSpacing: '0.5px' }}>
                                Key Concepts
                              </p>
                              <ul style={{ listStyleType: 'disc', marginLeft: '16px' }}>
                                {keyConcepts.map((concept, i) => (
                                  <li key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '8px' }}>{concept}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Notes */}
                            <div style={{ width: '65%', padding: '16px 20px', textAlign: 'justify', lineHeight: 1.6 }}>
                              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', color: '#4c4172', letterSpacing: '0.5px' }}>Notes</p>
                              {Array.isArray(notes) && notes.length > 0 ? (
                                <div>
                                  {notes.map((note, i) => (
                                    typeof note === "object" && note !== null ? (
                                      <div key={i} style={{ marginBottom: '12px' }}>
                                        {note.term && <p style={{ fontSize: '11px', fontWeight: 700, color: '#4c4172', marginBottom: '2px' }}>{note.term}</p>}
                                        {note.definition && <p style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '2px' }}>{note.definition}</p>}
                                        {note.example && <p style={{ fontSize: '10px', color: '#666666', fontStyle: 'italic' }}>Example: {note.example}</p>}
                                      </div>
                                    ) : (
                                      <p key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '8px' }}>{note}</p>
                                    )
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: '11px', color: '#1a1a1a' }}>{notes}</p>
                              )}
                            </div>
                          </div>

                          {/* BOTTOM: Summary */}
                          <div style={{ borderTop: '2px solid #4c4172', padding: '16px 20px', textAlign: 'justify' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', color: '#4c4172', letterSpacing: '0.5px' }}>Summary</p>
                            {summaryArr.length > 0 ? (
                              <ul style={{ listStyleType: 'disc', marginLeft: '16px' }}>
                                {summaryArr.map((pt, i) => (
                                  <li key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '4px' }}>{pt}</li>
                                ))}
                              </ul>
                            ) : (
                              <p style={{ fontSize: '11px', color: '#1a1a1a' }}>{summaryText}</p>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* ═══════ TRANSCRIPT VIEW (Timestamped) ═══════ */}
                  {activeTab === "transcript" && (
                    <>
                      {/* TOP BAR — purple fill */}
                      <div style={{ backgroundColor: '#4c4172', borderBottom: '2px solid #4c4172', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '4px', fontSize: '11px' }}>
                        <span style={{ color: '#e0d8f0', flexShrink: 0 }}>{transcript.date}</span>
                        <span style={{ color: '#ffffff', fontWeight: 700, flex: 1, textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transcript.title}</span>
                        <span style={{ color: '#e0d8f0', flexShrink: 0 }}>{transcript.duration}</span>
                      </div>

                      {/* TRANSCRIPT CHUNKS */}
                      <div style={{ padding: '16px 24px', textAlign: 'justify' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', color: '#4c4172', letterSpacing: '0.5px' }}>
                          Transcript ({chunks.length} segments)
                        </p>

                        {chunks.length > 0 ? (
                          <div>
                            {chunks.map((chunk, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', backgroundColor: '#9d8adb', padding: '2px 8px', borderRadius: '4px', flexShrink: 0, marginTop: '2px' }}>
                                  {chunk.timestamp || `MIN ${chunk.minute}`}
                                </span>
                                <p style={{ fontSize: '11px', color: '#1a1a1a', lineHeight: 1.6, flex: 1, textAlign: 'justify', margin: 0 }}>
                                  {chunk.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{ fontSize: '11px', color: '#1a1a1a', lineHeight: 1.6, textAlign: 'justify' }}
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
                      <div style={{ padding: '20px 28px', textAlign: 'justify' }}>
                        {/* TOP: Title, Date, Time — purple fill */}
                        <div style={{ backgroundColor: '#4c4172', borderRadius: '6px', padding: '16px 20px', marginBottom: '20px', textAlign: 'center' }}>
                          <h1 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>{motmTitle} - Meeting Minutes</h1>
                          <p style={{ fontSize: '11px', color: '#e0d8f0', margin: '2px 0' }}>Date: {motmDate}</p>
                          <p style={{ fontSize: '11px', color: '#e0d8f0', margin: '2px 0' }}>Time: {motmTime}</p>
                        </div>

                        {/* MIDDLE: Agendas */}
                        {motmAgendas.length > 0 ? (
                          motmAgendas.map((agenda, idx) => (
                            <div key={idx} style={{ marginBottom: '20px' }}>
                              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#4c4172', marginBottom: '8px' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9d8adb', marginRight: '8px', verticalAlign: 'middle' }} />
                                {idx + 1}. {agenda.title || `Agenda ${idx + 1}`}
                              </h3>
                              {agenda.key_points && agenda.key_points.length > 0 && (
                                <>
                                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#4c4172', marginBottom: '4px' }}>Key Points:</p>
                                  <ul style={{ listStyleType: 'disc', marginLeft: '20px', marginBottom: '12px' }}>
                                    {agenda.key_points.map((pt, i) => (
                                      <li key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '4px' }}>{pt}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              {agenda.important_clarifications && agenda.important_clarifications.length > 0 && (
                                <>
                                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#4c4172', marginBottom: '4px' }}>Important Clarifications:</p>
                                  <ul style={{ listStyleType: 'disc', marginLeft: '20px' }}>
                                    {agenda.important_clarifications.map((c, i) => (
                                      <li key={i} style={{ fontSize: '11px', color: '#1a1a1a', marginBottom: '4px' }}>{c}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <p style={{ fontSize: '11px', color: '#999999', fontStyle: 'italic' }}>No meeting minutes available.</p>
                          </div>
                        )}

                        {/* Next meeting if present */}
                        {motmNextMeeting && (
                          <div style={{ marginTop: '12px', fontSize: '11px', color: '#1a1a1a' }}>
                            <p><strong style={{ color: '#4c4172' }}>Next Meeting:</strong> {typeof motmNextMeeting === 'string' ? motmNextMeeting : JSON.stringify(motmNextMeeting)}</p>
                          </div>
                        )}

                        {/* BOTTOM: Prepared by */}
                        <div style={{ borderTop: '2px solid #4c4172', marginTop: '24px', paddingTop: '16px' }}>
                          <p style={{ fontSize: '11px', color: '#1a1a1a' }}><strong style={{ color: '#4c4172' }}>Prepared by:</strong> {motmPreparedBy}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ZOOM CONTROLS */}
            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-[#3a355c] text-white px-4 py-2 rounded-full text-xs z-10">
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