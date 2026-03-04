"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Editor } from "@tinymce/tinymce-react";
import { 
  FaMoon, FaSun, FaArrowLeft, FaDownload, FaSave
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";
import "./styles.css";

/**
 * Convert summaryJson to editable HTML for TinyMCE.
 * Supports both Cornell Notes (lecture) and MOTM (meeting) formats.
 * @param {object|string} summaryJson - The summary JSON data
 * @param {object} meta - Optional metadata from the transcription record (date, title, etc.)
 */
function summaryJsonToHtml(summaryJson, meta = {}) {
  if (!summaryJson) return "<p>No summary data available.</p>";

  const s = typeof summaryJson === "string" ? JSON.parse(summaryJson) : summaryJson;

  // A4 page style: 210mm wide, proper margins, justified text
  const pageStyle = `max-width:210mm; margin:0 auto; padding:20mm 18mm; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size:12pt; line-height:1.7; color:#1a1a1a; text-align:justify;`;

  // ─── Detect MOTM format (meeting) ───────────────────────────────
  const isMOTM = !!(s.meeting_title || s.agendas);

  if (isMOTM) {
    const meetingTitle = s.meeting_title || s.title || "Untitled Meeting";
    const date = s.date || meta.date || "Not specified";
    const time = s.time || "Not specified";
    const agendas = s.agendas || [];
    const nextMeeting = s.next_meeting || null;
    const preparedBy = s.prepared_by || "To be determined";

    let html = `<div style="${pageStyle}">`;

    // TOP: Meeting Title, Date, Time — each on its own line
    html += `<div style="text-align:center; padding-bottom:16px; margin-bottom:24px; border-bottom:2px solid #333;">`;
    html += `<h1 style="margin:0 0 10px 0; font-size:18pt; font-weight:700; color:#1a1a1a;">${meetingTitle}</h1>`;
    html += `<p style="margin:3px 0; font-size:11pt; color:#444;">Date: ${date}</p>`;
    html += `<p style="margin:3px 0; font-size:11pt; color:#444;">Time: ${time}</p>`;
    html += `</div>`;

    // MIDDLE: Agendas with subcontent (can span many pages)
    agendas.forEach((agenda, idx) => {
      const agendaTitle = agenda.title || `Agenda ${idx + 1}`;
      const keyPoints = agenda.key_points || [];
      const clarifications = agenda.important_clarifications || [];

      html += `<div style="margin-bottom:24px;">`;
      html += `<h2 style="margin:0 0 10px 0; font-size:13pt; font-weight:700; color:#1a1a1a;">${idx + 1}. ${agendaTitle}</h2>`;

      if (keyPoints.length > 0) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt;">Key Points:</p>`;
        html += `<ul style="margin:4px 0 12px 24px; padding:0;">`;
        keyPoints.forEach((pt) => {
          html += `<li style="margin-bottom:5px; font-size:11pt;">${pt}</li>`;
        });
        html += `</ul>`;
      }

      if (clarifications.length > 0) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt;">Important Clarifications:</p>`;
        html += `<ul style="margin:4px 0 12px 24px; padding:0;">`;
        clarifications.forEach((c) => {
          html += `<li style="margin-bottom:5px; font-size:11pt;">${c}</li>`;
        });
        html += `</ul>`;
      }

      html += `</div>`;
    });

    // Next meeting (if applicable)
    if (nextMeeting) {
      html += `<div style="margin-top:12px; padding:8px 0;">`;
      html += `<p style="font-size:11pt;"><strong>Next Meeting:</strong> ${typeof nextMeeting === "string" ? nextMeeting : (nextMeeting.date ? nextMeeting.date + (nextMeeting.time ? " at " + nextMeeting.time : "") : JSON.stringify(nextMeeting))}</p>`;
      html += `</div>`;
    }

    // BOTTOM: Prepared by
    html += `<div style="border-top:2px solid #333; margin-top:32px; padding-top:16px;">`;
    html += `<p style="font-size:11pt;"><strong>Prepared by:</strong> ${preparedBy}</p>`;
    html += `</div>`;

    html += `</div>`;
    return html;
  }

  // ─── Cornell Notes format (Reviewer — default) ─────────────────
  const title = s.title || "Untitled";
  const recordDate = meta.date ? new Date(meta.date).toLocaleDateString() : new Date().toLocaleDateString();
  const keyConcepts = s.key_concepts || s.cue_questions || [];
  const notes = s.notes || [];
  const summaryArr = Array.isArray(s.summary) ? s.summary : (s.summary ? [s.summary] : []);

  let html = `<div style="${pageStyle}">`;

  // TOP ROW: Date (left) | Title (right) — separated by border
  html += `<table style="width:100%; border-collapse:collapse; margin:0;">`;
  html += `<tr>`;
  html += `<td style="padding:14px 16px; width:35%; text-align:left; vertical-align:middle; font-size:11pt; color:#444; border-bottom:2px solid #333;"><strong>Date:</strong> ${recordDate}</td>`;
  html += `<td style="padding:14px 16px; width:65%; text-align:right; vertical-align:middle; font-size:16pt; font-weight:700; color:#5b21b6; border-bottom:2px solid #333;">${title}</td>`;
  html += `</tr>`;
  html += `</table>`;

  // MIDDLE: Key Concepts (left, narrower) | Notes (right, wider)
  html += `<table style="width:100%; border-collapse:collapse; margin:0;">`;
  html += `<tr>`;

  // Key Concepts column — left
  html += `<td style="width:35%; vertical-align:top; padding:16px; border-right:2px solid #333;">`;
  html += `<p style="font-weight:700; font-size:11pt; color:#5b21b6; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Key Concepts</p>`;
  if (keyConcepts.length > 0) {
    html += `<ul style="margin:0; padding:0 0 0 18px; list-style-type:disc;">`;
    keyConcepts.forEach((concept) => {
      html += `<li style="margin-bottom:8px; font-size:11pt; color:#333;">${concept}</li>`;
    });
    html += `</ul>`;
  }
  html += `</td>`;

  // Notes column — right (wider)
  html += `<td style="width:65%; vertical-align:top; padding:16px;">`;
  html += `<p style="font-weight:700; font-size:11pt; color:#5b21b6; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Notes</p>`;
  if (Array.isArray(notes) && notes.length > 0) {
    notes.forEach((note) => {
      if (typeof note === "object" && note !== null) {
        // Structured note: term / definition / example
        html += `<div style="margin-bottom:16px;">`;
        if (note.term) html += `<p style="margin:0 0 3px 0; font-weight:700; font-size:11pt; color:#1a1a1a;">${note.term}</p>`;
        if (note.definition) html += `<p style="margin:0 0 3px 0; font-size:11pt; color:#333;">${note.definition}</p>`;
        if (note.example) html += `<p style="margin:0; font-size:10pt; color:#666; font-style:italic;">Example: ${note.example}</p>`;
        html += `</div>`;
      } else {
        html += `<p style="margin:0 0 10px 0; font-size:11pt; color:#333;">${note}</p>`;
      }
    });
  }
  html += `</td>`;

  html += `</tr>`;
  html += `</table>`;

  // BOTTOM: Summary (full width) — separated by border
  html += `<div style="border-top:2px solid #333; padding:16px 0;">`;
  html += `<p style="font-weight:700; font-size:11pt; color:#5b21b6; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">Summary</p>`;
  if (summaryArr.length > 0) {
    html += `<ul style="margin:0; padding:0 0 0 18px;">`;
    summaryArr.forEach((point) => {
      html += `<li style="margin-bottom:6px; font-size:11pt; color:#333;">${point}</li>`;
    });
    html += `</ul>`;
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}

export default function ReviewerEditorPage() {
  const router = useRouter();
  const params = useParams();
  const classCode = params.classCode;
  const reviewerId = params.reviewerId;
  
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [tinymceReady, setTinymceReady] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [contentLoaded, setContentLoaded] = useState(false);
  const [reviewer, setReviewer] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const editorRef = useRef(null);
  const contentInitialized = useRef(false);
  const initialContentRef = useRef("");
  const isTyping = useRef(false);

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    }
  }, []);

  // Fetch transcription data from API and render summaryJson as editable HTML
  useEffect(() => {
    const loadDocument = async () => {
      try {
        // Check localStorage first for user edits
        const savedContent = localStorage.getItem(`reviewer-${classCode}-${reviewerId}`);
        if (savedContent) {
          initialContentRef.current = savedContent;
          setEditorContent(savedContent);
          setContentLoaded(true);
        }

        // Fetch transcription data from API
        const response = await fetch(`/api/students/transcriptions/${reviewerId}`);
        if (!response.ok) {
          throw new Error(`Failed to load transcription: ${response.status}`);
        }
        const data = await response.json();
        const transcription = data.transcription;
        setReviewer(transcription);

        // If no saved content, render summaryJson as initial HTML
        if (!savedContent) {
          const html = summaryJsonToHtml(transcription.summaryJson, transcription);
          initialContentRef.current = html;
          setEditorContent(html);
          setContentLoaded(true);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading document:", err);
        setFetchError(err.message);
        setEditorContent(`
          <h1>Welcome to the Reviewer Editor</h1>
          <p>Start typing to create your document...</p>
          <p style="color: red;"><strong>Error: ${err.message}</strong></p>
        `);
        setLoading(false);
      }
    };

    loadDocument();
  }, [classCode, reviewerId]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("Saving...");
    
    try {
      localStorage.setItem(`reviewer-${classCode}-${reviewerId}`, editorContent);
      
      // TODO: Backend Integration
      // await fetch('http://your-backend-url/api/reviewers/save', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     classCode,
      //     reviewerId,
      //     content: editorContent,
      //     format: 'html'
      //   })
      // });
      
      setSaveStatus("✓ Saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus("✗ Error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Build a temporary container with the editor content
      const container = document.createElement('div');
      container.innerHTML = editorContent;
      container.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      container.style.fontSize = '12pt';
      container.style.lineHeight = '1.7';
      container.style.color = '#1a1a1a';
      container.style.textAlign = 'justify';
      container.style.maxWidth = '210mm';
      container.style.margin = '0 auto';

      const filename = `${(reviewer?.title || 'reviewer').replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;

      const opt = {
        margin: [15, 15, 15, 15],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      await html2pdf().set(opt).from(container).save();

      // Track the download for achievements
      try {
        await fetch('/api/students/track-download', { method: 'POST' });
      } catch (e) {
        // Non-critical, don't block download
        console.log('Download tracking failed:', e);
      }
    } catch (error) {
      console.error('PDF download error:', error);
      setModalInfo({ isOpen: true, title: "PDF Error", message: "Failed to generate PDF. Please try again.", type: "error" });
    }
  };

  if (!loading && !reviewer && fetchError) {
    return (
      <div className="reviewer-editor-container">
        <div className="error-message">
          <h2>Reviewer not found</h2>
          <p>{fetchError}</p>
          <button onClick={() => router.push(`/student/documents/${classCode}`)}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`reviewer-editor-container ${darkMode ? 'dark-mode' : ''}`}>
      {(loading || !tinymceReady) && <LoadingScreen />}
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn back-btn" onClick={() => router.back()}>
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <div className="document-title">
            <h2>{reviewer?.title || 'Loading...'}</h2>
            <div className="document-info">{reviewer?.class?.subject || classCode} • Editable Document</div>
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

      {/* Editor */}
      <div className="editor-content">
        {!loading && (
          <div className="tinymce-wrapper">
            <Editor
              key={contentLoaded ? 'loaded' : 'loading'}
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              initialValue={initialContentRef.current || "<p>Loading content...</p>"}
              onInit={(evt, editor) => {
                editorRef.current = editor;
                contentInitialized.current = true;
                setTinymceReady(true);
              }}
              onEditorChange={(content) => {
                isTyping.current = true;
                setEditorContent(content);
              }}
              init={{
                height: 700,
                width: '100%',
                menubar: false,
                promotion: false,
                license_key: 'gpl',
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                  'anchor', 'searchreplace', 'visualblocks', 'code',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist | table | removeformat',
                table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablecellprops tablemergecells tablesplitcells',
                content_style: `
                  body {
                    font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 12pt;
                    line-height: 1.7;
                    color: #1a1a1a;
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 20mm 18mm;
                    text-align: justify;
                    box-sizing: border-box;
                  }
                  table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0;
                    table-layout: fixed;
                  }
                  table td, table th {
                    padding: 14px 16px;
                    vertical-align: top;
                    text-align: justify;
                  }
                  h1, h2, h3 { color: #1a1a1a; }
                  ul { margin: 4px 0 12px 24px; padding: 0; }
                  li { margin-bottom: 5px; }
                  p { margin: 0 0 8px 0; }
                `,
                skin: darkMode ? 'oxide-dark' : 'oxide',
                content_css: darkMode ? 'dark' : 'default',
                branding: false,
                resize: false,
                statusbar: true,
                table_default_attributes: {
                  border: '0'
                },
                table_default_styles: {
                  'border-collapse': 'collapse',
                  'width': '100%'
                }
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
