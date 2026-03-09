"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Editor } from "@tinymce/tinymce-react";
import { 
  FaMoon, FaSun, FaArrowLeft, FaDownload, FaSave
} from "react-icons/fa";
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

  // Simplified page style: font and text color are now handled globally by TinyMCE
  const pageStyle = `max-width:210mm; margin:0 auto; padding:20mm 18mm; text-align:justify;`;

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

    // Table-based MOTM layout with borders
    html += `<table style="width:100%; border-collapse:collapse; border:1px solid var(--border-color);">`;

    // Purple header row
    html += `<tr>`;
    html += `<td colspan="2" style="background:#7c3aed; color:#ffffff; text-align:center; padding:16px; border:1px solid var(--border-color);">`;
    html += `<h1 style="margin:0 0 8px 0; font-size:18pt; font-weight:700; color:#ffffff;">${meetingTitle}</h1>`;
    html += `<p style="margin:3px 0; font-size:11pt; color:#f0e6ff;">Date: ${date} &nbsp;|&nbsp; Time: ${time}</p>`;
    html += `</td>`;
    html += `</tr>`;

    // Agendas
    agendas.forEach((agenda, idx) => {
      const agendaTitle = agenda.title || `Agenda ${idx + 1}`;
      const keyPoints = agenda.key_points || [];
      const clarifications = agenda.important_clarifications || [];

      html += `<tr>`;
      html += `<td colspan="2" style="padding:16px; border:1px solid var(--border-color); text-align:justify;">`;
      html += `<h2 style="margin:0 0 10px 0; font-size:13pt; font-weight:700; color:var(--accent-color);">${idx + 1}. ${agendaTitle}</h2>`;

      if (keyPoints.length > 0) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt; color:var(--text-main);">Key Points:</p>`;
        html += `<ul style="margin:4px 0 12px 24px; padding:0; color:var(--text-main);">`;
        keyPoints.forEach((pt) => {
          html += `<li style="margin-bottom:5px; font-size:11pt; text-align:justify;">${pt}</li>`;
        });
        html += `</ul>`;
      }

      if (clarifications.length > 0) {
        html += `<p style="margin:8px 0 4px 0; font-weight:600; font-size:11pt; color:var(--text-main);">Important Clarifications:</p>`;
        html += `<ul style="margin:4px 0 12px 24px; padding:0; color:var(--text-main);">`;
        clarifications.forEach((c) => {
          html += `<li style="margin-bottom:5px; font-size:11pt; text-align:justify;">${c}</li>`;
        });
        html += `</ul>`;
      }

      html += `</td>`;
      html += `</tr>`;
    });

    // Next meeting row
    if (nextMeeting) {
      html += `<tr>`;
      html += `<td colspan="2" style="padding:12px 16px; border:1px solid var(--border-color); text-align:justify;">`;
      html += `<p style="font-size:11pt; margin:0; color:var(--text-main);"><strong>Next Meeting:</strong> ${typeof nextMeeting === "string" ? nextMeeting : (nextMeeting.date ? nextMeeting.date + (nextMeeting.time ? " at " + nextMeeting.time : "") : JSON.stringify(nextMeeting))}</p>`;
      html += `</td>`;
      html += `</tr>`;
    }

    // Prepared by row
    html += `<tr>`;
    html += `<td colspan="2" style="padding:12px 16px; border:1px solid var(--border-color); text-align:right;">`;
    html += `<p style="font-size:11pt; margin:0; color:var(--text-main);"><strong>Prepared by:</strong> ${preparedBy}</p>`;
    html += `</td>`;
    html += `</tr>`;

    html += `</table>`;
    html += `</div>`;
    return html;
  }

  // ─── Cornell Notes format (Reviewer — default) ─────────────────
  const topicTitle = s.title || "Untitled";
  const dateObj = meta.date ? new Date(meta.date) : (meta.createdAt ? new Date(meta.createdAt) : new Date());
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const yy = String(dateObj.getFullYear()).slice(2);
  const formattedDate = `${mm}-${dd}-${yy}`;
  const courseCode = meta.class?.subject || meta.course || meta.classCode || '';
  const recordDate = dateObj.toLocaleDateString();
  const keyConcepts = s.key_concepts || s.cue_questions || [];
  const notes = s.notes || [];
  const summaryArr = Array.isArray(s.summary) ? s.summary
    : (s.summary ? [s.summary]
    : (Array.isArray(s.takeaways) ? s.takeaways
    : (s.takeaways ? [s.takeaways] : [])));

  let html = `<div style="${pageStyle}">`;

  // Header table with purple background and white text
  html += `<table style="width:100%; border-collapse:collapse; border:1px solid var(--border-color);">`;
  html += `<tr>`;
  html += `<td style="padding:14px 16px; width:35%; text-align:left; vertical-align:middle; font-size:11pt; color:#ffffff; background:#7c3aed; border:1px solid var(--border-color);"><strong>Date:</strong> ${recordDate}</td>`;
  html += `<td style="padding:14px 16px; width:65%; text-align:right; vertical-align:middle; font-size:16pt; font-weight:700; color:#ffffff; background:#7c3aed; border:1px solid var(--border-color);">${topicTitle}</td>`;
  html += `</tr>`;
  html += `</table>`;

  // Main content table with borders
  html += `<table style="width:100%; border-collapse:collapse; border:1px solid var(--border-color); page-break-inside:auto;">`;
  html += `<tr>`;

  html += `<td style="width:35%; vertical-align:top; padding:16px; border:1px solid var(--border-color);">`;
  html += `<p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Key Concepts</p>`;
  if (keyConcepts.length > 0) {
    html += `<ul style="margin:0; padding:0 0 0 18px; list-style-type:disc; color:var(--text-main);">`;
    keyConcepts.forEach((concept) => {
      html += `<li style="margin-bottom:8px; font-size:11pt;">${concept}</li>`;
    });
    html += `</ul>`;
  }
  html += `</td>`;

  html += `<td style="width:65%; vertical-align:top; padding:16px; border:1px solid var(--border-color);">`;
  html += `<p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;">Notes</p>`;
  if (Array.isArray(notes) && notes.length > 0) {
    notes.forEach((note) => {
      if (typeof note === "object" && note !== null) {
        html += `<div style="margin-bottom:16px;">`;
        if (note.term) html += `<p style="margin:0 0 3px 0; font-weight:700; font-size:11pt; color:var(--text-main);">${note.term}</p>`;
        if (note.definition) html += `<p style="margin:0 0 3px 0; font-size:11pt; color:var(--text-main);">${note.definition}</p>`;
        if (note.example) html += `<p style="margin:0; font-size:10pt; color:var(--text-muted); font-style:italic;">Example: ${note.example}</p>`;
        html += `</div>`;
      } else {
        html += `<p style="margin:0 0 10px 0; font-size:11pt; color:var(--text-main);">${note}</p>`;
      }
    });
  }
  html += `</td>`;

  html += `</tr>`;

  // Summary row (inside same table, with border)
  html += `<tr>`;
  html += `<td colspan="2" style="padding:16px; border:1px solid var(--border-color);">`;
  html += `<p style="font-weight:700; font-size:11pt; color:var(--accent-color); margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">Summary</p>`;
  if (summaryArr.length > 0) {
    html += `<ul style="margin:0; padding:0 0 0 18px; color:var(--text-main);">`;
    summaryArr.forEach((point) => {
      html += `<li style="margin-bottom:6px; font-size:11pt;">${point}</li>`;
    });
    html += `</ul>`;
  } else {
    html += `<p style="font-size:11pt; color:var(--text-muted); font-style:italic;">Summary pending — will appear once fully generated.</p>`;
  }
  html += `</td>`;
  html += `</tr>`;

  html += `</table>`;

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
          const html = summaryJsonToHtml(transcription.summaryJson, { ...transcription, classCode });
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
      const html2pdf = (await import("html2pdf.js")).default;

      // Build a temporary container with the editor content
      const container = document.createElement('div');
      
      // 1. INJECT LIGHT MODE VARIABLES: 
      // This forces the PDF snapshot to always use your light theme colors,
      // regardless of whether the app is currently in dark mode.
      const printStyles = `
        <style>
          .pdf-export-wrapper {
            --text-main: #1a1a1a;
            --text-muted: #666666;
            --border-color: #333333;
            --accent-color: #5b21b6;
            background-color: #ffffff;
          }
          /* Ensure tables retain their borders in the PDF */
          .pdf-export-wrapper table {
            border-collapse: collapse;
            width: 100%;
            table-layout: fixed;
          }
          .pdf-export-wrapper table td, .pdf-export-wrapper table th {
            padding: 14px 16px;
            border: 1px solid var(--border-color);
          }
          /* Key concepts start on front page - avoid page break before main table */
          .pdf-export-wrapper table tr {
            page-break-inside: avoid;
          }
        </style>
      `;

      // Wrap the content so the CSS variables apply correctly
      container.innerHTML = printStyles + `<div class="pdf-export-wrapper">${editorContent}</div>`;
      
      container.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      container.style.fontSize = '12pt';
      container.style.lineHeight = '1.7';
      container.style.color = '#1a1a1a';
      container.style.backgroundColor = '#ffffff'; // Force white background on the container
      container.style.textAlign = 'justify';
      container.style.maxWidth = '210mm';
      container.style.margin = '0 auto';

      const revDateObj = reviewer?.date ? new Date(reviewer.date) : (reviewer?.createdAt ? new Date(reviewer.createdAt) : new Date());
      const revMm = String(revDateObj.getMonth() + 1).padStart(2, '0');
      const revDd = String(revDateObj.getDate()).padStart(2, '0');
      const revYy = String(revDateObj.getFullYear()).slice(2);
      const revDateStr = `${revMm}-${revDd}-${revYy}`;
      const revCourse = reviewer?.class?.subject || reviewer?.course || classCode || '';
      const revTopic = reviewer?.title || 'reviewer';
      const sanitize = (str) => str.replace(/ /g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = revCourse
        ? `${sanitize(revCourse)}_${sanitize(revTopic)}_${revDateStr}.pdf`
        : `${sanitize(revTopic)}_${revDateStr}.pdf`;

      const opt = {
        margin: [5, 5, 5, 5], // top, left, bottom, right
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        // 2. FORCE WHITE BACKGROUND: Ensure html2canvas doesn't render transparent pages
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
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
              // 1. COMBINED KEY: Forces re-mount when content loads OR theme changes
              key={contentLoaded ? (darkMode ? 'loaded-dark' : 'loaded-light') : 'loading'}
              
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
                
                // 2. DYNAMIC STYLES: Define the variables at the root level
                content_style: `
                  :root {
                    --text-main: ${darkMode ? '#e8e8e8' : '#1a1a1a'};
                    --text-muted: ${darkMode ? '#a0a0a0' : '#666666'};
                    --border-color: ${darkMode ? '#4c4172' : '#333333'};
                    --accent-color: ${darkMode ? '#c5a6f9' : '#5b21b6'};
                  }
                  
                  body {
                    font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 12pt;
                    line-height: 1.7;
                    color: var(--text-main); 
                    background-color: ${darkMode ? '#1a1625' : '#ffffff'};
                  }

                  /* FIX 1: Aggressively target the wrapper DIV to ensure it fits */
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
                  }
                  
                  h1, h2, h3 { color: var(--text-main); }
                  ul { margin: 4px 0 12px 24px; padding: 0; }
                  li { margin-bottom: 5px; }
                  p { margin: 0 0 8px 0; }

                  /* FIX 2: MOBILE RESPONSIVE OVERRIDES */
                  @media (max-width: 600px) {
                    /* Crush the massive 20mm 18mm inline padding on the div */
                    body > div {
                      padding: 12px !important;
                    }
                    
                    /* Force ALL table elements to become block elements so they stack vertically */
                    table, thead, tbody, th, td, tr {
                      display: block !important;
                      width: 100% !important;
                      box-sizing: border-box !important;
                    }
                    
                    table td, table th {
                      padding: 14px !important;
                      border-bottom: none !important; /* Remove middle borders to look cleaner */
                      font-size: 11pt;
                    }
                    
                    /* Keep the bottom border for the last item in the stacked row */
                    table td:last-child {
                      border-bottom: 1px solid var(--border-color) !important;
                    }
                    
                    /* Fix the right-aligned title header */
                    td[style*="text-align:right"] {
                      text-align: left !important;
                    }
                  }
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