"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Editor } from "@tinymce/tinymce-react";
import { FaMoon, FaSun, FaArrowLeft, FaDownload, FaSave } from "react-icons/fa";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "./styles.css";

function summaryJsonToHtml(summaryJson, meta = {}) {
  if (!summaryJson) return "<p>No summary data available.</p>";

  const s = typeof summaryJson === "string" ? JSON.parse(summaryJson) : summaryJson;
  const pageStyle = `max-width:210mm; margin:0 auto; padding:12mm 15mm; text-align:justify;`;
  const isMOTM = !!(s.meeting_title || s.agendas);

  // Simplified wrap – only for empty cells
  const wrapIfEmpty = (content) => {
    if (!content || content.trim() === '') return '<div style="min-height:1.2em;">&nbsp;</div>';
    return content;
  };

  if (isMOTM) {
    const meetingTitle = s.meeting_title || s.title || "Untitled Meeting";
    const date = s.date || meta.date || "Not specified";
    const time = s.time || "Not specified";
    const agendas = s.agendas || [];
    const nextMeeting = s.next_meeting || null;
    const preparedBy = s.prepared_by || "To be determined";

    let html = `<div style="${pageStyle}">`;
    html += `<div style="border:1px solid var(--border-color);">`;

    // Header – no extra wrap divs
    html += `<div style="background:#7c3aed; color:#ffffff; text-align:center; padding:16px;">`;
    html += `<h1 style="margin:0 0 8px 0; font-size:18pt; font-weight:700;">${meetingTitle}</h1>`;
    html += `<p style="margin:0; font-size:11pt;">Date: ${date} &nbsp;|&nbsp; Time: ${time}</p>`;
    html += `</div>`;

    // Agendas
    agendas.forEach((agenda, idx) => {
      const agendaTitle = agenda.title || `Agenda ${idx + 1}`;
      const keyPoints = agenda.key_points || [];
      const clarifications = agenda.important_clarifications || [];

      html += `<div style="padding:16px; border-bottom:1px solid var(--border-color);">`;
      html += `<h2 style="margin:0 0 10px 0; font-size:13pt; font-weight:700; color:var(--accent-color);">${idx + 1}. ${agendaTitle}</h2>`;

      if (keyPoints.length) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600;">Key Points:</p>`;
        html += `<ul style="margin:4px 0 12px 24px;">`;
        keyPoints.forEach(pt => html += `<li>${pt}</li>`);
        html += `</ul>`;
      }

      if (clarifications.length) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600;">Important Clarifications:</p>`;
        html += `<ul style="margin:4px 0 12px 24px;">`;
        clarifications.forEach(c => html += `<li>${c}</li>`);
        html += `</ul>`;
      }
      html += `</div>`;
    });

    if (nextMeeting) {
      const nextText = typeof nextMeeting === "string" ? nextMeeting : (nextMeeting.date ? nextMeeting.date + (nextMeeting.time ? " at " + nextMeeting.time : "") : JSON.stringify(nextMeeting));
      html += `<div style="padding:12px 16px; border-bottom:1px solid var(--border-color);">`;
      html += `<p><strong>Next Meeting:</strong> ${nextText}</p>`;
      html += `</div>`;
    }

    html += `<div style="padding:12px 16px; text-align:right;">`;
    html += `<p><strong>Prepared by:</strong> ${preparedBy}</p>`;
    html += `</div>`;
    html += `</div></div>`;
    return html;
  }

  // Standard summary (non‑MOTM)
  const topicTitle = s.title || "Untitled";
  const dateObj = meta.date ? new Date(meta.date) : (meta.createdAt ? new Date(meta.createdAt) : new Date());
  const recordDate = dateObj.toLocaleDateString();
  const keyConcepts = s.key_concepts || s.cue_questions || [];
  const notes = s.notes || [];
  const summaryArr = Array.isArray(s.summary) ? s.summary : (s.summary ? [s.summary] : (Array.isArray(s.takeaways) ? s.takeaways : (s.takeaways ? [s.takeaways] : [])));

  let html = `<div style="${pageStyle}">`;
  html += `<div style="display:grid; grid-template-columns:1fr 2fr; border:1px solid var(--border-color);">`;

  // Header row – spans both columns, no bottom border gap
  html += `<div style="grid-column:1/3; display:grid; grid-template-columns:1fr 2fr; background:#7c3aed; color:#ffffff;">`;
  html += `<div style="padding:12px 16px; text-align:left; font-size:11pt;"><strong>Date:</strong> ${recordDate}</div>`;
  html += `<div style="padding:12px 16px; text-align:right; font-size:16pt; font-weight:700;">${topicTitle}</div>`;
  html += `</div>`;

  // Key Concepts column
  html += `<div style="padding:16px; border-right:1px solid var(--border-color);">`;
  html += `<p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 12px 0;">Key Concepts</p>`;
  if (keyConcepts.length) {
    html += `<ul style="margin:0; padding-left:18px;">`;
    keyConcepts.forEach(c => html += `<li style="margin-bottom:6px;">${c}</li>`);
    html += `</ul>`;
  } else {
    html += `<p style="color:var(--text-muted); font-style:italic;">No key concepts added.</p>`;
  }
  html += `</div>`;

  // Notes column
  html += `<div style="padding:16px;">`;
  html += `<p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 12px 0;">Notes</p>`;
  if (Array.isArray(notes) && notes.length) {
    notes.forEach(note => {
      if (typeof note === "object" && note !== null) {
        if (note.term) html += `<p style="margin:0 0 3px 0; font-weight:700;">${note.term}</p>`;
        if (note.definition) html += `<p style="margin:0 0 3px 0;">${note.definition}</p>`;
        if (note.example) html += `<p style="margin:0 0 10px 0; font-size:10pt; font-style:italic;">Example: ${note.example}</p>`;
      } else {
        html += `<p style="margin:0 0 10px 0;">${note}</p>`;
      }
    });
  } else {
    html += `<p style="color:var(--text-muted); font-style:italic;">No notes available.</p>`;
  }
  html += `</div>`;

  // Summary row (spans both columns)
  html += `<div style="grid-column:1/3; padding:16px; border-top:1px solid var(--border-color);">`;
  html += `<p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 10px 0;">Summary</p>`;
  if (summaryArr.length) {
    html += `<ul style="margin:0; padding-left:18px;">`;
    summaryArr.forEach(s => html += `<li style="margin-bottom:6px;">${s}</li>`);
    html += `</ul>`;
  } else {
    html += `<p style="color:var(--text-muted); font-style:italic;">Summary pending — will appear once fully generated.</p>`;
  }
  html += `</div>`;

  html += `</div></div>`;
  return html;
}

function parseJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return value;
}

function transcriptJsonToHtml(transcriptJson, isDark = false) {
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
    // Wrap text in a full‑width div
    html += `<div style="width:100%; font-size:15px; line-height:1.7; color:${textColor};">${text}</div>`;
    html += `</div>`;
  });

  html += '</div>';
  return html;
}

export default function EducatorTranscriptionEditorPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const transcriptId = params.id;
  const activeTab = searchParams.get("tab") || "summary";

  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [tinymceReady, setTinymceReady] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [transcription, setTranscription] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const [contentLoaded, setContentLoaded] = useState(false);
  const editorRef = useRef(null);
  const currentContentRef = useRef("");
  const initialContentRef = useRef("");
  const contentInitialized = useRef(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark-mode");
    }
  }, []);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        const savedContent = localStorage.getItem(`educator-transcription-${transcriptId}`);
        const response = await fetch(`/api/educator/transcriptions/${transcriptId}`);
        if (!response.ok) {
          throw new Error(`Failed to load transcription: ${response.status}`);
        }

        const data = await response.json();
        const transcriptionData = data.transcription;
        setTranscription(transcriptionData);

        if (savedContent) {
          setEditorContent(savedContent);
          currentContentRef.current = savedContent;
          initialContentRef.current = savedContent;
        } else {
          let html = "";
          if (activeTab === "transcript") {
            if (transcriptionData.transcriptJson) {
              html = transcriptJsonToHtml(transcriptionData.transcriptJson, false);
            } else if (transcriptionData.content) {
              html = transcriptionData.content;
            } else {
              html = "<p>No transcript data available.</p>";
            }
          } else if (activeTab === "minutes") {
            html = summaryJsonToHtml(transcriptionData.summaryJson, transcriptionData, "Meeting Minutes");
          } else {
            html = summaryJsonToHtml(transcriptionData.summaryJson, transcriptionData, "Meeting Summary");
          }

          setEditorContent(html);
          currentContentRef.current = html;
          initialContentRef.current = html;
        }

        setContentLoaded(true);
        setLoading(false);
      } catch (err) {
        console.error("Error loading transcription:", err);
        setFetchError(err.message);
        setEditorContent(`\n          <h1>Welcome to the Educator Editor</h1>\n          <p>Start typing to create your document...</p>\n          <p style="color: red;"><strong>Error: ${err.message}</strong></p>\n        `);
        setLoading(false);
      }
    };

    loadDocument();
  }, [transcriptId, activeTab]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("Saving...");

    try {
      const updatedContent = currentContentRef.current || editorContent;
      const response = await fetch(`/api/educator/transcriptions/${transcriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      const data = await response.json();
      setTranscription(data.transcription);
      localStorage.setItem(`educator-transcription-${transcriptId}`, updatedContent);
      setEditorContent(updatedContent);
      setSaveStatus("✓ Saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus("✗ Error");
      setModalInfo({ isOpen: true, title: "Save Error", message: "Unable to save your document. Please try again.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const container = document.createElement("div");
      const contentHtml = editorRef.current?.getContent() || currentContentRef.current || "";
      const printStyles = `
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          .pdf-export-wrapper {
            --text-main: #1a1a1a;
            --text-muted: #666666;
            --border-color: #333333;
            --accent-color: #5b21b6;
            background-color: #ffffff;
            width: 100%;
          }
          .pdf-export-wrapper div, .pdf-export-wrapper p, .pdf-export-wrapper h1, .pdf-export-wrapper h2, .pdf-export-wrapper ul {
            margin: 0;
            padding: 0;
          }
          .pdf-export-wrapper ul, .pdf-export-wrapper ol {
            padding-left: 1.5em;
            margin: 0.5em 0;
          }
          .pdf-export-wrapper table {
            border-collapse: collapse;
            width: 100%;
            table-layout: fixed;
          }
          .pdf-export-wrapper table td, .pdf-export-wrapper table th {
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            vertical-align: top;
          }
          .pdf-export-wrapper table tr { page-break-inside: avoid; }
        </style>
      `;

      container.innerHTML = printStyles + `<div class="pdf-export-wrapper" style="margin:0; padding:0;">${contentHtml}</div>`;
      container.style.margin = "0";
      container.style.padding = "0";
      container.style.backgroundColor = "#ffffff";
      container.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      container.style.fontSize = "12pt";
      container.style.lineHeight = "1.7";
      container.style.color = "#1a1a1a";
      container.style.backgroundColor = "#ffffff";
      container.style.textAlign = "justify";
      container.style.maxWidth = "210mm";
      container.style.margin = "0 auto";

      const dateObj = transcription?.date ? new Date(transcription.date) : new Date();
      const dateTag = `${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}-${String(dateObj.getFullYear()).slice(2)}`;
      const courseTag = transcription?.class?.subject || transcription?.course || "document";
      const topicTag = transcription?.title || "document";
      const sanitize = (str) => str.replace(/ /g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
      const filename = `${sanitize(courseTag)}_${sanitize(topicTag)}_${dateTag}.pdf`;

      await html2pdf().set({
        margin: [5, 5, 5, 5],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      }).from(container).save();
    } catch (error) {
      console.error("PDF download error:", error);
      setModalInfo({ isOpen: true, title: "PDF Error", message: "Failed to generate PDF. Please try again.", type: "error" });
    }
  };

  if (!loading && !transcription && fetchError) {
    return (
      <div className="reviewer-editor-container">
        <div className="error-message">
          <h2>Transcription not found</h2>
          <p>{fetchError}</p>
          <button onClick={() => router.push("/educator/transcriptions")}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`reviewer-editor-container ${darkMode ? "dark-mode" : ""}`}>
      {(loading || !tinymceReady) && <LoadingScreen />}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn back-btn" onClick={() => router.back()}>
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <div className="document-title">
            <h2>{transcription?.title || "Loading..."}</h2>
            <div className="document-info">{transcription?.class?.subject || transcription?.course || transcriptId} • Editable Document</div>
          </div>
        </div>
        <div className="toolbar-right">
          {saveStatus && <div className="save-status">{saveStatus}</div>}
          <button className="toolbar-btn" onClick={handleSave} disabled={isSaving}>
            <FaSave />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>
          <button className="toolbar-btn" onClick={handleDownloadPDF}>
            <FaDownload />
            <span>Download PDF</span>
          </button>
          <button className="toolbar-btn icon-only" onClick={toggleDarkMode}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </div>

      <div className="editor-content">
        {!loading && (
          <div className="tinymce-wrapper">
            <Editor
              key={contentLoaded ? (darkMode ? "loaded-dark" : "loaded-light") : "loading"}
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              initialValue={initialContentRef.current || "<p>Loading content...</p>"}
              onInit={(evt, editor) => {
                editorRef.current = editor;
                contentInitialized.current = true;
                setTinymceReady(true);
              }}
              onEditorChange={(content) => {
                currentContentRef.current = content;
                setEditorContent(content);
              }}
              init={{
                height: 700,
                width: "100%",
                menubar: false,
                promotion: false,
                license_key: "gpl",
                plugins: [
                  "advlist",
                  "autolink",
                  "lists",
                  "link",
                  "image",
                  "charmap",
                  "anchor",
                  "searchreplace",
                  "visualblocks",
                  "code",
                  "insertdatetime",
                  "media",
                  "table",
                  "help",
                  "wordcount",
                ],
                toolbar: "undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist | table | removeformat",
                table_toolbar: "tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablecellprops tablemergecells tablesplitcells",
                content_style: `
                  :root {
                    --text-main: ${darkMode ? "#e8e8e8" : "#1a1a1a"};
                    --text-muted: ${darkMode ? "#a0a0a0" : "#666666"};
                    --border-color: ${darkMode ? "#4c4172" : "#333333"};
                    --accent-color: ${darkMode ? "#c5a6f9" : "#5b21b6"};
                  }
                  body {
                    font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 12pt;
                    line-height: 1.7;
                    color: var(--text-main);
                    background-color: ${darkMode ? "#1a1625" : "#ffffff"};
                  }
                  body > div {
                    width: 100% !important;
                    max-width: 210mm !important;
                    box-sizing: border-box !important;
                  }
                  table {
                    border-collapse: collapse;
                    width: 100% !important;
                    max-width: 100%;
                    margin: 0;
                    table-layout: fixed;
                    word-wrap: break-word;
                  }
                  table td, table th {
                    vertical-align: top;
                    text-align: justify;
                    border: 1px solid var(--border-color) !important;
                    box-sizing: border-box !important;
                    overflow-wrap: break-word;
                    cursor: text !important;
                    user-select: text !important;
                    min-height: 1.3em !important;
                  }
                  h1, h2, h3 { color: var(--text-main); }
                  ul { margin: 4px 0 12px 24px; padding: 0; }
                  li { margin-bottom: 5px; }
                  p { margin: 0 0 8px 0; }
                  @media (max-width: 600px) {
                    body > div { padding: 12px !important; }
                    table, thead, tbody, th, td, tr { display: block !important; width: 100% !important; box-sizing: border-box !important; }
                    table td, table th { padding: 14px !important; border-bottom: none !important; font-size: 11pt; }
                    table td:last-child { border-bottom: 1px solid var(--border-color) !important; }
                    td[style*="text-align:right"] { text-align: left !important; }
                  }
                `,
                skin: darkMode ? "oxide-dark" : "oxide",
                content_css: darkMode ? "dark" : "default",
                branding: false,
                resize: false,
                statusbar: true,
                table_default_attributes: { border: "0" },
                table_default_styles: {
                  "border-collapse": "collapse",
                  width: "100%",
                },
              }}
            />
          </div>
        )}
      </div>

      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}
