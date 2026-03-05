import React from "react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="neu-footer">
      <p className="copyright-text">
        &copy; {currentYear} fLexiScribe. All rights reserved.
      </p>
    </footer>
  );
}