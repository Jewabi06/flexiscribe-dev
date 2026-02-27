"use client";
import React, { useEffect } from "react";
import { FaCheckCircle, FaTimesCircle, FaInfoCircle, FaTimes } from "react-icons/fa";

/**
 * Reusable MessageModal component to replace all alert() calls.
 *
 * Props:
 *   isOpen    - boolean
 *   onClose   - () => void
 *   title     - string (optional, defaults based on type)
 *   message   - string
 *   type      - 'success' | 'error' | 'info' (default: 'info')
 *   onConfirm - () => void (optional, if provided shows a confirm button)
 */
export default function MessageModal({ isOpen, onClose, title, message, type = "info", onConfirm }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const iconMap = {
    success: <FaCheckCircle style={{ color: "#4ade80", fontSize: "2.5rem" }} />,
    error: <FaTimesCircle style={{ color: "#f87171", fontSize: "2.5rem" }} />,
    info: <FaInfoCircle style={{ color: "#9d8adb", fontSize: "2.5rem" }} />,
  };

  const defaultTitles = {
    success: "Success",
    error: "Error",
    info: "Notice",
  };

  const displayTitle = title || defaultTitles[type] || "Notice";

  return (
    <div className="message-modal-overlay" onClick={onClose}>
      <div className="message-modal-content" onClick={(e) => e.stopPropagation()}>
        {!onConfirm && (
          <button className="message-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        )}

        <div className="message-modal-icon">{iconMap[type]}</div>
        <h3 className="message-modal-title">{displayTitle}</h3>
        <p className="message-modal-message">{message}</p>

        <div className="message-modal-actions">
          {onConfirm ? (
            <>
              <button className="message-modal-btn message-modal-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="message-modal-btn message-modal-btn-primary" onClick={onConfirm}>
                Confirm
              </button>
            </>
          ) : (
            <button className="message-modal-btn message-modal-btn-primary" onClick={onClose}>
              OK
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .message-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: modalFadeIn 0.2s ease;
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .message-modal-content {
          background: #ffffff;
          border-radius: 24px;
          padding: 32px 28px 24px;
          max-width: 420px;
          width: 90%;
          text-align: center;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          animation: modalSlideUp 0.25s ease;
        }

        :global(.dark-mode) .message-modal-content {
          background: #2d2640;
          color: #f5f5f5;
        }

        .message-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0, 0, 0, 0.05);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #888;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .message-modal-close:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #555;
        }

        :global(.dark-mode) .message-modal-close {
          background: rgba(255, 255, 255, 0.1);
          color: #aaa;
        }

        :global(.dark-mode) .message-modal-close:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .message-modal-icon {
          margin-bottom: 16px;
          align-items: center;
          display: flex;
          justify-content: center;
        }

        .message-modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #4c4172;
          margin: 0 0 12px;
        }

        :global(.dark-mode) .message-modal-title {
          color: #c5a6f9;
        }

        .message-modal-message {
          font-size: 0.95rem;
          color: #555;
          line-height: 1.6;
          margin: 0 0 24px;
          white-space: pre-line;
        }

        :global(.dark-mode) .message-modal-message {
          color: #ccc;
        }

        .message-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .message-modal-btn {
          padding: 10px 28px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .message-modal-btn-primary {
          background: linear-gradient(135deg, #9d8adb 0%, #4c4172 100%);
          color: #fff;
        }

        .message-modal-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(157, 138, 219, 0.4);
        }

        .message-modal-btn-secondary {
          background: rgba(0, 0, 0, 0.06);
          color: #555;
        }

        .message-modal-btn-secondary:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        :global(.dark-mode) .message-modal-btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        :global(.dark-mode) .message-modal-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
}
