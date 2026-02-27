"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import { 
  FaMoon, FaSun, FaArrowLeft, FaDownload, FaSearchPlus, FaSearchMinus, 
  FaChevronLeft, FaChevronRight, FaHighlighter, FaStickyNote,
  FaFont, FaEraser, FaSave, FaExpand, FaCompress, FaEyeSlash, FaEye
} from "react-icons/fa";
import { mockReviewersByClass } from "../../../dashboard/mockData";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "./styles.css";

// PDF.js options - defined outside component to prevent recreation
const pdfOptions = {
  cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

export default function PDFViewerPage() {
  const router = useRouter();
  const params = useParams();
  const classCode = params.classCode;
  const reviewerId = params.reviewerId;
  
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showEditToolbar, setShowEditToolbar] = useState(true);
  const [textBoxPosition, setTextBoxPosition] = useState(null);
  const [textBoxPage, setTextBoxPage] = useState(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const [touchStartScale, setTouchStartScale] = useState(null);
  
  // Get reviewer data
  const reviewers = mockReviewersByClass[classCode] || [];
  const reviewer = reviewers.find(r => r.id === parseInt(reviewerId));

  // For demo purposes, we'll use a sample PDF URL
  // In production, this would come from your backend/storage
  const pdfUrl = "/sample.pdf"; // You'll need to add a sample PDF to your public folder

  // Set up PDF.js worker
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }, []);

  useEffect(() => {
    // Load saved annotations from localStorage
    const savedAnnotations = localStorage.getItem(`annotations-${classCode}-${reviewerId}`);
    if (savedAnnotations) {
      setAnnotations(JSON.parse(savedAnnotations));
    }
  }, [classCode, reviewerId]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.max(1, Math.min(newPage, numPages));
    });
  };

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };

  const handleDownload = () => {
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${reviewer?.title || 'document'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleToolSelect = (tool) => {
    setActiveTool(activeTool === tool ? null : tool);
    setTextBoxPosition(null);
  };

  const handleSaveAnnotations = () => {
    localStorage.setItem(`annotations-${classCode}-${reviewerId}`, JSON.stringify(annotations));
    alert('Annotations saved successfully!');
  };

  const handleClearAnnotations = () => {
    if (window.confirm('Are you sure you want to clear all annotations?')) {
      setAnnotations([]);
      localStorage.removeItem(`annotations-${classCode}-${reviewerId}`);
      setActiveTool(null);
    }
  };

  const handleAddNote = () => {
    const noteText = prompt('Enter your note:');
    if (noteText) {
      const newAnnotation = {
        id: Date.now(),
        type: 'note',
        page: pageNumber,
        text: noteText,
        timestamp: new Date().toISOString()
      };
      setAnnotations([...annotations, newAnnotation]);
    }
  };

  const handleTextSelection = (e, pageNum) => {
    if (activeTool !== 'highlight') return;
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const pageElement = e.currentTarget;
      const pageRect = pageElement.getBoundingClientRect();
      
      const newAnnotation = {
        id: Date.now(),
        type: 'highlight',
        page: pageNum,
        text: selectedText,
        position: {
          x: ((rect.left - pageRect.left) / pageRect.width) * 100,
          y: ((rect.top - pageRect.top) / pageRect.height) * 100,
          width: (rect.width / pageRect.width) * 100,
          height: (rect.height / pageRect.height) * 100
        },
        timestamp: new Date().toISOString()
      };
      
      setAnnotations([...annotations, newAnnotation]);
      selection.removeAllRanges();
    }
  };

  const handlePageClick = (e, pageNum) => {
    if (activeTool === 'text') {
      const pageElement = e.currentTarget;
      const rect = pageElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setTextBoxPosition({ x, y });
      setTextBoxPage(pageNum);
    } else if (activeTool === 'clear') {
      // Clear mode - clicking background does nothing
      return;
    }
  };

  const handleTextBoxSubmit = (text) => {
    if (text && textBoxPosition && textBoxPage) {
      const newAnnotation = {
        id: Date.now(),
        type: 'text',
        page: textBoxPage,
        text: text,
        position: textBoxPosition,
        timestamp: new Date().toISOString()
      };
      
      setAnnotations([...annotations, newAnnotation]);
      setTextBoxPosition(null);
      setTextBoxPage(null);
      setActiveTool(null);
    }
  };

  const handleDeleteAnnotation = (annotationId, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (activeTool === 'clear') {
      setAnnotations(annotations.filter(a => a.id !== annotationId));
    }
  };

  const handleAddText = () => {
    setActiveTool('text');
  };

  const handleTextMouseDown = (e, annotation, pageNum) => {
    if (activeTool === 'clear') return; // Don't drag in eraser mode
    
    e.stopPropagation();
    const pageElement = e.currentTarget.closest('.pdf-page-container');
    const rect = pageElement.getBoundingClientRect();
    
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDraggingAnnotation(annotation.id);
    setDragOffset({
      x: clickX - annotation.position.x,
      y: clickY - annotation.position.y
    });
  };

  const handleMouseMove = (e, pageNum) => {
    if (!draggingAnnotation) return;
    
    const pageElement = e.currentTarget;
    const rect = pageElement.getBoundingClientRect();
    
    const newX = ((e.clientX - rect.left) / rect.width) * 100 - dragOffset.x;
    const newY = ((e.clientY - rect.top) / rect.height) * 100 - dragOffset.y;
    
    // Clamp values to keep text within page bounds
    const clampedX = Math.max(0, Math.min(100, newX));
    const clampedY = Math.max(0, Math.min(100, newY));
    
    setAnnotations(annotations.map(ann => 
      ann.id === draggingAnnotation
        ? { ...ann, position: { ...ann.position, x: clampedX, y: clampedY } }
        : ann
    ));
  };

  const handleMouseUp = () => {
    if (draggingAnnotation) {
      setDraggingAnnotation(null);
      setDragOffset({ x: 0, y: 0 });
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

  if (!reviewer) {
    return (
      <div className="pdf-viewer-container">
        <div className="error-message">
          <h2>Reviewer not found</h2>
          <button onClick={() => router.push(`/student/reviewers/${classCode}`)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container">
      {/* Header Toolbar */}
      <div className="pdf-toolbar">
        <div className="toolbar-left">
          <button className="back-btn" onClick={() => router.push(`/student/reviewers/${classCode}`)}>
            <FaArrowLeft className="back-icon" />
            <span>Back</span>
          </button>
          <div className="document-title">
            <h2>{reviewer.title}</h2>
            <span className="document-info">{reviewer.subject} • {reviewer.fileSize}</span>
          </div>
        </div>

        <div className="toolbar-right">
          <button 
            className="toolbar-btn" 
            onClick={() => setShowEditToolbar(!showEditToolbar)} 
            title={showEditToolbar ? "Hide Annotation Toolbar" : "Show Annotation Toolbar"}
          >
            {showEditToolbar ? <FaEyeSlash /> : <FaEye />}
          </button>
          <button className="toolbar-btn" onClick={toggleDarkMode} title={darkMode ? "Light Mode" : "Dark Mode"}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
          <button className="toolbar-btn" onClick={handleDownload} title="Download PDF">
            <FaDownload />
          </button>
          <button className="toolbar-btn" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      {/* Edit Toolbar */}
      {showEditToolbar && (
      <div className="edit-toolbar">
        <div className="edit-tools">
          <button 
            className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`}
            onClick={() => handleToolSelect('highlight')}
            title="Highlight"
          >
            <FaHighlighter />
            <span>Highlight</span>
          </button>
          <button 
            className={`tool-btn ${activeTool === 'note' ? 'active' : ''}`}
            onClick={handleAddNote}
            title="Add Note"
          >
            <FaStickyNote />
            <span>Note</span>
          </button>
          <button 
            className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
            onClick={handleAddText}
            title="Add Text"
          >
            <FaFont />
            <span>Text</span>
          </button>
          <button 
            className="tool-btn"
            onClick={handleClearAnnotations}
            title="Clear All Annotations"
          >
            <FaEraser />
            <span>Clear All</span>
          </button>
          <button 
            className={`tool-btn ${activeTool === 'clear' ? 'active' : ''}`}
            onClick={() => handleToolSelect('clear')}
            title="Eraser Mode"
          >
            <FaEraser />
            <span>Eraser</span>
          </button>
          <button 
            className="tool-btn save-btn"
            onClick={handleSaveAnnotations}
            title="Save Annotations"
          >
            <FaSave />
            <span>Save</span>
          </button>
        </div>
      </div>
      )}

      {/* Main Content Area */}
      <div className="viewer-main-content">
        {/* Annotations Sidebar - Left Side */}
        {annotations.length > 0 && (
          <div className="annotations-sidebar">
            <h3>Annotations ({annotations.length})</h3>
            <div className="annotations-list">
              {annotations.map(annotation => (
                <div 
                  key={annotation.id} 
                  className="annotation-item"
                  onClick={() => setPageNumber(annotation.page)}
                >
                  <div className="annotation-header">
                    {annotation.type === 'note' && <FaStickyNote />}
                    {annotation.type === 'text' && <FaFont />}
                    {annotation.type === 'highlight' && <FaHighlighter />}
                    <span className="annotation-page">Page {annotation.page}</span>
                  </div>
                  <p className="annotation-text">{annotation.text}</p>
                  <button 
                    className="delete-annotation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnnotations(annotations.filter(a => a.id !== annotation.id));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* PDF Viewer Container */}
      <div className={`pdf-content ${activeTool ? `tool-active tool-${activeTool}` : ''}`}>
        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn} disabled={scale >= 3.0}>
            <FaSearchPlus />
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button className="zoom-btn" onClick={handleZoomOut} disabled={scale <= 0.5}>
            <FaSearchMinus />
          </button>
        </div>

        {/* PDF Document */}
        <div 
          className="pdf-document-wrapper"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            options={pdfOptions}
            loading={
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading PDF...</p>
              </div>
            }
            error={
              <div className="error-message">
                <p>Failed to load PDF. Please make sure a sample PDF exists in the public folder.</p>
                <p className="error-note">For demo: Add a file named "sample.pdf" to the public folder</p>
              </div>
            }
          >
            {/* Render all pages for scrolling */}
            {Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_${index + 1}`} 
                className="pdf-page-container"
                onMouseUp={(e) => handleTextSelection(e, index + 1)}
                onClick={(e) => handlePageClick(e, index + 1)}
                onMouseMove={(e) => handleMouseMove(e, index + 1)}
                onMouseUpCapture={handleMouseUp}
              >
                <Page 
                  pageNumber={index + 1} 
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="pdf-page"
                />
                <div className="page-number-label">Page {index + 1} of {numPages}</div>
                
                {/* Render Highlight Annotations */}
                {annotations
                  .filter(ann => ann.page === index + 1 && ann.type === 'highlight' && ann.position)
                  .map(annotation => (
                    <div 
                      key={annotation.id} 
                      className={`annotation-overlay highlight-overlay ${activeTool === 'clear' ? 'erasable' : ''}`}
                      style={{
                        left: `${annotation.position.x}%`,
                        top: `${annotation.position.y}%`,
                        width: `${annotation.position.width}%`,
                        height: `${annotation.position.height}%`,
                      }}
                      onClick={(e) => handleDeleteAnnotation(annotation.id, e)}
                      title={activeTool === 'clear' ? 'Click to erase' : annotation.text}
                    />
                  ))}
                
                {/* Render Text Annotations */}
                {annotations
                  .filter(ann => ann.page === index + 1 && ann.type === 'text' && ann.position)
                  .map(annotation => (
                    <div 
                      key={annotation.id} 
                      className={`annotation-overlay text-overlay ${activeTool === 'clear' ? 'erasable' : ''} ${draggingAnnotation === annotation.id ? 'dragging' : ''}`}
                      style={{
                        left: `${annotation.position.x}%`,
                        top: `${annotation.position.y}%`,
                      }}
                      onMouseDown={(e) => handleTextMouseDown(e, annotation, index + 1)}
                      onClick={(e) => {
                        if (activeTool === 'clear') {
                          handleDeleteAnnotation(annotation.id, e);
                        }
                      }}
                      title={activeTool === 'clear' ? 'Click to erase' : 'Drag to move'}
                    >
                      {annotation.text}
                    </div>
                  ))}
                
                {/* Text Box Input (when placing new text) */}
                {textBoxPosition && textBoxPage === index + 1 && (
                  <div 
                    className="text-box-input"
                    style={{
                      left: `${textBoxPosition.x}%`,
                      top: `${textBoxPosition.y}%`,
                    }}
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Enter text..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTextBoxSubmit(e.target.value);
                        } else if (e.key === 'Escape') {
                          setTextBoxPosition(null);
                          setTextBoxPage(null);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleTextBoxSubmit(e.target.value);
                        } else {
                          setTextBoxPosition(null);
                          setTextBoxPage(null);
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Annotations for sidebar (notes only) */}
                {annotations
                  .filter(ann => ann.page === index + 1 && ann.type === 'note')
                  .map(annotation => (
                    <div key={annotation.id} className={`annotation annotation-${annotation.type}`}>
                      <div className="annotation-content">
                        <FaStickyNote className="annotation-icon" />
                        <span>{annotation.text}</span>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </Document>
        </div>

        {/* Page Navigation Info */}
        <div className="page-navigation">
          <div className="page-info">
            <span>Total Pages: {numPages || '--'}</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
