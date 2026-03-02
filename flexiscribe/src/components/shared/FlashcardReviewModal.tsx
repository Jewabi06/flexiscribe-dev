"use client";
import React, { useEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";

/**
 * FlashcardReviewModal – Post-submission flashcard review.
 *
 * Displays every flashcard (front & back) in a scrollable list.
 * Styled identically to AnswerReviewModal — centered white panel,
 * rounded corners, subtle shadow, focus trap, Escape-to-close.
 * Text is non-selectable to prevent copying.
 */

interface FlashcardReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcards: Array<{ front: string; back: string }>;
  title?: string;
}

export default function FlashcardReviewModal({
  isOpen,
  onClose,
  flashcards,
  title = "Flashcard Review",
}: FlashcardReviewModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
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

  if (!isOpen || !flashcards || flashcards.length === 0) return null;

  return (
    <div
      className="frm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Flashcard Review"
    >
      <div
        className="frm-panel"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="frm-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        {/* Header */}
        <div className="frm-score-header">
          <div className="frm-score-circle">
            <span className="frm-score-value">{flashcards.length}</span>
            <span className="frm-score-pct">cards</span>
          </div>
          <div className="frm-score-details">
            <h2 className="frm-title">{title}</h2>
            <p className="frm-subtitle">
              {flashcards.length} flashcard{flashcards.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <hr className="frm-divider" />

        {/* Flashcard list */}
        <div className="frm-list">
          {flashcards.map((card, idx) => (
            <div key={idx} className="frm-item">
              <div className="frm-item-header">
                <span className="frm-item-num">{idx + 1}</span>
              </div>
              <div className="frm-card-front">
                <span className="frm-label">Front</span>
                <p className="frm-card-text">{card.front}</p>
              </div>
              <div className="frm-card-separator" />
              <div className="frm-card-back">
                <span className="frm-label">Back</span>
                <p className="frm-card-text">{card.back}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="frm-footer">
          <button className="frm-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <style jsx>{`
        /* ===== Overlay ===== */
        .frm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          animation: frmFadeIn 0.2s ease;
          padding: 16px;
        }
        @keyframes frmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes frmSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ===== Panel ===== */
        .frm-panel {
          background: #ffffff;
          border-radius: 20px;
          max-width: 560px;
          width: 100%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
          animation: frmSlideUp 0.3s ease;
          outline: none;
          user-select: none;
          -webkit-user-select: none;
        }
        :global(.dark-mode) .frm-panel {
          background: #2d2640;
          color: #f0ecf7;
        }

        /* ===== Close button ===== */
        .frm-close {
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
        .frm-close:hover {
          background: rgba(0, 0, 0, 0.12);
          color: #555;
        }
        :global(.dark-mode) .frm-close {
          background: rgba(255, 255, 255, 0.1);
          color: #aaa;
        }
        :global(.dark-mode) .frm-close:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        /* ===== Header ===== */
        .frm-score-header {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 28px 28px 0;
        }
        .frm-score-circle {
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
        .frm-score-value {
          font-size: 1.3rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
        }
        .frm-score-pct {
          font-size: 0.65rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .frm-score-details {
          flex: 1;
        }
        .frm-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #4c4172;
          margin: 0 0 4px;
        }
        :global(.dark-mode) .frm-title {
          color: #c5a6f9;
        }
        .frm-subtitle {
          font-size: 0.85rem;
          color: #888;
          margin: 0;
        }
        :global(.dark-mode) .frm-subtitle {
          color: #bbb;
        }

        .frm-divider {
          border: none;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          margin: 20px 28px 0;
        }
        :global(.dark-mode) .frm-divider {
          border-top-color: rgba(255, 255, 255, 0.1);
        }

        /* ===== Scrollable list ===== */
        .frm-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .frm-list::-webkit-scrollbar {
          width: 5px;
        }
        .frm-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .frm-list::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
        }
        :global(.dark-mode) .frm-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
        }

        /* ===== Flashcard item ===== */
        .frm-item {
          border-radius: 14px;
          padding: 16px;
          background: rgba(157, 138, 219, 0.06);
          border-left: 4px solid #9d8adb;
        }
        :global(.dark-mode) .frm-item {
          background: rgba(157, 138, 219, 0.12);
          border-left-color: #c5a6f9;
        }

        .frm-item-header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }
        .frm-item-num {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #555;
        }
        :global(.dark-mode) .frm-item-num {
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        /* ===== Front / Back sections ===== */
        .frm-label {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 2px 8px;
          border-radius: 6px;
          margin-bottom: 4px;
        }
        .frm-card-front .frm-label {
          background: rgba(76, 65, 114, 0.1);
          color: #4c4172;
        }
        :global(.dark-mode) .frm-card-front .frm-label {
          background: rgba(197, 166, 249, 0.15);
          color: #c5a6f9;
        }
        .frm-card-back .frm-label {
          background: rgba(74, 222, 128, 0.1);
          color: #15803d;
        }
        :global(.dark-mode) .frm-card-back .frm-label {
          background: rgba(74, 222, 128, 0.15);
          color: #4ade80;
        }

        .frm-card-text {
          font-size: 0.92rem;
          color: #333;
          margin: 0;
          line-height: 1.55;
        }
        :global(.dark-mode) .frm-card-text {
          color: #e0dce8;
        }

        .frm-card-separator {
          height: 1px;
          background: rgba(0, 0, 0, 0.07);
          margin: 10px 0;
        }
        :global(.dark-mode) .frm-card-separator {
          background: rgba(255, 255, 255, 0.08);
        }

        /* ===== Footer ===== */
        .frm-footer {
          padding: 16px 28px 24px;
          display: flex;
          justify-content: center;
        }
        .frm-done-btn {
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
        .frm-done-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 18px rgba(157, 138, 219, 0.45);
        }

        /* ===== Mobile ===== */
        @media (max-width: 640px) {
          .frm-panel {
            max-height: 92vh;
            border-radius: 16px;
          }
          .frm-score-header {
            padding: 22px 18px 0;
            gap: 14px;
          }
          .frm-list {
            padding: 14px 18px;
          }
          .frm-divider {
            margin: 16px 18px 0;
          }
          .frm-footer {
            padding: 14px 18px 20px;
          }
          .frm-score-circle {
            width: 60px;
            height: 60px;
          }
          .frm-score-value {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
  );
}
