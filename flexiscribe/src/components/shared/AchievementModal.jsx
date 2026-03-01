"use client";
import React, { useEffect, useState } from "react";

/**
 * AchievementModal — shown when the student earns one or more achievements.
 *
 * Props:
 *   isOpen       - boolean
 *   onClose      - () => void
 *   achievements - Array<{ id, name, description, icon, rarity }>
 *                  (rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary')
 */
export default function AchievementModal({ isOpen, onClose, achievements = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index whenever the modal opens with a new batch
  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || achievements.length === 0) return null;

  const achievement = achievements[currentIndex];
  const isLast = currentIndex === achievements.length - 1;
  const total = achievements.length;

  const rarityColors = {
    common:    { bg: "#95a5a6", label: "Common" },
    uncommon:  { bg: "#27ae60", label: "Uncommon" },
    rare:      { bg: "#3498db", label: "Rare" },
    epic:      { bg: "#9b59b6", label: "Epic" },
    legendary: { bg: "linear-gradient(135deg, #f39c12, #e74c3c)", label: "Legendary" },
  };

  const rarityKey = (achievement.rarity || achievement.category || "common").toLowerCase();
  const rarity = rarityColors[rarityKey] || rarityColors.common;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <div className="ach-overlay" onClick={onClose}>
      <div className="ach-content" onClick={(e) => e.stopPropagation()}>

        {/* Header label */}
        <p className="ach-eyebrow">🏆 Achievement Unlocked!</p>

        {/* Icon */}
        <div className="ach-icon-wrap">
          <span className="ach-icon-emoji">{achievement.icon}</span>
          <span className="ach-glow" />
        </div>

        {/* Name */}
        <h3 className="ach-name">{achievement.name}</h3>

        {/* Rarity badge */}
        <span className="ach-rarity-badge" style={{ background: rarity.bg }}>
          {rarity.label}
        </span>

        {/* Description */}
        <p className="ach-description">{achievement.description}</p>

        {/* Counter */}
        {total > 1 && (
          <p className="ach-counter">{currentIndex + 1} of {total}</p>
        )}

        {/* Actions */}
        <div className="ach-actions">
          <button className="ach-btn" onClick={handleNext}>
            {isLast ? "Awesome! 🎉" : "Next Achievement →"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .ach-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: achFadeIn 0.2s ease;
        }

        @keyframes achFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes achSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        @keyframes achPulse {
          0%, 100% { transform: scale(1);    opacity: 0.35; }
          50%       { transform: scale(1.18); opacity: 0.6;  }
        }

        @keyframes achBounce {
          0%   { transform: scale(0.7) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.12) rotate(4deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        .ach-content {
          background: #ffffff;
          border-radius: 28px;
          padding: 36px 32px 28px;
          max-width: 420px;
          width: 90%;
          text-align: center;
          position: relative;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(197, 166, 249, 0.25);
          animation: achSlideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }

        /* top accent stripe */
        .ach-content::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(135deg, #9d8adb 0%, #c5a6f9 50%, #4c4172 100%);
        }

        :global(.dark-mode) .ach-content {
          background: #2d2640;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(197, 166, 249, 0.2);
        }

        .ach-eyebrow {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9d8adb;
          margin: 0 0 20px;
        }

        :global(.dark-mode) .ach-eyebrow {
          color: #c5a6f9;
        }

        .ach-icon-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 96px;
          height: 96px;
          margin: 0 auto 20px;
        }

        .ach-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(197, 166, 249, 0.45) 0%, transparent 70%);
          animation: achPulse 2.4s ease-in-out infinite;
        }

        .ach-icon-emoji {
          font-size: 56px;
          line-height: 1;
          position: relative;
          z-index: 1;
          animation: achBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          display: block;
        }

        .ach-name {
          font-size: 1.35rem;
          font-weight: 800;
          color: #4c4172;
          margin: 0 0 12px;
          line-height: 1.2;
        }

        :global(.dark-mode) .ach-name {
          color: #c5a6f9;
        }

        .ach-rarity-badge {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #fff;
          margin-bottom: 16px;
        }

        .ach-description {
          font-size: 0.93rem;
          color: #666;
          line-height: 1.65;
          margin: 0 0 8px;
        }

        :global(.dark-mode) .ach-description {
          color: #bbb;
        }

        .ach-counter {
          font-size: 0.8rem;
          color: #aaa;
          margin: 0 0 20px;
          font-style: italic;
        }

        :global(.dark-mode) .ach-counter {
          color: #888;
        }

        .ach-actions {
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }

        .ach-btn {
          padding: 12px 36px;
          border-radius: 14px;
          font-size: 0.97rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #9d8adb 0%, #4c4172 100%);
          color: #fff;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          box-shadow: 0 4px 16px rgba(157, 138, 219, 0.35);
          letter-spacing: 0.01em;
        }

        .ach-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(157, 138, 219, 0.5);
        }

        .ach-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
