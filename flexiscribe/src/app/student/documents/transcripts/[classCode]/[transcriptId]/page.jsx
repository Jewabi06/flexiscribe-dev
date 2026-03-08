"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  FaMoon, FaSun, FaArrowLeft, FaDownload, FaExpand, 
  FaCompress, FaSearchPlus, FaSearchMinus
} from "react-icons/fa";
import "./styles.css";

/**
 * Convert transcriptJson chunks to readable HTML
 */
function transcriptJsonToHtml(transcriptJson, isDark = false) {
  if (!transcriptJson) return "<p>No transcript data available.</p>";

  const data = typeof transcriptJson === "string" ? JSON.parse(transcriptJson) : transcriptJson;
  const chunks = data.chunks || data;

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return "<p>No transcript chunks available.</p>";
  }

  // Dynamic colors based on theme
  const bgColor = isDark ? "#2d2640" : "#faf5ff"; 
  const textColor = isDark ? "#e8e8e8" : "#1a1a1a";
  const headingColor = isDark ? "#c5a6f9" : "#7c3aed";
  const borderColor = isDark ? "#c5a6f9" : "#7c3aed";
  const mainTitleColor = isDark ? "#c5a6f9" : "#5b21b6";

  let html = '<div class="transcript-chunks">';
  html += `<h1 style="text-align:center; color:${mainTitleColor}; margin-bottom:24px;">Lecture Transcript</h1>`;

  chunks.forEach((chunk) => {
    const timestamp = chunk.timestamp || "";
    const text = chunk.text || "";

    html += `<div style="margin-bottom:16px; padding:12px 16px; border-left:4px solid ${borderColor}; background:${bgColor}; border-radius:0 8px 8px 0; transition: background 0.3s ease;">`;
    if (timestamp) {
      html += `<div style="font-size:12px; font-weight:700; color:${headingColor}; margin-bottom:4px;">[${timestamp}]</div>`;
    }
    html += `<div style="font-size:15px; line-height:1.7; color:${textColor};">${text}</div>`;
    html += `</div>`;
  });

  html += '</div>';
  return html;
}

export default function TranscriptViewerPage() {
  const router = useRouter();
  const params = useParams();
  const { classCode, transcriptId } = params;
  
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const contentRef = useRef(null);
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const [touchStartScale, setTouchStartScale] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark-mode");
    }
  }, []);

  // Re-generate the HTML instantly whenever dark mode is toggled
  useEffect(() => {
    if (transcript) {
      setHtmlContent(transcriptJsonToHtml(transcript.transcriptJson, darkMode));
    }
  }, [darkMode, transcript]);

  // Cleanup on unmount - exit fullscreen if active
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
      }
    };
  }, []);

  // Listen for fullscreen changes (ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const loadTranscript = async () => {
      try {
        setLoading(true);
        // Use the transcriptId as the ID parameter for the API
        const response = await fetch(`/api/students/transcriptions/${transcriptId}`);
        
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Access denied. You are not enrolled in this class.");
          } else if (response.status === 404) {
            throw new Error("Transcript not found.");
          }
          throw new Error(`Failed to load transcript: ${response.status}`);
        }
        
        const data = await response.json();
        const transcription = data.transcription;
        setTranscript(transcription);

        const html = transcriptJsonToHtml(transcription.transcriptJson);
        setHtmlContent(html);
        setLoading(false);
      } catch (err) {
        console.error("Error loading transcript:", err);
        setError(err.message || "Failed to load transcript data.");
        setLoading(false);
      }
    };

    if (transcriptId) {
      loadTranscript();
    }
  }, [transcriptId]);

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };

  const handleDownload = async () => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      
      const container = document.createElement("div");
      
      // Always generate a Light Mode version specifically for the PDF export
      const pdfHtml = transcriptJsonToHtml(transcript.transcriptJson, false);
      container.innerHTML = pdfHtml;
      
      container.style.fontFamily = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      container.style.fontSize = "12pt";
      container.style.lineHeight = "1.7";
      container.style.color = "#1a1a1a";
      container.style.backgroundColor = "#ffffff"; // Force white background
      container.style.textAlign = "justify";
      container.style.maxWidth = "210mm";
      container.style.margin = "0 auto";

      const revDateObj = transcript?.date ? new Date(transcript.date) : (transcript?.createdAt ? new Date(transcript.createdAt) : new Date());
      const revMm = String(revDateObj.getMonth() + 1).padStart(2, '0');
      const revDd = String(revDateObj.getDate()).padStart(2, '0');
      const revYy = String(revDateObj.getFullYear()).slice(2);
      const revDateStr = `${revMm}-${revDd}-${revYy}`;
      const revCourse = transcript?.class?.subject || transcript?.course || classCode || '';
      const revTopic = transcript?.title || 'transcript';
      const sanitize = (str) => str.replace(/ /g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = revCourse
        ? `${sanitize(revCourse)}_${sanitize(revTopic)}_${revDateStr}.pdf`
        : `${sanitize(revTopic)}_${revDateStr}.pdf`;

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10], // Reduced margins for better fit
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, 
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(container)
        .save();

      fetch("/api/students/track-download", { method: "POST" }).catch(() => {});
    } catch (err) {
      console.error("Error downloading PDF:", err);
    }
  };

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      contentRef.current?.requestFullscreen().catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error("Error exiting fullscreen:", err);
      });
    }
  };

  // Touch events for pinch-to-zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setLastTouchDistance(distance);
      setTouchStartScale(scale);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && lastTouchDistance && touchStartScale) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scaleFactor = distance / lastTouchDistance;
      const newScale = Math.max(0.5, Math.min(touchStartScale * scaleFactor, 3.0));
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      setLastTouchDistance(null);
      setTouchStartScale(null);
    }
  };

  // COURSE CODE: from the transcript.course field (e.g., "CS101", "MATH202")
  const courseCode = transcript?.course || "N/A";
  
  // CLASS CODE: from URL parameter (the enrollment code)
  const enrollmentCode = classCode || "N/A";

  if (!loading && !transcript && error) {
    return (
      <div className="docx-viewer-container">
        <div className="error-message">
          <h2>Transcript not found</h2>
          <p>{error}</p>
          <button onClick={() => router.push(`/student/documents/transcripts/${classCode || ''}`)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`docx-viewer-container ${darkMode ? "dark-mode" : ""}`}>
      {/* Toolbar */}
      <div className="docx-toolbar">
        <div className="toolbar-left">
          <button className="back-btn" onClick={() => router.push(`/student/documents/transcripts/${classCode || ''}`)}>
            <FaArrowLeft className="back-icon" />
            <span>Back</span>
          </button>
          
          <div className="document-title">
            <h2>{transcript?.title || 'Loading...'}</h2>
            <div className="document-info">
              <span className="info-badge">{courseCode}</span>
              {transcript?.duration && <span>{transcript.duration}</span>}
              {transcript?.date && <span>{new Date(transcript.date).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>

        <div className="toolbar-right">
          <button className="toolbar-btn" onClick={toggleDarkMode} title={darkMode ? "Light Mode" : "Dark Mode"}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
          <button className="toolbar-btn" onClick={handleDownload} title="Download">
            <FaDownload />
          </button>
          <button className="toolbar-btn" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button 
          className="zoom-btn" 
          onClick={handleZoomIn} 
          disabled={scale >= 3.0}
          title="Zoom In"
        >
          <FaSearchPlus />
        </button>
        <div className="zoom-level">{Math.round(scale * 100)}%</div>
        <button 
          className="zoom-btn" 
          onClick={handleZoomOut} 
          disabled={scale <= 0.5}
          title="Zoom Out"
        >
          <FaSearchMinus />
        </button>
      </div>

      {/* Document Content */}
      <div 
        className="docx-content-wrapper" 
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="docx-document-wrapper">
          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading document...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <p>{error}</p>
            </div>
          ) : (
            <div 
              className="docx-content"
              style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}