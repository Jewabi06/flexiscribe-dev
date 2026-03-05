"use client";
import React, { useEffect, useRef } from "react";
import { FaTimes, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

/**
 * AnswerReviewModal – Google-Forms-style post-submission answer review.
 *
 * Props:
 *   isOpen       – boolean, controlled by parent
 *   onClose      – () => void
 *   quizType     – 'MCQ' | 'FILL_IN_BLANK'
 *   questions    – the original questions array (each has .question, and .options for MCQ)
 *   results      – array from API: { index, correct, userAnswer, correctAnswer }[]
 *   score        – number of correct answers
 *   totalQuestions – total count
 *   accuracy     – percentage (number)
 *   xpEarned     – XP awarded
 *   attemptLabel – e.g. '1st Attempt' or 'Retry (10% XP)'
 *
 * Text inside the modal is non-selectable to prevent copying.
 */
export default function AnswerReviewModal({
  isOpen,
  onClose,
  quizType,
  questions,
  results,
  score,
  totalQuestions,
  accuracy,
  xpEarned,
  attemptLabel,
}) {
  const panelRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Focus trap – focus the panel when it opens
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Block copy / cut / context-menu on the modal content
  // useEffect(() => {
  //   if (!isOpen || !panelRef.current) return;
  //   const el = panelRef.current;
  //   const block = (e) => e.preventDefault();
  //   el.addEventListener("copy", block);
  //   el.addEventListener("cut", block);
  //   el.addEventListener("contextmenu", block);
  //   return () => {
  //     el.removeEventListener("copy", block);
  //     el.removeEventListener("cut", block);
  //     el.removeEventListener("contextmenu", block);
  //   };
  // }, [isOpen]);

  if (!isOpen || !results) return null;

  // Helpers to display an answer value based on quiz type
  const displayAnswer = (q, answerValue) => {
    if (quizType === "MCQ") {
      const opts = q.options || q.choices || [];
      return opts[answerValue] ?? `Option ${answerValue + 1}`;
    }
    // FILL_IN_BLANK – answerValue is a string
    return answerValue ?? "—";
  };

  return (
    <div className="arm-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Answer Review">
      <div
        className="arm-panel"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="arm-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        {/* Score summary */}
        <div className="arm-score-header">
          <div className="arm-score-circle">
            <span className="arm-score-value">{score}/{totalQuestions}</span>
            <span className="arm-score-pct">{accuracy}%</span>
          </div>
          <div className="arm-score-details">
            <h2 className="arm-title">Quiz Results</h2>
            <p className="arm-subtitle">{attemptLabel} &bull; +{xpEarned} XP</p>
          </div>
        </div>

        <hr className="arm-divider" />

        {/* Answer list */}
        <div className="arm-list">
          {results.map((r, idx) => {
            const q = questions[r.index] || questions[idx];
            return (
              <div key={idx} className={`arm-item ${r.correct ? "arm-item-correct" : "arm-item-wrong"}`}>
                <div className="arm-item-header">
                  <span className="arm-item-num">{idx + 1}</span>
                  <span className={`arm-item-badge ${r.correct ? "badge-correct" : "badge-wrong"}`}>
                    {r.correct ? <><FaCheckCircle /> Correct</> : <><FaTimesCircle /> Incorrect</>}
                  </span>
                </div>
                <p className="arm-item-question">{q.question}</p>

                {/* For MCQ, show the options with highlights */}
                {quizType === "MCQ" && (
                  <div className="arm-options">
                    {(q.options || q.choices || []).map((opt, oi) => {
                      const isCorrect = oi === r.correctAnswer;
                      const isUserPick = oi === r.userAnswer;
                      let cls = "arm-opt";
                      if (isCorrect) cls += " arm-opt-correct";
                      if (isUserPick && !isCorrect) cls += " arm-opt-wrong";
                      return (
                        <div key={oi} className={cls}>
                          <span className="arm-opt-letter">{String.fromCharCode(65 + oi)}</span>
                          <span className="arm-opt-text">{opt}</span>
                          {isCorrect && <FaCheckCircle className="arm-opt-icon correct-icon" />}
                          {isUserPick && !isCorrect && <FaTimesCircle className="arm-opt-icon wrong-icon" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* For Fill-in-the-blank, show correct vs user answer */}
                {quizType === "FILL_IN_BLANK" && (
                  <div className="arm-fill-answers">
                    <div className="arm-fill-row">
                      <span className="arm-fill-label">Your answer:</span>
                      <span className={`arm-fill-value ${r.correct ? "fill-correct" : "fill-wrong"}`}>
                        {r.userAnswer || "—"}
                      </span>
                    </div>
                    {!r.correct && (
                      <div className="arm-fill-row">
                        <span className="arm-fill-label">Correct answer:</span>
                        <span className="arm-fill-value fill-correct">{r.correctAnswer || "—"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="arm-footer">
          <button className="arm-done-btn" onClick={onClose}>Done</button>
        </div>
      </div>

      <style jsx>{`
        /* ===== Overlay ===== */
        .arm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          animation: armFadeIn 0.2s ease;
          padding: 16px;
        }
        @keyframes armFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes armSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ===== Panel ===== */
        .arm-panel {
          background: #ffffff;
          border-radius: 20px;
          max-width: 560px;
          width: 100%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
          animation: armSlideUp 0.3s ease;
          outline: none;
          // /* Prevent text selection / copying */
          // user-select: none;
          // -webkit-user-select: none;
          // -moz-user-select: none;
          // -ms-user-select: none;
        }
        :global(.dark-mode) .arm-panel {
          background: #2d2640;
          color: #f0ecf7;
        }

        /* ===== Close button ===== */
        .arm-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(0, 0, 0, 0.06);
          border: none;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #888;
          font-size: 14px;
          transition: all 0.2s ease;
          z-index: 2;
        }
        .arm-close:hover { background: rgba(0, 0, 0, 0.12); color: #555; }
        :global(.dark-mode) .arm-close { background: rgba(255,255,255,0.1); color: #aaa; }
        :global(.dark-mode) .arm-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

        /* ===== Score header ===== */
        .arm-score-header {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 28px 28px 0;
        }
        .arm-score-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9d8adb 0%, #4c4172 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .arm-score-value {
          font-size: 1.05rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
        }
        .arm-score-pct {
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
        }
        .arm-score-details { flex: 1; }
        .arm-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #4c4172;
          margin: 0 0 4px;
        }
        :global(.dark-mode) .arm-title { color: #c5a6f9; }
        .arm-subtitle {
          font-size: 0.85rem;
          color: #888;
          margin: 0;
        }
        :global(.dark-mode) .arm-subtitle { color: #bbb; }

        .arm-divider {
          border: none;
          border-top: 1px solid rgba(0,0,0,0.08);
          margin: 20px 28px 0;
        }
        :global(.dark-mode) .arm-divider { border-top-color: rgba(255,255,255,0.1); }

        /* ===== Scrollable list ===== */
        .arm-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .arm-list::-webkit-scrollbar { width: 5px; }
        .arm-list::-webkit-scrollbar-track { background: transparent; }
        .arm-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
        :global(.dark-mode) .arm-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }

        /* ===== Each item ===== */
        .arm-item {
          border-radius: 14px;
          padding: 16px;
          border-left: 4px solid transparent;
        }
        .arm-item-correct {
          background: rgba(74, 222, 128, 0.08);
          border-left-color: #4ade80;
        }
        .arm-item-wrong {
          background: rgba(248, 113, 113, 0.08);
          border-left-color: #f87171;
        }
        :global(.dark-mode) .arm-item-correct { background: rgba(74,222,128,0.12); }
        :global(.dark-mode) .arm-item-wrong { background: rgba(248,113,113,0.12); }

        .arm-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .arm-item-num {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(0,0,0,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #555;
        }
        :global(.dark-mode) .arm-item-num { background: rgba(255,255,255,0.1); color: #ccc; }

        .arm-item-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
        }
        .badge-correct { background: rgba(74,222,128,0.15); color: #16a34a; }
        .badge-wrong   { background: rgba(248,113,113,0.15); color: #dc2626; }
        :global(.dark-mode) .badge-correct { background: rgba(74,222,128,0.2); color: #4ade80; }
        :global(.dark-mode) .badge-wrong   { background: rgba(248,113,113,0.2); color: #f87171; }

        .arm-item-question {
          font-size: 0.92rem;
          color: #333;
          margin: 0 0 10px;
          line-height: 1.5;
        }
        :global(.dark-mode) .arm-item-question { color: #e0dce8; }

        /* ===== MCQ option rows ===== */
        .arm-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .arm-opt {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(0,0,0,0.03);
          font-size: 0.85rem;
          color: #555;
          transition: background 0.15s;
        }
        :global(.dark-mode) .arm-opt { background: rgba(255,255,255,0.05); color: #ccc; }
        .arm-opt-correct {
          background: rgba(74,222,128,0.15) !important;
          color: #15803d;
          font-weight: 600;
        }
        :global(.dark-mode) .arm-opt-correct { color: #4ade80 !important; background: rgba(74,222,128,0.2) !important; }
        .arm-opt-wrong {
          background: rgba(248,113,113,0.12) !important;
          color: #b91c1c;
        }
        :global(.dark-mode) .arm-opt-wrong { color: #f87171 !important; background: rgba(248,113,113,0.17) !important; }
        .arm-opt-letter {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        :global(.dark-mode) .arm-opt-letter { background: rgba(255,255,255,0.08); }
        .arm-opt-text { flex: 1; }
        .arm-opt-icon { flex-shrink: 0; font-size: 0.9rem; }
        .correct-icon { color: #16a34a; }
        .wrong-icon   { color: #dc2626; }
        :global(.dark-mode) .correct-icon { color: #4ade80; }
        :global(.dark-mode) .wrong-icon   { color: #f87171; }

        /* ===== Fill-in answer rows ===== */
        .arm-fill-answers {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .arm-fill-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
        }
        .arm-fill-label {
          color: #888;
          font-weight: 500;
          min-width: 110px;
        }
        :global(.dark-mode) .arm-fill-label { color: #aaa; }
        .arm-fill-value {
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 8px;
        }
        .fill-correct { color: #15803d; background: rgba(74,222,128,0.12); }
        .fill-wrong   { color: #b91c1c; background: rgba(248,113,113,0.12); text-decoration: line-through; }
        :global(.dark-mode) .fill-correct { color: #4ade80; background: rgba(74,222,128,0.18); }
        :global(.dark-mode) .fill-wrong   { color: #f87171; background: rgba(248,113,113,0.18); }

        /* ===== Footer ===== */
        .arm-footer {
          padding: 16px 28px 24px;
          display: flex;
          justify-content: center;
        }
        .arm-done-btn {
          padding: 11px 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #9d8adb 0%, #4c4172 100%);
          color: #fff;
          font-size: 0.95rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .arm-done-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 18px rgba(157,138,219,0.45);
        }

        /* ===== Mobile ===== */
        @media (max-width: 640px) {
          .arm-panel { max-height: 92vh; border-radius: 16px; }
          .arm-score-header { padding: 22px 18px 0; gap: 14px; }
          .arm-list { padding: 14px 18px; }
          .arm-divider { margin: 16px 18px 0; }
          .arm-footer { padding: 14px 18px 20px; }
          .arm-score-circle { width: 60px; height: 60px; }
          .arm-score-value { font-size: 0.9rem; }
          .arm-fill-row { flex-direction: column; align-items: flex-start; gap: 4px; }
          .arm-fill-label { min-width: 0; }
        }
      `}</style>
    </div>
  );
}
