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
function transcriptJsonToHtml(transcriptJson) {
  if (!transcriptJson) return "<p>No transcript data available.</p>";

  const data = typeof transcriptJson === "string" ? JSON.parse(transcriptJson) : transcriptJson;
  const chunks = data.chunks || data;

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return "<p>No transcript chunks available.</p>";
  }

  let html = '<div class="transcript-chunks">';
  html += '<h1 style="text-align:center; color:#5b21b6; margin-bottom:24px;">Lecture Transcript</h1>';

  chunks.forEach((chunk) => {
    const minute = chunk.minute ?? "";
    const timestamp = chunk.timestamp || "";
    const text = chunk.text || "";

    html += `<div style="margin-bottom:16px; padding:12px 16px; border-left:4px solid #7c3aed; background:#faf5ff; border-radius:0 8px 8px 0;">`;
    html += `<div style="font-size:12px; font-weight:700; color:#7c3aed; margin-bottom:4px;">`;
    html += `Minute ${minute}${timestamp ? ` — ${timestamp}` : ""}`;
    html += `</div>`;
    html += `<div style="font-size:15px; line-height:1.7; color:#1a1a1a;">${text}</div>`;
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
        const response = await fetch(`/api/students/transcriptions/${transcriptId}`);
        if (!response.ok) {
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
        setError("Failed to load transcript data.");
        setLoading(false);
      }
    };

    loadTranscript();
  }, [transcriptId]);

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${transcript?.title || "transcript"}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Track the download for achievements
      fetch('/api/students/track-download', { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.error("Error downloading file:", err);
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

  if (!loading && !transcript && error) {
    return (
      <div className="docx-viewer-container">
        <div className="error-message">
          <h2>Transcript not found</h2>
          <p>{error}</p>
          <button onClick={() => router.push(`/student/reviewers/transcripts/${classCode}`)}>
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
          <button className="back-btn" onClick={() => router.push(`/student/reviewers/transcripts/${classCode}`)}>
            <FaArrowLeft className="back-icon" />
            <span>Back</span>
          </button>
          
          <div className="document-title">
            <h2>{transcript?.title || 'Loading...'}</h2>
            <div className="document-info">
              <span className="info-badge">{classCode}</span>
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
