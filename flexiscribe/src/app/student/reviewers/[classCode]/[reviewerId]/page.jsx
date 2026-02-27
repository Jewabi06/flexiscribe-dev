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
 * Convert summaryJson (Cornell Notes) to editable HTML for TinyMCE
 */
function summaryJsonToHtml(summaryJson) {
  if (!summaryJson) return "<p>No summary data available.</p>";

  const s = typeof summaryJson === "string" ? JSON.parse(summaryJson) : summaryJson;
  const title = s.title || "Untitled";
  const cueQuestions = s.cue_questions || [];
  const notes = s.notes || [];
  const summary = s.summary || "";

  let html = `<table style="width:100%; border-collapse:collapse; margin:20px 0;">`;
  html += `<tr><td colspan="2" style="border:2px solid #5b21b6; padding:12px; background:linear-gradient(135deg,#7c3aed,#5b21b6); color:white; font-weight:700; font-size:18px; text-align:center;">${title}</td></tr>`;
  html += `<tr><td style="border:2px solid #5b21b6; padding:12px; width:30%; background:#f3f4f6; font-weight:700;">Cue Questions</td>`;
  html += `<td style="border:2px solid #5b21b6; padding:12px; width:70%; font-weight:700;">Notes</td></tr>`;

  const maxRows = Math.max(cueQuestions.length, notes.length);
  for (let i = 0; i < maxRows; i++) {
    const q = cueQuestions[i] || "";
    const n = notes[i] || "";
    html += `<tr>`;
    html += `<td style="border:2px solid #5b21b6; padding:12px; width:30%; background:#f3f4f6;">${q}</td>`;
    html += `<td style="border:2px solid #5b21b6; padding:12px; width:70%;">${n}</td>`;
    html += `</tr>`;
  }

  html += `<tr><td colspan="2" style="border:2px solid #5b21b6; padding:12px; background:#fefce8;"><strong>Summary:</strong><br/>${summary}</td></tr>`;
  html += `</table>`;
  return html;
}

export default function ReviewerEditorPage() {
  const router = useRouter();
  const params = useParams();
  const classCode = params.classCode;
  const reviewerId = params.reviewerId;
  
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
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
          const html = summaryJsonToHtml(transcription.summaryJson);
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
      container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      container.style.fontSize = '14px';
      container.style.lineHeight = '1.6';
      container.style.color = '#1a1a1a';
      container.style.padding = '20px';

      const filename = `${(reviewer?.title || 'reviewer').replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;

      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
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
          <button onClick={() => router.push(`/student/reviewers/${classCode}`)}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`reviewer-editor-container ${darkMode ? 'dark-mode' : ''}`}>
      {loading && <LoadingScreen />}
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
                console.log("TinyMCE initialized, editor ready");
                console.log("Content loaded:", contentLoaded, "Content length:", initialContentRef.current?.length || 0);
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
                toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright | bullist numlist | table | removeformat',
                table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablecellprops tablemergecells tablesplitcells',
                content_style: `
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    color: #1a1a1a;
                    padding: 20px;
                  }
                  table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 20px 0;
                    table-layout: fixed;
                  }
                  table td, table th {
                    border: 2px solid #5b21b6;
                    padding: 12px;
                    vertical-align: top;
                  }
                  table tr:first-child td, table tr:first-child th {
                    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
                    color: white;
                    font-weight: 700;
                  }
                  table td[style*="width: 30%"] {
                    background: #f3f4f6;
                    width: 30%;
                  }
                  table td[style*="width: 70%"] {
                    background: #white;
                    width: 70%;
                  }
                  table td[colspan] {
                    background: #fefce8;
                  }
                `,
                skin: darkMode ? 'oxide-dark' : 'oxide',
                content_css: darkMode ? 'dark' : 'default',
                branding: false,
                resize: false,
                statusbar: true,
                table_default_attributes: {
                  border: '2'
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
