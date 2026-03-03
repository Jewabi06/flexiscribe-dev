"use client";
import React from "react";
import "../../styles/globals.css";

/**
 * Universal loading screen for admin, educator, and student portals.
 * Aligned to the brand design system: purple gradient, Inter font,
 * neumorphic shadows, and bg-img.png background texture.
 * Mobile-first and device-responsive.
 */
export default function LoadingScreen() {
  return (
    <div className="ls-screen" role="status" aria-label="Loading">
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
    </div>
  );
}
