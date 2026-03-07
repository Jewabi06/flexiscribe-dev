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
      const html2pdf = (await import("html2pdf.js")).default;

      const totalQuizzes = (analytics.generatedContent.flashcards || 0) + (analytics.generatedContent.mcqs || 0) + (analytics.generatedContent.fitb || 0);
      const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const generatedTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      // Build professional HTML for PDF
      const container = document.createElement("div");
      container.innerHTML = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2d2640; padding: 0; max-width: 750px; margin: 0 auto;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #9d8adb 0%, #4c4172 100%); color: white; padding: 40px 36px 32px; border-radius: 0 0 24px 24px; margin-bottom: 32px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 style="margin: 0 0 4px 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Class Analytics Report</h1>
                <p style="margin: 0; font-size: 13px; opacity: 0.85;">fLexiScribe &mdash; Comprehensive Analytics Summary</p>
              </div>
              <div style="text-align: right; font-size: 12px; opacity: 0.8;">
                <div>${generatedDate}</div>
                <div>${generatedTime}</div>
              </div>
            </div>
          </div>

          <!-- Summary Metrics -->
          <div style="padding: 0 36px;">
            <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #4c4172; border-left: 4px solid #9d8adb; padding-left: 12px; margin: 0 0 16px 0;">Key Metrics Overview</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 32px;">
              <div style="background: #f8f7fd; border: 1px solid #e3def4; border-radius: 14px; padding: 18px 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #4c4172;">${analytics.overview.totalStudents}</div>
                <div style="font-size: 11px; color: #6b6396; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.8px;">Students</div>
              </div>
              <div style="background: #f8f7fd; border: 1px solid #e3def4; border-radius: 14px; padding: 18px 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #4c4172;">${analytics.overview.avgScore}%</div>
                <div style="font-size: 11px; color: #6b6396; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.8px;">Avg Score</div>
              </div>
              <div style="background: #f8f7fd; border: 1px solid #e3def4; border-radius: 14px; padding: 18px 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: ${analytics.overview.engagement === 'High' ? '#16a34a' : analytics.overview.engagement === 'Medium' ? '#ca8a04' : '#dc2626'};">${analytics.overview.engagement}</div>
                <div style="font-size: 11px; color: #6b6396; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.8px;">Engagement</div>
              </div>
              <div style="background: #f8f7fd; border: 1px solid #e3def4; border-radius: 14px; padding: 18px 16px; text-align: center;">
                <div style="font-size: 28px; font-weight: 700; color: #4c4172;">${totalQuizzes}</div>
                <div style="font-size: 11px; color: #6b6396; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.8px;">Total Quizzes</div>
              </div>
            </div>

            <!-- Generated Content Breakdown -->
            <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #4c4172; border-left: 4px solid #9d8adb; padding-left: 12px; margin: 0 0 16px 0;">Generated Content Breakdown</h2>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; border-radius: 12px; overflow: hidden; border: 1px solid #e3def4;">
              <thead>
                <tr>
                  <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Content Type</th>
                  <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Count</th>
                  <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 13px 18px; font-size: 13px; color: #3f3764; border-bottom: 1px solid #f0edf8;">📚 Flashcards</td>
                  <td style="padding: 13px 18px; font-size: 13px; color: #3f3764; text-align: center; font-weight: 600; border-bottom: 1px solid #f0edf8;">${analytics.generatedContent.flashcards}</td>
                  <td style="padding: 13px 18px; font-size: 13px; color: #6b6396; text-align: center; border-bottom: 1px solid #f0edf8;">${totalQuizzes > 0 ? Math.round((analytics.generatedContent.flashcards / totalQuizzes) * 100) : 0}%</td>
                </tr>
                <tr style="background: #faf9fe;">
                  <td style="padding: 13px 18px; font-size: 13px; color: #3f3764; border-bottom: 1px solid #f0edf8;">✅ Multiple Choice (MCQ)</td>
                  <td style="padding: 13px 18px; font-size: 13px; color: #3f3764; text-align: center; font-weight: 600; border-bottom: 1px solid #f0edf8;">${analytics.generatedContent.mcqs}</td>
                  <td style="padding: 13px 18px; font-size: 13px; color: #6b6396; text-align: center; border-bottom: 1px solid #f0edf8;">${totalQuizzes > 0 ? Math.round((analytics.generatedContent.mcqs / totalQuizzes) * 100) : 0}%</td>
                </tr>
                <tr>
                  <td style="padding: 13px 18px; font-size: 13px; color: #3f3764;">📝 Fill in the Blank (FITB)</td>
                  <td style="padding: 13px 18px; font-size: 13px; color: #3f3764; text-align: center; font-weight: 600;">${analytics.generatedContent.fitb}</td>
                  <td style="padding: 13px 18px; font-size: 13px; color: #6b6396; text-align: center;">${totalQuizzes > 0 ? Math.round((analytics.generatedContent.fitb / totalQuizzes) * 100) : 0}%</td>
                </tr>
              </tbody>
            </table>

            <!-- Class Details -->
            ${analytics.classes && analytics.classes.length > 0 ? `
              <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #4c4172; border-left: 4px solid #9d8adb; padding-left: 12px; margin: 0 0 16px 0;">Class Details</h2>
              <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; border-radius: 12px; overflow: hidden; border: 1px solid #e3def4;">
                <thead>
                  <tr>
                    <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Class Name</th>
                    <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Subject</th>
                    <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Educator</th>
                    <th style="background: linear-gradient(135deg, #9d8adb, #7a6bc4); color: white; padding: 14px 18px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Section</th>
                  </tr>
                </thead>
                <tbody>
                  ${analytics.classes.map((cls, i) => `
                    <tr style="${i % 2 === 1 ? 'background: #faf9fe;' : ''}">
                      <td style="padding: 12px 18px; font-size: 13px; color: #3f3764; font-weight: 500; border-bottom: 1px solid #f0edf8;">${cls.name || '—'}</td>
                      <td style="padding: 12px 18px; font-size: 13px; color: #3f3764; border-bottom: 1px solid #f0edf8;">${cls.subject || '—'}</td>
                      <td style="padding: 12px 18px; font-size: 13px; color: #6b6396; border-bottom: 1px solid #f0edf8;">${cls.educator?.fullName || '—'}</td>
                      <td style="padding: 12px 18px; font-size: 13px; color: #6b6396; border-bottom: 1px solid #f0edf8;">${cls.section || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <!-- Footer -->
            <div style="border-top: 2px solid #e3def4; padding-top: 20px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 11px; color: #9d8adb;">
                <strong>fLexiScribe</strong> &mdash; Your Note-Taking Assistant
              </div>
              <div style="font-size: 11px; color: #a09bbc;">
                Report generated on ${generatedDate} at ${generatedTime}
              </div>
            </div>
          </div>
        </div>
      `;

      // Generate PDF
      const opt = {
        margin: [10, 0, 10, 0],
        filename: `FlexiScribe_Class_Analytics_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(container).save();

      setModalInfo({ isOpen: true, title: "Export Complete", message: "Analytics summary has been downloaded as a PDF.", type: "success" });
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
    <div className="min-h-screen bg-[#f4f3fb] px-4 py-2 sm:py-1 space-y-10">
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
