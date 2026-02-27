"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaPlay, FaStop, FaMicrophone, FaCheck, FaPowerOff, FaUserCircle, FaQuestionCircle, FaSignOutAlt, FaBook } from "react-icons/fa";
import { useRouter } from "next/navigation";
import "./styles.css";

export default function PrototypeDashboard() {
  const [isRecording, setIsRecording] = useState(false);
  const [micConnected, setMicConnected] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioStream, setAudioStream] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  // Course selection & transcription state
  const [classes, setClasses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [transcriptionId, setTranscriptionId] = useState(null);
  const [liveChunks, setLiveChunks] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStopping, setIsStopping] = useState(false);
  const [duration, setDuration] = useState("0m 0s");
  const [showCourseSelect, setShowCourseSelect] = useState(false);

  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const pollingRef = useRef(null);
  const durationRef = useRef(null);
  const startTimeRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    setShowGuide(true);

    if (typeof window !== "undefined" && navigator?.mediaDevices?.getUserMedia) {
      checkMicrophonePermission();
    }

    // Fetch educator's classes
    fetchClasses();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioStream) audioStream.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, []);

  // Stop recording when mic is disconnected
  useEffect(() => {
    if (!micConnected && isRecording) {
      handleStopRecording();
    }
  }, [micConnected]);

  // ─── Fetch educator's classes with enrolled students ───────────────
  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/educator/classes");
      if (res.ok) {
        const data = await res.json();
        // Only show classes that have students enrolled
        const classesWithStudents = (data.classes || []).filter((c) => c.students > 0);
        setClasses(classesWithStudents);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    }
  };

  // ─── Microphone handling ───────────────────────────────────────────
  const checkMicrophonePermission = async () => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setMicConnected(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicConnected(true);
      setAudioStream(stream);
      startAudioMonitoring(stream);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setMicConnected(false);
    }
  };

  const startAudioMonitoring = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    microphone.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const detectAudio = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const normalizedLevel = Math.min(average / 128, 1);
      setAudioLevel(normalizedLevel);
      animationFrameRef.current = requestAnimationFrame(detectAudio);
    };
    detectAudio();
  };

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const handleMicClick = () => {
    if (micConnected) {
      stopAudioMonitoring();
      setMicConnected(false);
    } else {
      checkMicrophonePermission();
    }
  };

  // ─── Duration timer ────────────────────────────────────────────────
  const startDurationTimer = () => {
    startTimeRef.current = Date.now();
    durationRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hrs > 0) {
        setDuration(`${hrs}h ${remMins}m ${secs}s`);
      } else {
        setDuration(`${remMins}m ${secs}s`);
      }
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  };

  // ─── Start transcription ──────────────────────────────────────────
  const handleStartRecording = async () => {
    if (!micConnected) {
      setStatusMessage("Please connect your microphone first!");
      return;
    }
    if (!selectedCourse) {
      setShowCourseSelect(true);
      setStatusMessage("Please select a course before recording.");
      return;
    }

    setStatusMessage("Starting transcription...");

    try {
      const res = await fetch("/api/transcribe/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: selectedCourse,
          title: `${selectedCourse} - Lecture ${new Date().toLocaleDateString()}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Failed to start transcription.");
        return;
      }

      const data = await res.json();
      setSessionId(data.session_id);
      setTranscriptionId(data.transcription_id);
      setIsRecording(true);
      setLiveChunks([]);
      setStatusMessage("Recording in progress...");
      startDurationTimer();

      // Start polling for live transcript updates
      startPolling(data.session_id);
    } catch (error) {
      console.error("Error starting transcription:", error);
      setStatusMessage("Failed to start transcription. Is the backend running?");
    }
  };

  // ─── Poll for live updates ────────────────────────────────────────
  const startPolling = (sid) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/status?sessionId=${sid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.transcript?.chunks) {
            setLiveChunks(data.transcript.chunks);
          }
          if (data.status !== "running") {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
  };

  // ─── Stop transcription ───────────────────────────────────────────
  const handleStopRecording = async () => {
    if (!sessionId) return;

    setIsStopping(true);
    setStatusMessage("Stopping transcription & generating summary...");
    stopDurationTimer();

    // Stop polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      const res = await fetch("/api/transcribe/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          transcriptionId: transcriptionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Failed to stop transcription.");
        setIsStopping(false);
        return;
      }

      const data = await res.json();
      setIsRecording(false);
      setIsStopping(false);
      setStatusMessage(
        `Transcription saved! ${data.chunks_count} chunks recorded. ` +
        (data.has_summary ? "Cornell summary generated." : "No summary generated.")
      );

      // Update live chunks with final data
      if (data.transcript?.chunks) {
        setLiveChunks(data.transcript.chunks);
      }

      // Reset session
      setSessionId(null);
      setTranscriptionId(null);
    } catch (error) {
      console.error("Error stopping transcription:", error);
      setStatusMessage("Failed to stop transcription.");
      setIsStopping(false);
    }
  };

  // ─── Play button handler ──────────────────────────────────────────
  const handlePlayClick = async () => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      alert("MediaDevices API not available. Please use HTTPS or localhost.");
      return;
    }

    if (!isRecording) {
      handleStartRecording();
    } else {
      handleStopRecording();
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (isRecording) {
      await handleStopRecording();
    }
    stopAudioMonitoring();
    setMicConnected(false);
    setIsRecording(false);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/";
    }
  };

  const toggleGuide = () => {
    setShowGuide(!showGuide);
  };

  if (!mounted) {
    return null;
  }

  // Get unique course codes from classes
  const courseCodes = [...new Set(classes.map((c) => c.subject))];

  return (
    <div className="prototype-container">
      {/* User Guide Modal */}
      {showGuide && (
        <div className="guide-overlay" onClick={() => setShowGuide(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <button className="guide-close" onClick={() => setShowGuide(false)}>✕</button>

            <div className="guide-header">
              <img src="/img/fLexiScribe-logo-purple.png" alt="Logo" className="guide-logo" />
              <div>
                <h2 className="guide-title">fLexiScribe</h2>
                <p className="guide-subtitle">Your Note-Taking Assistant</p>
              </div>
            </div>

            <div className="guide-content">
              {/* Step 1 */}
              <div className="guide-step">
                <div className="guide-step-number">1</div>
                <div className="guide-step-icon"><FaPowerOff /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">POWER ON</h3>
                  <p className="guide-step-text">Press the <strong>Power Button</strong> to start the device.<br />Wait for the Home Screen to load.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="guide-step">
                <div className="guide-step-number">2</div>
                <div className="guide-step-icon"><FaMicrophone /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">CONNECT MIC</h3>
                  <p className="guide-step-text">Power on the <strong>Microphone</strong> and connect it<br />to the device. Click the MIC button to enable.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="guide-step">
                <div className="guide-step-number">3</div>
                <div className="guide-step-icon"><FaBook /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">SELECT COURSE</h3>
                  <p className="guide-step-text">Choose the <strong>Course Code</strong> for the class you<br />are about to teach. Transcripts are saved per course.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="guide-step">
                <div className="guide-step-number">4</div>
                <div className="guide-step-icon"><FaPlay /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">START RECORD</h3>
                  <p className="guide-step-text">Start the recording by pressing the <strong>Play Button</strong><br />shown on the screen. Speak clearly into the mic.</p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="guide-step">
                <div className="guide-step-number">5</div>
                <div className="guide-step-icon"><div className="stop-icon"></div></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">STOP RECORD</h3>
                  <p className="guide-step-text">Stop the recording by pressing the <strong>Stop Button</strong><br />shown on the screen. Your recording will be saved.</p>
                </div>
              </div>
            </div>

            <button className="guide-button" onClick={() => setShowGuide(false)}>Got it!</button>
          </div>
        </div>
      )}

      {/* Course Selection Modal */}
      {showCourseSelect && (
        <div className="guide-overlay" onClick={() => setShowCourseSelect(false)}>
          <div className="guide-modal course-select-modal" onClick={(e) => e.stopPropagation()}>
            <button className="guide-close" onClick={() => setShowCourseSelect(false)}>✕</button>

            <div className="guide-header">
              <div className="guide-step-icon"><FaBook /></div>
              <div>
                <h2 className="guide-title">Select Course</h2>
                <p className="guide-subtitle">Choose the class you are teaching</p>
              </div>
            </div>

            <div className="course-list">
              {courseCodes.length === 0 ? (
                <div className="no-courses">
                  <p>No classes with enrolled students found.</p>
                  <p className="text-sm" style={{ opacity: 0.7, marginTop: "0.5rem" }}>
                    Please ask the admin to add your class and ensure students have joined.
                  </p>
                </div>
              ) : (
                courseCodes.map((code) => {
                  const classesForCode = classes.filter((c) => c.subject === code);
                  const totalStudents = classesForCode.reduce((sum, c) => sum + c.students, 0);
                  const sections = classesForCode.map((c) => c.section).join(", ");
                  return (
                    <button
                      key={code}
                      className={`course-option ${selectedCourse === code ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedCourse(code);
                        setShowCourseSelect(false);
                        setStatusMessage(`Course ${code} selected. Ready to record.`);
                      }}
                    >
                      <div className="course-option-code">{code}</div>
                      <div className="course-option-details">
                        Section {sections} &bull; {totalStudents} student{totalStudents !== 1 ? "s" : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="prototype-content">
        {/* Action Buttons - Top Right */}
        <div className="action-buttons">
          <button className="action-btn help-btn" onClick={toggleGuide} aria-label="Open guide">
            <FaQuestionCircle />
            <span>Guide</span>
          </button>
          <button className="action-btn logout-btn" onClick={handleLogout} aria-label="Logout">
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>

        {/* Header */}
        <div className="prototype-header">
          <div className="logo-section">
            <div className="logo-content">
              <img src="/img/fLexiScribe-logo-purple.png" alt="Logo" className="logo-icon" />
              <div className="logo-text">
                <h1 className="text-4xl font-bold">fLexiScribe</h1>
                <p className="text-sm font-normal">Your Note-Taking Assistant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Course Selector Bar */}
        <div className="course-selector-bar">
          <button
            className={`course-select-btn ${selectedCourse ? "has-course" : ""}`}
            onClick={() => setShowCourseSelect(true)}
            disabled={isRecording}
          >
            <FaBook />
            <span>{selectedCourse || "Select Course"}</span>
          </button>
          {selectedCourse && !isRecording && (
            <span className="course-ready-label">Ready to record for {selectedCourse}</span>
          )}
          {isRecording && (
            <div className="recording-info">
              <span className="recording-dot"></span>
              <span className="recording-label">REC &mdash; {selectedCourse}</span>
              <span className="recording-duration">{duration}</span>
            </div>
          )}
        </div>

        {/* Main Control Panel */}
        <div className="control-panel">
          {/* Play/Stop Button */}
          <div className="control-section">
            <div className="control-label">{isRecording ? "STOP" : "PLAY"}</div>
            <button
              className={`control-button play-button ${isRecording ? "recording" : ""} ${isStopping ? "stopping" : ""}`}
              onClick={handlePlayClick}
              disabled={isStopping}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? <FaStop className="control-icon" /> : <FaPlay className="control-icon" />}
            </button>
            <div className="control-status">
              {statusMessage || (isRecording ? "Recording..." : "Press play to start recording.")}
            </div>
          </div>

          {/* Mic Button */}
          <div className="control-section">
            <div className="control-label">MIC</div>
            <button
              className={`control-button mic-button ${micConnected ? "connected" : "disconnected"} ${audioLevel > 0.1 ? "active" : ""}`}
              onClick={handleMicClick}
              aria-label="Check microphone"
              style={{ "--audio-level": audioLevel }}
            >
              {audioLevel > 0.1 ? (
                <div className="sound-wave">
                  {[...Array(5)].map((_, index) => (
                    <div
                      key={index}
                      className="wave-bar"
                      style={{
                        "--bar-height": audioLevel,
                        "--bar-delay": `${index * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <FaMicrophone className="control-icon" />
              )}
            </button>
            <div className={`control-status mic-status ${micConnected ? "connected" : ""}`}>
              <span>MIC: </span>
              {micConnected ? (
                <>
                  <FaCheck className="check-icon" /> Connected
                </>
              ) : (
                "Disconnected"
              )}
            </div>
          </div>
        </div>

        {/* Live Transcript Display */}
        {(isRecording || liveChunks.length > 0) && (
          <div className="live-transcript-panel">
            <div className="live-transcript-header">
              <h3>Live Transcript</h3>
              <span className="chunk-count">{liveChunks.length} chunk{liveChunks.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="live-transcript-content">
              {liveChunks.length === 0 ? (
                <p className="live-transcript-empty">Waiting for speech...</p>
              ) : (
                liveChunks.map((chunk, i) => (
                  <div key={i} className="live-chunk">
                    <span className="chunk-timestamp">[{chunk.timestamp}]</span>
                    <span className="chunk-text">{chunk.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
