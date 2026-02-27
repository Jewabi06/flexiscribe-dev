"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  CheckSquare,
  FileText,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from "lucide-react";

import RawTranscriptTable from "@/components/admin/tables/RawTranscriptTable";
import MessageModal from "@/components/shared/MessageModal";
import LoadingScreen from "@/components/shared/LoadingScreen";

export default function ClassAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: "", message: "", type: "info" });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/class-analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportSummaryPDF = async () => {
    if (!analytics) return;

    try {
      // Create a simple HTML content for PDF
      const content = `
        <html>
          <head>
            <title>Class Analytics Summary</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; }
              h1 { color: #4c4172; }
              h2 { color: #6f63a6; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #9d8adb; color: white; }
              .metric { display: inline-block; margin: 10px 20px; }
              .metric-label { color: #666; font-size: 14px; }
              .metric-value { font-size: 24px; font-weight: bold; color: #4c4172; }
            </style>
          </head>
          <body>
            <h1>Class Analytics Summary</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            
            <h2>Generated Content</h2>
            <div>
              <div class="metric">
                <div class="metric-label">Flashcards</div>
                <div class="metric-value">${analytics.generatedContent.flashcards}</div>
              </div>
              <div class="metric">
                <div class="metric-label">MCQs</div>
                <div class="metric-value">${analytics.generatedContent.mcqs}</div>
              </div>
              <div class="metric">
                <div class="metric-label">FITB</div>
                <div class="metric-value">${analytics.generatedContent.fitb}</div>
              </div>
            </div>
            
            <h2>Class Overview</h2>
            <div>
              <div class="metric">
                <div class="metric-label">Students</div>
                <div class="metric-value">${analytics.overview.totalStudents}</div>
              </div>
              <div class="metric">
                <div class="metric-label">Avg Score</div>
                <div class="metric-value">${analytics.overview.avgScore}%</div>
              </div>
              <div class="metric">
                <div class="metric-label">Engagement</div>
                <div class="metric-value">${analytics.overview.engagement}</div>
              </div>
              <div class="metric">
                <div class="metric-label">Reviewers</div>
                <div class="metric-value">${analytics.overview.totalReviewers}</div>
              </div>
            </div>
          </body>
        </html>
      `;

      // Create a blob and download
      const blob = new Blob([content], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `class_analytics_${new Date().toISOString().split("T")[0]}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setModalInfo({ isOpen: true, title: "Export Complete", message: "Analytics summary downloaded as HTML. Open in browser and use 'Print to PDF' to convert to PDF.", type: "success" });
    } catch (error) {
      console.error("Error exporting summary:", error);
      setModalInfo({ isOpen: true, title: "Export Failed", message: "Failed to export summary. Please try again.", type: "error" });
    }
  };

  // Default values while loading
  const totals = analytics?.generatedContent || {
    flashcards: 0,
    mcqs: 0,
    fitb: 0,
  };

  // Mock weekly deltas (can be enhanced later)
  const deltas = {
    flashcards: 0,
    mcqs: 0,
    fitb: 0,
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#f4f3fb] px-4 sm:px-6 py-6 sm:py-8 space-y-14">
      {/* ================= TRANSCRIPTS ================= */}
      <section className="space-y-4">
        <SectionTitle>Transcripts</SectionTitle>
        <RawTranscriptTable />
      </section>

      {/* ================= GENERATED CONTENT ================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionTitle>Generated Content</SectionTitle>

          <button
            onClick={exportSummaryPDF}
            disabled={loading || !analytics}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border bg-white text-[#4c4172] hover:bg-[#edeaf7] transition disabled:opacity-50"
          >
            <Download size={14} />
            Export Summary (PDF)
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-[#9d8adb]">
            Loading analytics...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 -mt-2">
            <StatCard
              icon={Layers}
              label="Flashcards"
              value={totals.flashcards}
              delta={deltas.flashcards}
            />
            <StatCard
              icon={CheckSquare}
              label="MCQs"
              value={totals.mcqs}
              delta={deltas.mcqs}
            />
            <StatCard
              icon={FileText}
              label="FITB"
              value={totals.fitb}
              delta={deltas.fitb}
            />
          </div>
        )}
      </section>

      {/* ================= CLASS OVERVIEW ================= */}
      {!loading && analytics && (
        <section className="space-y-5">
          <SectionTitle>Class Overview</SectionTitle>

          <div className="relative rounded-3xl bg-gradient-to-br from-[#8f7fd1] to-[#4c4172] p-6 sm:p-8 shadow-lg overflow-hidden">
            {/* subtle glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,white,transparent_65%)] opacity-20" />

            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-7 text-white">
              <OverviewMetric
                icon={Users}
                label="Students"
                value={analytics.overview.totalStudents}
              />
              <OverviewMetric
                icon={CheckSquare}
                label="Avg Score"
                value={`${analytics.overview.avgScore}%`}
              />
              <OverviewMetric
                icon={Activity}
                label="Engagement"
                value={analytics.overview.engagement}
                highlight
              />
              <OverviewMetric
                icon={Layers}
                label="Reviewers"
                value={analytics.overview.totalReviewers}
              />
            </div>

            <div className="relative mt-8 pt-4 border-t border-white/20 flex flex-col sm:flex-row justify-between text-xs text-white/80">
              <span>
                Total Classes: <b className="text-white">{analytics.classes?.length || 0}</b>
              </span>
              <span>
                Total Quizzes: <b className="text-white">{totals.flashcards + totals.mcqs + totals.fitb}</b>
              </span>
            </div>
          </div>
        </section>
      )}
      <MessageModal
        isOpen={modalInfo.isOpen}
        onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}

/* ================= COMPONENTS ================= */

function SectionTitle({ children }) {
  return (
    <h2
      className="
        text-xs sm:text-sm
        font-semibold
        tracking-widest
        uppercase
        text-[#4c4172]
        border-l-4
        border-[#9d8adb]
        pl-3
      "
    >
      {children}
    </h2>
  );
}

function StatCard({ icon: Icon, label, value, delta }) {
  const positive = delta > 0;
  const negative = delta < 0;

  return (
    <div
      className="
        bg-white
        rounded-2xl
        border border-[#e3def4]
        px-5 py-4
        shadow-sm
        transition
        hover:-translate-y-1
        hover:shadow-md
      "
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#edeaf7] flex items-center justify-center text-[#6f66b8]">
            <Icon size={18} />
          </div>

          <div>
            <div className="text-2xl font-semibold text-[#3f3764]">
              {value}
            </div>
            <div className="text-xs text-[#6b6396]">{label}</div>
          </div>
        </div>

        <DeltaBadge positive={positive} negative={negative}>
          {positive && <ArrowUpRight size={14} />}
          {negative && <ArrowDownRight size={14} />}
          {!positive && !negative && "—"}
          {delta !== 0 && `${Math.abs(delta)}%`}
        </DeltaBadge>
      </div>

      <div className="mt-2 text-[11px] text-[#8a82b3]">
        vs last week
      </div>
    </div>
  );
}

function DeltaBadge({ children, positive, negative }) {
  return (
    <span
      className={`
        text-xs
        px-2 py-1
        rounded-full
        flex items-center gap-1
        ${
          positive
            ? "bg-green-100 text-green-700"
            : negative
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-500"
        }
      `}
    >
      {children}
    </span>
  );
}

function OverviewMetric({ icon: Icon, label, value, highlight }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/80">
        <Icon size={14} />
        {label}
      </div>

      <div
        className={`text-2xl font-semibold ${
          highlight ? "text-[#ffe9a7]" : ""
        }`}
      >
        {value}
      </div>

      {highlight && (
        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/20">
          Active
        </span>
      )}
    </div>
  );
}
