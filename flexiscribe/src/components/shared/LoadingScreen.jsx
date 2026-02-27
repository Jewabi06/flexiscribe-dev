"use client";
import React from "react";

/**
 * Universal loading screen for admin, educator, and student portals.
 * Aligned to the brand design system: purple gradient, Inter font,
 * neumorphic shadows, and bg-img.png background texture.
 * Mobile-first and device-responsive.
 */
export default function LoadingScreen() {
  return (
    <div className="ls-screen" role="status" aria-label="Loading fLexiScribe">
      {/* Background texture overlay */}
      <div className="ls-bg-texture" aria-hidden="true" />

      {/* Ambient glow orbs */}
      <div className="ls-orb ls-orb-1" aria-hidden="true" />
      <div className="ls-orb ls-orb-2" aria-hidden="true" />

      <div className="ls-content">
        {/* Logo with orbital ring */}
        <div className="ls-logo-frame" aria-hidden="true">
          <div className="ls-orbital-track">
            <div className="ls-orbital-dot" />
          </div>
          <div className="ls-logo-wrapper">
            <img
              src="/img/fLexiScribe-logo.png"
              alt="fLexiScribe"
              className="ls-logo"
              draggable={false}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className="ls-bar-track" aria-hidden="true">
          <div className="ls-bar-fill" />
        </div>

        {/* Label */}
        <p className="ls-label">
          Loading<span className="ls-dots" aria-hidden="true" />
        </p>
      </div>

      <style jsx>{`
        /* ── Base screen ── */
        .ls-screen {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #9d8adb 0%, #4c4172 100%);
          z-index: 99999;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        /* ── Background texture (matches portal bg-img.png) ── */
        .ls-bg-texture {
          position: absolute;
          inset: 0;
          background-image: url('/img/bg-img.png');
          background-size: cover;
          background-position: center;
          opacity: 0.12;
          pointer-events: none;
        }

        /* ── Ambient glow orbs ── */
        .ls-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(60px);
          animation: orbFloat 6s ease-in-out infinite;
        }
        .ls-orb-1 {
          width: clamp(180px, 40vw, 360px);
          height: clamp(180px, 40vw, 360px);
          background: radial-gradient(circle, rgba(197, 166, 249, 0.35) 0%, transparent 70%);
          top: -10%;
          right: -10%;
          animation-delay: 0s;
        }
        .ls-orb-2 {
          width: clamp(140px, 30vw, 280px);
          height: clamp(140px, 30vw, 280px);
          background: radial-gradient(circle, rgba(76, 65, 114, 0.5) 0%, transparent 70%);
          bottom: -8%;
          left: -8%;
          animation-delay: -3s;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(12px, -16px) scale(1.06); }
        }

        /* ── Content stack ── */
        .ls-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(16px, 4vw, 28px);
          padding: clamp(24px, 6vw, 48px);
        }

        /* ── Logo frame with orbital ring ── */
        .ls-logo-frame {
          position: relative;
          width: clamp(100px, 22vw, 160px);
          height: clamp(100px, 22vw, 160px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Orbital track */
        .ls-orbital-track {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.12);
          animation: orbitSpin 3s linear infinite;
        }
        /* Glowing dot on the orbital path */
        .ls-orbital-dot {
          position: absolute;
          top: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: clamp(8px, 1.5vw, 10px);
          height: clamp(8px, 1.5vw, 10px);
          border-radius: 50%;
          background: #c5a6f9;
          box-shadow:
            0 0 8px 3px rgba(197, 166, 249, 0.7),
            0 0 20px 6px rgba(197, 166, 249, 0.35);
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Logo wrapper — pulse glow */
        .ls-logo-wrapper {
          animation: logoPulse 2.4s ease-in-out infinite;
          filter: drop-shadow(0 6px 24px rgba(0, 0, 0, 0.25));
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 6px 24px rgba(0,0,0,0.25)); }
          50%       { transform: scale(1.06); filter: drop-shadow(0 8px 32px rgba(197,166,249,0.4)); }
        }

        .ls-logo {
          width: clamp(72px, 16vw, 120px);
          height: clamp(72px, 16vw, 120px);
          object-fit: contain;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }

        /* ── Progress bar ── */
        .ls-bar-track {
          width: clamp(120px, 40vw, 200px);
          height: 3px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.15);
          overflow: hidden;
        }
        .ls-bar-fill {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #c5a6f9 0%, #ffffff 50%, #c5a6f9 100%);
          background-size: 200% 100%;
          animation: barShimmer 1.6s ease-in-out infinite;
        }
        @keyframes barShimmer {
          0%   { background-position: 200% 0; width: 40%; }
          50%  { background-position: 0% 0;   width: 75%; }
          100% { background-position: -200% 0; width: 40%; }
        }

        /* ── Label ── */
        .ls-label {
          color: rgba(255, 255, 255, 0.88);
          font-size: clamp(0.8rem, 2.5vw, 0.95rem);
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin: 0;
        }
        .ls-dots::after {
          content: '';
          animation: dots 1.6s steps(4, end) infinite;
        }
        @keyframes dots {
          0%   { content: ''; }
          25%  { content: '.'; }
          50%  { content: '..'; }
          75%  { content: '...'; }
          100% { content: ''; }
        }

        /* ── Reduced-motion accessibility ── */
        @media (prefers-reduced-motion: reduce) {
          .ls-orb,
          .ls-logo-wrapper,
          .ls-orbital-track,
          .ls-bar-fill,
          .ls-dots::after {
            animation: none;
          }
          .ls-bar-fill {
            width: 60%;
            background-position: 0;
          }
          .ls-dots::after {
            content: '...';
          }
        }

        /* ── Responsive breakpoints (mobile-first) ── */

        /* xs — phones ≤ 360px */
        @media (max-width: 360px) {
          .ls-content { gap: 14px; padding: 20px; }
          .ls-logo-frame { width: 88px; height: 88px; }
          .ls-logo { width: 64px; height: 64px; }
          .ls-bar-track { width: 110px; }
        }

        /* sm — phones 361–639px (default mobile-first already covers this) */

        /* md — tablets 640px+ */
        @media (min-width: 640px) {
          .ls-content { gap: 24px; }
          .ls-logo-frame { width: 140px; height: 140px; }
          .ls-logo { width: 104px; height: 104px; }
          .ls-bar-track { width: 180px; }
          .ls-label { font-size: 0.9rem; }
        }

        /* lg — desktops 1024px+ */
        @media (min-width: 1024px) {
          .ls-content { gap: 28px; }
          .ls-logo-frame { width: 160px; height: 160px; }
          .ls-logo { width: 120px; height: 120px; }
          .ls-bar-track { width: 200px; }
          .ls-label { font-size: 0.95rem; }
        }
      `}</style>
    </div>
  );
}
