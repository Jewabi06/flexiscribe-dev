import "./styles.css";

export default function EducatorTranscriptionEditorLayout({ children }) {
  return (
    <main className="edu-main-content edu-scrollbar min-h-screen overflow-y-auto transition-colors duration-300 bg-white dark:bg-[#1a1625]">
      <div className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
      </div>
    </main>
  );
}
