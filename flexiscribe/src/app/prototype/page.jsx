"use client";
import React, { useState, useEffect, useRef } from "react";
import { FaPlay, FaStop, FaMicrophone, FaCheck, FaPowerOff, FaQuestionCircle, FaSignOutAlt, FaBook, FaUsers, FaChalkboardTeacher, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";
import "./styles.css";

export default function PrototypeDashboard() {
  const [isRecording, setIsRecording] = useState(false);
  const [micConnected, setMicConnected] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioStream, setAudioStream] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [liveCaption, setLiveCaption] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Course selection & transcription state
  const [classes, setClasses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [transcriptionId, setTranscriptionId] = useState(null);
  const [liveChunks, setLiveChunks] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isStopping, setIsStopping] = useState(false);
  const [duration, setDuration] = useState("0m 0s");
  const [showClassSessionModal, setShowClassSessionModal] = useState(false);
  const [sessionType, setSessionType] = useState("lecture"); // "lecture" | "meeting"

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Error modal state
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const pollingRef = useRef(null);
  const eventSourceRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const durationRef = useRef(null);
  const startTimeRef = useRef(null);
  const summaryPollRef = useRef(null);
  const summaryPollStartRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    setShowGuide(false);

    const restoreSession = async () => {
      const saved = localStorage.getItem("flexiSession");
      if (!saved) return;
      try {
        const { sessionId: savedSessionId, transcriptionId: savedTranscriptionId } = JSON.parse(saved);
        if (savedSessionId) {
          setSessionId(savedSessionId);
          setTranscriptionId(savedTranscriptionId);

          const statusRes = await fetch(`/api/transcribe/status?sessionId=${savedSessionId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "running") {
              setIsRecording(true);
              startLiveStream(savedSessionId);
              setStatusMessage("Resuming active recording session...");
            } else if (statusData.status === "stopping" || statusData.status === "SUMMARIZING" || statusData.status === "summarizing") {
              setIsRecording(false);
              setIsFinalizing(true);
              setShowStatusModal(true);
              setStatusMessage("Summary is being generated. Resuming status watcher...");
              pollSummaryStatus(savedSessionId);
            } else if (statusData.status === "COMPLETED" || statusData.status === "completed") {
              setStatusMessage("Previous session has already finished.");
              localStorage.removeItem("flexiSession");
            }
          }
        }
      } catch (err) {
        console.error("Restore session error:", err);
      }
    };

    restoreSession();

    if (typeof window !== "undefined" && navigator?.mediaDevices?.getUserMedia) {
      checkMicrophonePermission();
    }

    fetchClasses();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioStream) audioStream.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      if (durationRef.current) clearInterval(durationRef.current);
      clearSummaryPoll();
    };
  }, []);

  useEffect(() => {
    if (!micConnected && isRecording) {
      handleStopRecording();
    }
  }, [micConnected]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveChunks]);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/educator/classes");
      if (res.ok) {
        const data = await res.json();
        const classesWithStudents = (data.classes || []).filter((c) => c.students > 0);
        setClasses(classesWithStudents);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    }
  };

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

    let frameSkip = 0;
    const detectAudio = () => {
      frameSkip++;
      if (frameSkip % 6 === 0) {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const normalizedLevel = Math.min(average / 128, 1);
        setAudioLevel(normalizedLevel);
      }
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

  const handleStartRecording = async () => {
    if (!micConnected) {
      setStatusMessage("Please connect your microphone first!");
      return;
    }
    if (!selectedCourse) {
      setStatusMessage("Please select a course before recording.");
      setShowClassSessionModal(true);
      return;
    }

    setStatusMessage("Starting recording...");

    try {
      const res = await fetch("/api/transcribe/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: selectedCourse,
          sessionType: sessionType,
          title: `${selectedCourse} - ${sessionType === "meeting" ? "Meeting" : "Lecture"} ${new Date().toLocaleDateString()}`,
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
      localStorage.setItem(
        "flexiSession",
        JSON.stringify({ sessionId: data.session_id, transcriptionId: data.transcription_id })
      );
      setIsRecording(true);
      setLiveChunks([]);
      setFullTranscript("");
      setLiveCaption("");
      setStatusMessage("Recording in progress...");
      startDurationTimer();

      startLiveStream(data.session_id);
    } catch (error) {
      console.error("Error starting transcription:", error);
      setStatusMessage("Failed to start transcription.");
    }
  };

  const startLiveStream = (sid) => {
    try {
      const es = new EventSource(`/api/transcribe/live?sessionId=${sid}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "live_chunk") {
            setLiveChunks((prev) => {
              if (prev.some((c) => c.chunk_id === data.chunk_id)) return prev;
              return [...prev, {
                chunk_id: data.chunk_id,
                timestamp: data.timestamp,
                text: data.text,
              }];
            });

            if (data.text) {
              setLiveCaption(data.text);
              setFullTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
            }
          }
        } catch (e) {
          // Ignore parse errors from keepalive comments
        }
      };

      es.addEventListener("done", () => {
        es.close();
        eventSourceRef.current = null;
      });

      es.onerror = () => {
        console.warn("SSE connection failed, falling back to polling");
        es.close();
        eventSourceRef.current = null;
        startPolling(sid);
      };
    } catch (e) {
      startPolling(sid);
    }
  };

  const startPolling = (sid) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcribe/status?sessionId=${sid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.live_transcript?.chunks) {
            setLiveChunks(data.live_transcript.chunks);
            // Update live caption from the latest chunk
            const lastChunk = data.live_transcript.chunks[data.live_transcript.chunks.length - 1];
            if (lastChunk?.text) {
              setLiveCaption(lastChunk.text);
            }
          }
          if (data.status !== "running") {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);
  };

  const clearSummaryPoll = () => {
    if (summaryPollRef.current) {
      clearTimeout(summaryPollRef.current);
      summaryPollRef.current = null;
    }
    summaryPollStartRef.current = null;
  };

  const pollSummaryStatus = async (sid) => {
    if (!sid) return;

    if (!summaryPollStartRef.current) {
      summaryPollStartRef.current = Date.now();
    }

    if (Date.now() - summaryPollStartRef.current > 300000) {
      clearSummaryPoll();
      setErrorMessage(
        "Summary generation timed out. The backend may be overloaded or the summarization process failed. Please check the backend logs for details."
      );
      setErrorModalOpen(true);
      setIsFinalizing(false);
      setShowStatusModal(false);
      setIsStopping(false);
      localStorage.removeItem("flexiSession");
      return;
    }

    try {
      const res = await fetch(`/api/transcribe/status?sessionId=${sid}`);
      if (!res.ok) {
        throw new Error(`Status fetch failed (${res.status})`);
      }

      const data = await res.json();
      if (data.status?.toLowerCase() === "completed") {
        setIsFinalizing(false);
        setShowStatusModal(false);
        setStatusMessage("Summary generation complete.");
        setIsStopping(false);
        clearSummaryPoll();
        localStorage.removeItem("flexiSession");

        if (data.live_transcript?.chunks) {
          setLiveChunks(data.live_transcript.chunks);
        }

        return;
      }

      if (data.status?.toLowerCase() === "error") {
        setIsFinalizing(false);
        setShowStatusModal(false);
        setStatusMessage("Summary generation failed. Please retry.");
        setIsStopping(false);
        clearSummaryPoll();
        return;
      }

      setIsFinalizing(true);
      setShowStatusModal(true);
      setStatusMessage("Summary is being generated, please wait...");
    } catch (err) {
      console.error("Summary status poll error:", err);
      setStatusMessage("Unable to get summary status. Retrying...");
    }

    clearSummaryPoll();
    summaryPollRef.current = setTimeout(() => pollSummaryStatus(sid), 5000);
  };

  const handleStopRecording = async () => {
    if (!sessionId) return;

    setIsStopping(true);
    setStatusMessage("Saving your recording and generating notes...");
    stopDurationTimer();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
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
        setErrorMessage(err.error || "Failed to stop transcription.");
        setErrorModalOpen(true);
        setIsStopping(false);
        return;
      }

      const data = await res.json();

      setIsRecording(false);

      if (data.live_transcript?.chunks) {
        setLiveChunks(data.live_transcript.chunks);
      }

      if (data.summary_pending) {
        setIsFinalizing(true);
        setShowStatusModal(true);
        setStatusMessage("Recording stopped. Final summary is being generated; this can take a few moments.");
        localStorage.setItem(
          "flexiSession",
          JSON.stringify({ sessionId, transcriptionId })
        );
        pollSummaryStatus(sessionId);
      } else {
        setIsFinalizing(false);
        setShowStatusModal(false);

        let msg = "Recording saved! ";
        if (data.lesson_created) msg += "AI notes and transcripts are ready.";
        else if (data.has_summary) msg += "AI notes have been generated.";
        else msg += "AI notes will be ready shortly.";
        setStatusMessage(msg);

        localStorage.removeItem("flexiSession");
        setSessionId(null);
        setTranscriptionId(null);
      }

      setIsStopping(false);
    } catch (error) {
      console.error("Error stopping transcription:", error);
      setErrorMessage(error.message || "Failed to stop transcription. Check backend connection.");
      setErrorModalOpen(true);
      setIsStopping(false);
    }
  };

  const handlePlayClick = async () => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      alert("MediaDevices API not available. Please use HTTPS or localhost.");
      return;
    }

    if (!isRecording) {
      if (!selectedCourse) {
        setStatusMessage("Please select a class and session type first.");
        setShowClassSessionModal(true);
        return;
      }
      if (!sessionType) {
        setShowClassSessionModal(true);
        return;
      }
      setShowConsentModal(true);
    } else {
      await handleStopRecording();
    }
  };

  const handleConsentConfirm = () => {
    setShowConsentModal(false);
    setConsentChecked(false);
    handleStartRecording();
  };

  const openClassSessionModal = () => {
    setShowClassSessionModal(true);
  };

  const handleSaveClassSession = () => {
    if (selectedCourse && sessionType) {
      setShowClassSessionModal(false);
      setStatusMessage(`${selectedCourse} — ${sessionType === "meeting" ? "Meeting" : "Lecture"} selected. Ready to record.`);
    } else {
      setStatusMessage("Please select both a course and session type.");
    }
  };

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
      window.location.href = "/auth/educator/login?redirect=prototype";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/auth/educator/login?redirect=prototype";
    }
  };

  const toggleGuide = () => {
    setShowGuide(!showGuide);
  };

  if (!mounted) {
    return null;
  }

  const courseCodes = [...new Set(classes.map((c) => c.subject))];

  return (
    <div className="prototype-container">
      {/* User Guide Modal (unchanged) */}
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
              <div className="guide-step">
                <div className="guide-step-number">1</div>
                <div className="guide-step-icon"><FaPowerOff /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">POWER ON</h3>
                  <p className="guide-step-text">Press the <strong>Power Button</strong> to start the device.<br />Wait for the Home Screen to load.</p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-number">2</div>
                <div className="guide-step-icon"><FaMicrophone /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">CONNECT MIC</h3>
                  <p className="guide-step-text">Power on the <strong>Microphone</strong> and connect it<br />to the device. Click the MIC button to enable.</p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-number">3</div>
                <div className="guide-step-icon"><FaBook /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">SELECT COURSE & SESSION</h3>
                  <p className="guide-step-text">Tap the <strong>Class/Session</strong> button to choose the course<br />and session type (Lecture or Meeting).</p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-number">4</div>
                <div className="guide-step-icon"><FaPlay /></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">START RECORD</h3>
                  <p className="guide-step-text">Press the <strong>Play Button</strong> and agree to the consent.<br />Speak clearly into the mic to transcribe.</p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-number">5</div>
                <div className="guide-step-icon"><div className="stop-icon"></div></div>
                <div className="guide-step-content">
                  <h3 className="guide-step-title">STOP RECORD</h3>
                  <p className="guide-step-text">Press the <strong>Stop Button</strong> to end recording.<br />Your session will be saved and summarized.</p>
                </div>
              </div>
            </div>

            <button className="guide-button" onClick={() => setShowGuide(false)}>Got it!</button>
          </div>
        </div>
      )}

      {/* Class & Session Selection Modal (unchanged) */}
      {showClassSessionModal && (
        <div className="guide-overlay" onClick={() => setShowClassSessionModal(false)}>
          <div className="guide-modal course-select-modal" onClick={(e) => e.stopPropagation()}>
            <button className="guide-close" onClick={() => setShowClassSessionModal(false)}>✕</button>

            <div className="guide-header">
              <div className="guide-step-icon"><FaBook /></div>
              <div>
                <h2 className="guide-title">Class & Session</h2>
                <p className="guide-subtitle">Select the course and session type</p>
              </div>
            </div>

            <div className="class-session-content">
              {/* Course Selection */}
              <div className="selection-section">
                <label className="selection-label">Course</label>
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
                          onClick={() => setSelectedCourse(code)}
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

              {/* Session Type Selection */}
              <div className="selection-section">
                <label className="selection-label">Session Type</label>
                <div className="session-type-list">
                  <button
                    className={`session-type-option ${sessionType === "lecture" ? "selected" : ""}`}
                    onClick={() => setSessionType("lecture")}
                  >
                    <div className="session-type-icon lecture-icon">
                      <FaChalkboardTeacher />
                    </div>
                    <div className="session-type-info">
                      <div className="session-type-name">Lecture</div>
                      <div className="session-type-desc">Generates <strong>Cornell Notes</strong> with cue questions, notes, and summary.</div>
                    </div>
                  </button>

                  <button
                    className={`session-type-option ${sessionType === "meeting" ? "selected" : ""}`}
                    onClick={() => setSessionType("meeting")}
                  >
                    <div className="session-type-icon meeting-icon">
                      <FaUsers />
                    </div>
                    <div className="session-type-info">
                      <div className="session-type-name">Meeting</div>
                      <div className="session-type-desc">Generates <strong>Minutes of the Meeting</strong> with agenda, decisions, and action items.</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <button 
              className="guide-button" 
              onClick={handleSaveClassSession}
              disabled={!selectedCourse || !sessionType}
            >
              Save & Close
            </button>
          </div>
        </div>
      )}

      {/* Consent Modal (unchanged) */}
      {showConsentModal && (
        <div className="guide-overlay" onClick={() => setShowConsentModal(false)}>
          <div className="guide-modal consent-modal" onClick={(e) => e.stopPropagation()}>
            <button className="guide-close" onClick={() => setShowConsentModal(false)}>✕</button>

            <div className="guide-header">
              <div className="guide-step-icon" style={{ background: "#c5a6f9" }}>
                <FaCheckCircle />
              </div>
              <div>
                <h2 className="guide-title">Consent to Record</h2>
                <p className="guide-subtitle">Please confirm before starting the session</p>
              </div>
            </div>

            <div className="consent-content">
              <p className="consent-text">
                I, the professor, acknowledge that this session will be recorded for educational purposes. 
                The transcript and AI-generated notes will be stored securely and made available to enrolled students.
                I confirm that I have the authority to record this lecture/meeting and that all participants are aware.
              </p>
              <label className="consent-checkbox">
                <input 
                  type="checkbox" 
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                />
                <span className="consent-checkbox-text">I agree and consent to the recording of this session.</span>
              </label>
            </div>

            <button 
              className="guide-button" 
              onClick={handleConsentConfirm}
              disabled={!consentChecked}
              style={{ opacity: consentChecked ? 1 : 0.6 }}
            >
              Start Recording
            </button>
          </div>
        </div>
      )}

      {/* Summary status modal (unchanged) */}
      {showStatusModal && (
        <div className="guide-overlay" onClick={() => { if (!isFinalizing) setShowStatusModal(false); }}>
          <div className="guide-modal summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-loading-container">
              <div className="status-spinner-large"></div>
              <h3 className="summary-title">Generating Summary</h3>
              <p className="summary-message">{statusMessage || "Finalizing transcript and summary..."}</p>
              <p className="summary-hint">This may take a moment, do not close the window until complete.</p>
            </div>
            {!isFinalizing && (
              <button className="guide-button" onClick={() => setShowStatusModal(false)}>
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Modal (unchanged) */}
      {errorModalOpen && (
        <div className="guide-overlay" onClick={() => setErrorModalOpen(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="guide-header">
              <div className="guide-step-icon" style={{ backgroundColor: "#dc2626" }}>
                <FaExclamationTriangle />
              </div>
              <div>
                <h2 className="guide-title">Error</h2>
                <p className="guide-subtitle">An error occurred during transcription stop</p>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <p style={{ color: "#991b1b", backgroundColor: "#fee2e2", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>
                {errorMessage}
              </p>
              <button
                className="guide-button"
                onClick={() => setErrorModalOpen(false)}
                style={{ backgroundColor: "#dc2626" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="prototype-content">
        {/* Action Buttons - Top Right - Icon Only */}
        <div className="action-buttons">
          <button className="action-btn class-btn" onClick={openClassSessionModal} aria-label="Select class and session">
            <FaBook />
          </button>
          <button className="action-btn help-btn" onClick={toggleGuide} aria-label="Open guide">
            <FaQuestionCircle />
          </button>
          <button className="action-btn logout-btn" onClick={handleLogout} aria-label="Logout">
            <FaSignOutAlt />
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

        {/* Course & Session Info Bar */}
        <div className="info-bar">
          {selectedCourse && sessionType && (
            <div className="session-badge">
              <span className="course-badge">{selectedCourse}</span>
              <span className="type-badge">{sessionType === "meeting" ? "Meeting" : "Lecture"}</span>
            </div>
          )}
        </div>

        {/* Recording Info */}
        {isRecording && (
          <div className="recording-info">
            <span className="recording-dot"></span>
            <span className="recording-label">REC — {selectedCourse || "Unknown"} ({sessionType === "meeting" ? "Meeting" : "Lecture"})</span>
            <span className="recording-duration">{duration}</span>
          </div>
        )}

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
              disabled
              aria-label="Microphone status"
              style={{ "--audio-level": audioLevel, cursor: "default" }}
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

        {/* Live Caption Display - Updated in real time */}
        {(liveCaption || isRecording) && (
          <div className="live-transcript-panel">
            <div className="live-transcript-content" style={{ minHeight: "5.2rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p className="live-caption">{liveCaption || "Listening for speech..."}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}