"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PreviewPanel({ transcript, onUpdate }) {
  const router = useRouter();
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

  const parseJson = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }
    return value;
  };

  const summaryData = parseJson(transcript?.summaryJson);
  const transcriptData = parseJson(transcript?.transcriptJson);
  const contentHtml = transcript?.content || null;

  const isMOTM = !!(summaryData?.meeting_title || summaryData?.agendas);

  const transcriptJsonToHtml = (transcriptJson, isDark = false) => {
    if (!transcriptJson) return "<p>No transcript data available.</p>";

    const data = typeof transcriptJson === "string" ? parseJson(transcriptJson) : transcriptJson;
    const chunks = Array.isArray(data?.chunks) ? data.chunks : Array.isArray(data) ? data : [];

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return "<p>No transcript chunks available.</p>";
    }

    const bgColor = isDark ? "#2d2640" : "#faf5ff";
    const textColor = isDark ? "#e8e8e8" : "#1a1a1a";
    const headingColor = isDark ? "#c5a6f9" : "#7c3aed";
    const borderColor = isDark ? "#c5a6f9" : "#7c3aed";
    const mainTitleColor = isDark ? "#c5a6f9" : "#5b21b6";

    let html = '<div style="padding:20px;">';
    html += `<h1 style="text-align:center; color:${mainTitleColor}; margin-bottom:24px;">Lecture Transcript</h1>`;

    chunks.forEach((chunk) => {
      const timestamp = chunk.timestamp || "";
      const text = chunk.text || "";
      html += `<div style="margin-bottom:16px; padding:12px 16px; border-left:4px solid ${borderColor}; background:${bgColor}; border-radius:0 8px 8px 0;">`;
      if (timestamp) {
        html += `<div style="font-size:12px; font-weight:700; color:${headingColor}; margin-bottom:4px;">[${timestamp}]</div>`;
      }
      html += `<div style="font-size:15px; line-height:1.7; color:${textColor};">${text}</div>`;
      html += `</div>`;
    });

    html += '</div>';
    return html;
  };

  const summaryJsonToHtml = (summaryJson, meta = {}, titleOverride = "Meeting Summary") => {
    if (!summaryJson) return "<p>No summary data available.</p>";

    const s = typeof summaryJson === "string" ? parseJson(summaryJson) : summaryJson;
    if (!s) return "<p>Summary data is unavailable.</p>";

    const pageStyle = "max-width:100%; margin:0 auto; padding:20px 18px; text-align:justify;";
    const isMeeting = !!(s.meeting_title || s.agendas);
    const topicTitle = s.title || meta.title || "Untitled";
    const dateStr = meta.date ? new Date(meta.date).toLocaleDateString() : new Date().toLocaleDateString();
    const keyConcepts = s.key_concepts || s.cue_questions || [];
    const notes = s.notes || [];
    const summaryArr = Array.isArray(s.summary) ? s.summary : s.summary ? [s.summary] : [];

    let html = `<div style="${pageStyle}">`;

    if (isMeeting) {
      const meetingTitle = s.meeting_title || s.title || "Untitled Meeting";
      const date = s.date || meta.date || "Not specified";
      const time = s.time || "Not specified";
      const agendas = s.agendas || [];
      const nextMeeting = s.next_meeting || null;
      const preparedBy = s.prepared_by || "To be determined";

      html += `<table style="width:100%; border-collapse:collapse; border:1px solid #d6bbff;">`;
      html += `<tr><td colspan="2" style="background:#7c3aed; color:#ffffff; padding:16px; text-align:center; border:1px solid #d6bbff;"><h1 style="margin:0 0 8px 0; font-size:18pt;">${titleOverride}</h1><p style="margin:3px 0; font-size:11pt; color:#f0e6ff;">Date: ${date} &nbsp;|&nbsp; Time: ${time}</p></td></tr>`;

      agendas.forEach((agenda, idx) => {
        const agendaTitle = agenda.title || `Agenda ${idx + 1}`;
        const keyPoints = agenda.key_points || [];
        const clarifications = agenda.important_clarifications || [];

        html += `<tr><td colspan="2" style="padding:16px; border:1px solid #d6bbff; text-align:justify;"><h2 style="margin:0 0 10px 0; font-size:13pt; font-weight:700; color:#7c3aed;">${idx + 1}. ${agendaTitle}</h2>`;
        if (keyPoints.length > 0) {
          html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt; color:#1a1a1a;">Key Points:</p><ul style="margin:4px 0 12px 24px; padding:0; color:#1a1a1a;">`;
          keyPoints.forEach((pt) => {
            html += `<li style="margin-bottom:5px; font-size:11pt; text-align:justify;">${pt}</li>`;
          });
          html += `</ul>`;
        }
        if (clarifications.length > 0) {
          html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt; color:#1a1a1a;">Important Clarifications:</p><ul style="margin:4px 0 12px 24px; padding:0; color:#1a1a1a;">`;
          clarifications.forEach((c) => {
            html += `<li style="margin-bottom:5px; font-size:11pt; text-align:justify;">${c}</li>`;
          });
          html += `</ul>`;
        }
        html += `</td></tr>`;
      });

      if (nextMeeting) {
        html += `<tr><td colspan="2" style="padding:12px 16px; border:1px solid #d6bbff; text-align:justify;"><p style="margin:0; font-size:11pt; color:#1a1a1a;"><strong>Next Meeting:</strong> ${typeof nextMeeting === "string" ? nextMeeting : JSON.stringify(nextMeeting)}</p></td></tr>`;
      }

      html += `<tr><td colspan="2" style="padding:12px 16px; border:1px solid #d6bbff; text-align:right;"><p style="margin:0; font-size:11pt; color:#1a1a1a;"><strong>Prepared by:</strong> ${preparedBy}</p></td></tr>`;
      html += `</table>`;
    } else {
      html += `<table style="width:100%; border-collapse:collapse; border:1px solid #d6bbff;">`;
      html += `<tr><td style="padding:14px 16px; width:35%; font-size:11pt; color:#ffffff; background:#7c3aed; border:1px solid #d6bbff;">Date: ${dateStr}</td><td style="padding:14px 16px; width:65%; font-size:16pt; font-weight:700; color:#ffffff; background:#7c3aed; border:1px solid #d6bbff;">${topicTitle}</td></tr>`;
      html += `</table>`;
      html += `<table style="width:100%; border-collapse:collapse; border:1px solid #d6bbff; margin-top:12px;">`;
      html += `<tr><td style="width:35%; padding:16px; border:1px solid #d6bbff; vertical-align:top;"><p style="font-weight:700; font-size:11pt; color:#7c3aed; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Key Concepts</p>`;
      if (keyConcepts.length > 0) {
        html += `<ul style="margin:0; padding:0 0 0 18px; list-style-type:disc; color:#1a1a1a;">`;
        keyConcepts.forEach((concept) => {
          html += `<li style="margin-bottom:8px; font-size:11pt;">${concept}</li>`;
        });
        html += `</ul>`;
      }
      html += `</td><td style="width:65%; padding:16px; border:1px solid #d6bbff; vertical-align:top;"><p style="font-weight:700; font-size:11pt; color:#7c3aed; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Notes</p>`;
      if (Array.isArray(notes) && notes.length > 0) {
        notes.forEach((note) => {
          if (typeof note === "object" && note !== null) {
            if (note.term) html += `<p style="margin:0 0 3px 0; font-weight:700; font-size:11pt; color:#1a1a1a;">${note.term}</p>`;
            if (note.definition) html += `<p style="margin:0 0 3px 0; font-size:11pt; color:#1a1a1a;">${note.definition}</p>`;
            if (note.example) html += `<p style="margin:0 0 10px 0; font-size:10pt; color:#666666; font-style:italic;">Example: ${note.example}</p>`;
          } else {
            html += `<p style="margin:0 0 10px 0; font-size:11pt; color:#1a1a1a;">${note}</p>`;
          }
        });
      }
      html += `</td></tr>`;
      html += `<tr><td colspan="2" style="padding:16px; border:1px solid #d6bbff;"><p style="font-weight:700; font-size:11pt; color:#7c3aed; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">Summary</p>`;
      if (summaryArr.length > 0) {
        html += `<ul style="margin:0; padding:0 0 0 18px; color:#1a1a1a;">`;
        summaryArr.forEach((point) => {
          html += `<li style="margin-bottom:6px; font-size:11pt;">${point}</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p style="font-size:11pt; color:#666666; font-style:italic;">Summary pending — will appear once fully generated.</p>`;
      }
      html += `</td></tr>`;
      html += `</table>`;
    }

    html += `</div>`;
    return html;
  };

  const renderedSummaryHtml =
    (summaryData ? summaryJsonToHtml(summaryData, transcript, "Meeting Summary") : null) ||
    contentHtml ||
    "<p>No summary data available.</p>";
  const renderedTranscriptHtml =
    transcriptData ? transcriptJsonToHtml(transcriptData, false) : transcript?.content || "<p>No transcript data available.</p>";
  const renderedMinutesHtml =
    isMOTM
      ? summaryData
        ? summaryJsonToHtml(summaryData, transcript, "Meeting Minutes")
        : renderedSummaryHtml
      : renderedSummaryHtml;

  const hasJsonData = !!(summaryData || transcriptData || contentHtml);

  const handleOpenEditor = () => {
    if (transcript?.id) {
      router.push(`/educator/transcriptions/${transcript.id}?tab=${encodeURIComponent(activeTab)}`);
    }
  };

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
                  className="cursor-pointer"
                  onClick={handleOpenEditor}
                  title="Open editable document"
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
                    {/* SUMMARY VIEW */}
                    {activeTab === "summary" && (
                      <div style={{ padding: '20px 28px', textAlign: 'justify' }}>
                        <div
                          style={{ fontSize: '11px', color: '#1a1a1a', lineHeight: 1.8 }}
                          dangerouslySetInnerHTML={{ __html: renderedSummaryHtml }}
                        />
                      </div>
                    )}

                    {activeTab === "transcript" && (
                      <div style={{ padding: '20px 28px', textAlign: 'justify' }}>
                        <div
                          style={{ fontSize: '11px', color: '#1a1a1a', lineHeight: 1.8 }}
                          dangerouslySetInnerHTML={{ __html: renderedTranscriptHtml }}
                        />
                      </div>
                    )}

                    {activeTab === "minutes" && (
                      <div style={{ padding: '20px 28px', textAlign: 'justify' }}>
                        <div
                          style={{ fontSize: '11px', color: '#1a1a1a', lineHeight: 1.8 }}
                          dangerouslySetInnerHTML={{ __html: renderedMinutesHtml }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ZOOM CONTROLS */}
            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-[#3a355c] text-white px-4 py-2 rounded-full text-xs z-10">
              <button onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.2, z + 0.1))}>+</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}