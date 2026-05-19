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
  const pageStyle = `max-width:210mm; margin:0 auto; padding:20mm 18mm; text-align:justify;`;
  const isMOTM = !!(s.meeting_title || s.agendas);

  if (isMOTM) {
    const meetingTitle = s.meeting_title || s.title || "Untitled Meeting";
    const date = s.date || meta.date || "Not specified";
    const time = s.time || "Not specified";
    const agendas = s.agendas || [];
    const nextMeeting = s.next_meeting || null;
    const preparedBy = s.prepared_by || "To be determined";

    let html = `<div style="${pageStyle}">`;
    html += `<table style="width:100%; border-collapse:collapse; border:1px solid var(--border-color);">`;
    html += `<tr><td colspan="2" style="background:#7c3aed; color:#ffffff; text-align:center; padding:16px; border:1px solid var(--border-color);"><h1 style="margin:0 0 8px 0; font-size:18pt; font-weight:700; color:#ffffff;">${meetingTitle}</h1><p style="margin:3px 0; font-size:11pt; color:#f0e6ff;">Date: ${date} &nbsp;|&nbsp; Time: ${time}</p></td></tr>`;

    agendas.forEach((agenda, idx) => {
      const agendaTitle = agenda.title || `Agenda ${idx + 1}`;
      const keyPoints = agenda.key_points || [];
      const clarifications = agenda.important_clarifications || [];

      html += `<tr><td colspan="2" style="padding:16px; border:1px solid var(--border-color); text-align:justify;"><h2 style="margin:0 0 10px 0; font-size:13pt; font-weight:700; color:var(--accent-color);">${idx + 1}. ${agendaTitle}</h2>`;

      if (keyPoints.length > 0) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt; color:var(--text-main);">Key Points:</p><ul style="margin:4px 0 12px 24px; padding:0; color:var(--text-main);">`;
        keyPoints.forEach((pt) => {
          html += `<li style="margin-bottom:5px; font-size:11pt; text-align:justify;">${pt}</li>`;
        });
        html += `</ul>`;
      }

      if (clarifications.length > 0) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt; color:var(--text-main);">Important Clarifications:</p><ul style="margin:4px 0 12px 24px; padding:0; color:var(--text-main);">`;
        clarifications.forEach((c) => {
          html += `<li style="margin-bottom:5px; font-size:11pt; text-align:justify;">${c}</li>`;
        });
        html += `</ul>`;
      }

      html += `</td></tr>`;
    });

    if (nextMeeting) {
      html += `<tr><td colspan="2" style="padding:12px 16px; border:1px solid var(--border-color); text-align:justify;"><p style="font-size:11pt; margin:0; color:var(--text-main);"><strong>Next Meeting:</strong> ${typeof nextMeeting === "string" ? nextMeeting : (nextMeeting.date ? nextMeeting.date + (nextMeeting.time ? " at " + nextMeeting.time : "") : JSON.stringify(nextMeeting))}</p></td></tr>`;
    }

    html += `<tr><td colspan="2" style="padding:12px 16px; border:1px solid var(--border-color); text-align:right;"><p style="font-size:11pt; margin:0; color:var(--text-main);"><strong>Prepared by:</strong> ${preparedBy}</p></td></tr>`;
    html += `</table>`;
    html += `</div>`;
    return html;
  }

  const topicTitle = s.title || "Untitled";
  const dateObj = meta.date ? new Date(meta.date) : (meta.createdAt ? new Date(meta.createdAt) : new Date());
  const recordDate = dateObj.toLocaleDateString();
  const keyConcepts = s.key_concepts || s.cue_questions || [];
  const notes = s.notes || [];
  const summaryArr = Array.isArray(s.summary) ? s.summary : (s.summary ? [s.summary] : (Array.isArray(s.takeaways) ? s.takeaways : (s.takeaways ? [s.takeaways] : [])));

  let html = `<div style="${pageStyle}">`;
  html += `<table style="width:100%; border-collapse:collapse; border:1px solid var(--border-color);">`;
  html += `<tr><td style="padding:14px 16px; width:35%; text-align:left; vertical-align:middle; font-size:11pt; color:#ffffff; background:#7c3aed; border:1px solid var(--border-color);"><strong>Date:</strong> ${recordDate}</td><td style="padding:14px 16px; width:65%; text-align:right; vertical-align:middle; font-size:16pt; font-weight:700; color:#ffffff; background:#7c3aed; border:1px solid var(--border-color);">${topicTitle}</td></tr>`;
  html += `</table>`;
  html += `<table style="width:100%; border-collapse:collapse; border:1px solid var(--border-color); margin-top:12px;">`;
  html += `<tr><td style="width:35%; vertical-align:top; padding:16px; border:1px solid var(--border-color);"><p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Key Concepts</p>`;

  if (keyConcepts.length > 0) {
    html += `<ul style="margin:0; padding:0 0 0 18px; list-style-type:disc; color:var(--text-main);">`;
    keyConcepts.forEach((concept) => {
      html += `<li style="margin-bottom:8px; font-size:11pt;">${concept}</li>`;
    });
    html += `</ul>`;
  }

  html += `</td><td style="width:65%; vertical-align:top; padding:16px; border:1px solid var(--border-color);"><p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Notes</p>`;

  if (Array.isArray(notes) && notes.length > 0) {
    notes.forEach((note) => {
      if (typeof note === "object" && note !== null) {
        if (note.term) html += `<div style="margin-bottom:16px;"><p style="margin:0 0 3px 0; font-weight:700; font-size:11pt; color:var(--text-main);">${note.term}</p>`;
        if (note.definition) html += `<p style="margin:0 0 3px 0; font-size:11pt; color:var(--text-main);">${note.definition}</p>`;
        if (note.example) html += `<p style="margin:0; font-size:10pt; color:var(--text-muted); font-style:italic;">Example: ${note.example}</p>`;
        html += `</div>`;
      } else {
        html += `<p style="margin:0 0 10px 0; font-size:11pt; color:var(--text-main);">${note}</p>`;
      }
    });
  }

  html += `</td></tr>`;
  html += `<tr><td colspan="2" style="padding:16px; border:1px solid var(--border-color);"><p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">Summary</p>`;

  if (summaryArr.length > 0) {
    html += `<ul style="margin:0; padding:0 0 0 18px; color:var(--text-main);">`;
    summaryArr.forEach((point) => {
      html += `<li style="margin-bottom:6px; font-size:11pt;">${point}</li>`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="font-size:11pt; color:var(--text-muted); font-style:italic;">Summary pending — will appear once fully generated.</p>`;
  }

  html += `</td></tr>`;
  html += `</table>`;
  html += `</div>`;
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
    html += `<div style="font-size:15px; line-height:1.7; color:${textColor};">${text}</div>`;
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
          .pdf-export-wrapper {
            --text-main: #1a1a1a;
            --text-muted: #666666;
            --border-color: #333333;
            --accent-color: #5b21b6;
            background-color: #ffffff;
          }
          .pdf-export-wrapper table {
            border-collapse: collapse;
            width: 100%;
            table-layout: fixed;
          }
          .pdf-export-wrapper table td, .pdf-export-wrapper table th {
            padding: 14px 16px;
            border: 1px solid var(--border-color);
          }
          .pdf-export-wrapper table tr { page-break-inside: avoid; }
        </style>
      `;

      container.innerHTML = printStyles + `<div class="pdf-export-wrapper">${contentHtml}</div>`;
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
