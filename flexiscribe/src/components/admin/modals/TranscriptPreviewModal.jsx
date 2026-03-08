"use client";

import { createPortal } from "react-dom";

export default function TranscriptPreviewModal({ transcript, onClose }) {
  if (!transcript) return null;

  const rawContent = transcript.content || transcript.rawText || "";
  const cues = transcript.cue || [];
  const processedLines = processTranscript(rawContent, cues);
  const filename = `${transcript.course}_${transcript.title?.replace(/\s+/g, "_")}.txt`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* MODAL */}
      <div
        className="
          relative
          w-full sm:max-w-4xl
          bg-white
          rounded-t-2xl sm:rounded-2xl
          shadow-2xl
          flex flex-col
          max-h-[90vh]
          overflow-hidden
        "
      >
        {/* HEADER */}
        <div className="px-5 py-4 bg-gradient-to-br from-[#9d8adb] to-[#4c4172]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm sm:text-lg font-semibold text-white">
                {transcript.title}
              </h2>
              <p className="text-xs text-white/80 mt-1">
                {transcript.course} • Section {transcript.section} • {transcript.date}
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-white text-xl hover:opacity-80"
            >
              ×
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden">
          {/* CONTENT */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-[#3f3764]">
            <Section title="Transcript">
              <div className="space-y-3 text-sm leading-7">
                {processedLines.map((line, idx) => (
                  <p key={idx} id={`line-${idx}`}>
                    <span dangerouslySetInnerHTML={{ __html: line.text }} />
                  </p>
                ))}
              </div>
            </Section>
          </main>
        </div>

        {/* FOOTER */}
        <div className="px-4 py-3 border-t bg-[#f7f6fb] flex flex-col sm:flex-row gap-2 sm:justify-between items-center">
          <span className="text-xs text-gray-500 truncate max-w-full">
            {filename}
          </span>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => downloadTXT(filename, rawContent)}
              className="px-4 py-2 text-sm rounded-md bg-[#edeaf7] text-[#4c4172]"
            >
              Download TXT
            </button>

            <button
              onClick={() => downloadPDF(transcript.title, rawContent)}
              className="px-4 py-2 text-sm rounded-md bg-[#9d8adb] text-white hover:bg-[#4c4172]"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------- HELPERS ---------------- */

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase mb-2 text-[#4c4172]">
        {title}
      </h3>
      <div className="bg-[#f7f6fb] border border-[#e3def4] rounded-lg p-4">
        {children}
      </div>
    </div>
  );
}

function processTranscript(content, cues) {
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const timestampMatch = line.match(/^\[(.*?)\]/);
      let text = line.replace(/^\[.*?\]\s*/, "");

      cues.forEach((cue) => {
        const regex = new RegExp(`(${cue})`, "gi");
        text = text.replace(
          regex,
          `<mark class="bg-[#e6e0f7] text-[#4c4172] rounded px-1">$1</mark>`
        );
      });

      return {
        timestamp: timestampMatch?.[0] || null,
        text,
      };
    });
}

function downloadTXT(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(title, content) {
  const win = window.open("", "_blank");
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial; padding: 40px; line-height: 1.7; }
          h1 { margin-bottom: 24px; }
          pre { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <pre>${content}</pre>
      </body>
    </html>
  `);
  win.document.close();
  win.print();
}
