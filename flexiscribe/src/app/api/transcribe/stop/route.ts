import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const FASTAPI_TIMEOUT_MS = 55_000;

function hasStructuredSummaryData(summary: unknown) {
  if (!summary || typeof summary !== "object") return false;
  const summaryObj = summary as Record<string, unknown>;
  return Boolean(
    summaryObj.title ||
      summaryObj.meeting_title ||
      (Array.isArray(summaryObj.notes) && summaryObj.notes.length > 0) ||
      (Array.isArray(summaryObj.key_concepts) && summaryObj.key_concepts.length > 0) ||
      (Array.isArray(summaryObj.cue_questions) && summaryObj.cue_questions.length > 0) ||
      (Array.isArray(summaryObj.agendas) && summaryObj.agendas.length > 0) ||
      (Array.isArray(summaryObj.summary) && summaryObj.summary.length > 0) ||
      (typeof summaryObj.summary === "string" && summaryObj.summary.trim().length > 0)
  );
}

function normalizeSummaryJson(summary: unknown) {
  if (summary === null || summary === undefined) return null;

  if (typeof summary === "string") {
    const trimmed = summary.trim();
    if (!trimmed) return null;
    try {
      return normalizeSummaryJson(JSON.parse(trimmed));
    } catch {
      return { summary: [trimmed] };
    }
  }

  if (Array.isArray(summary)) {
    if (summary.every((item) => typeof item === "string")) {
      return { summary };
    }
    if (summary.every((item) => typeof item === "object" && item !== null)) {
      return { notes: summary };
    }
    return { summary: summary.map((item) => String(item)) };
  }

  if (typeof summary === "object") {
    const normalized = { ...(summary as Record<string, unknown>) };

    if (typeof normalized.summary === "string") {
      const text = (normalized.summary as string).trim();
      normalized.summary = text ? [text] : [];
    }

    if (Array.isArray(normalized.summary) && normalized.summary.length > 0) {
      return normalized;
    }

    if (typeof normalized.notes === "string") {
      const text = (normalized.notes as string).trim();
      normalized.notes = text ? [text] : [];
    }

    if (hasStructuredSummaryData(normalized)) {
      return normalized;
    }

    // If object doesn't match known shapes, flatten to summary text.
    const fallbackText = JSON.stringify(normalized);
    return { summary: [fallbackText] };
  }

  return null;
}

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "EDUCATOR") {
      return NextResponse.json({ error: "Educator access only" }, { status: 403 });
    }

    let body: { sessionId?: string; transcriptionId?: string } = {};
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { sessionId, transcriptionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FASTAPI_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${FASTAPI_URL}/transcribe/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          transcription_id: transcriptionId || null,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      const errMessage =
        fetchError instanceof Error
          ? fetchError.message
          : String(fetchError);
      if (
        (fetchError instanceof DOMException && fetchError.name === "AbortError") ||
        (fetchError instanceof Error && fetchError.name === "AbortError")
      ) {
        return NextResponse.json(
          {
            error: `Transcription backend request timed out after ${FASTAPI_TIMEOUT_MS / 1000} seconds.`,
          },
          { status: 504 }
        );
      }
      return NextResponse.json(
        {
          error: `Unable to reach transcription backend: ${errMessage}`,
        },
        { status: 503 }
      );
    }

    clearTimeout(timeout);

    const rawResponse = await response.text().catch(() => "");
    let data: any = null;
    try {
      data = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      let errorMsg = "Failed to stop transcription";
      if (data?.error) {
        errorMsg = data.error;
      } else if (data?.detail) {
        errorMsg = data.detail;
      } else if (rawResponse) {
        errorMsg = rawResponse.slice(0, 200);
      } else {
        errorMsg = `FastAPI returned status ${response.status}`;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    if (!data) {
      return NextResponse.json(
        {
          error: `Transcription backend returned invalid JSON: ${rawResponse.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    const duration = typeof data.duration === "string" ? data.duration : "0m 0s";
    const transcript = data.transcript && typeof data.transcript === "object" ? data.transcript : {};
    const liveTranscript = data.live_transcript && typeof data.live_transcript === "object" ? data.live_transcript : null;
    const minuteSummaries = Array.isArray(data.minute_summaries) ? data.minute_summaries : null;
    const finalSummary = data.final_summary ?? data.summary ?? data.summaryJson ?? null;
    const summaryPending = Boolean(data.summary_pending);
    const normalizedSummary = normalizeSummaryJson(finalSummary);
    const hasFinalSummary = Boolean(normalizedSummary);

    // Build content HTML from transcript chunks
    const chunks = Array.isArray(transcript.chunks) ? transcript.chunks : [];
    const contentHtml = chunks
      .map(
        (c: { minute: number; timestamp: string; text: string }) =>
          `<p><strong>[${c.timestamp}]</strong> ${c.text}</p>`
      )
      .join("\n");

    const rawText = chunks.map((c: { text: string }) => c.text).join("\n");

    // Always update transcription with transcript and minute summaries
    if (transcriptionId) {
      const updateData: any = {
        content: contentHtml,
        rawText,
        duration,
        transcriptJson: transcript,
      };

      if (hasFinalSummary) {
        updateData.summaryJson = normalizedSummary;
        updateData.status = "COMPLETED";
      } else {
        updateData.status = "PROCESSING"; // waiting for final summary callback
      }

      await prisma.transcription.update({
        where: { id: transcriptionId },
        data: updateData,
      });

      if (!hasFinalSummary && summaryPending) {
        // Trigger regeneration only if no final summary is available yet.
        const regenerateUrl = new URL("/api/transcribe/summary/regenerate", request.url).toString();
        void fetch(regenerateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcriptionId }),
        }).catch((err) => {
          console.warn("Forced summary regeneration failed:", err);
        });
      }
    }

    // Tell FastAPI to mark files for deletion (transcript files are no longer needed)
    try {
      await fetch(`${FASTAPI_URL}/transcribe/upload-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          file_type: "all",
        }),
      });
    } catch (cleanupErr) {
      console.warn("File cleanup notification failed:", cleanupErr);
    }

    return NextResponse.json(
      {
        message: summaryPending
          ? "Transcript saved. Final summary will arrive via callback."
          : hasFinalSummary
          ? "Transcript saved and summary generated successfully."
          : "Transcription saved successfully",
        session_id: sessionId,
        transcription_id: transcriptionId,
        status: hasFinalSummary ? "COMPLETED" : "PROCESSING",
        duration,
        chunks_count: chunks.length,
        summary_pending: summaryPending,
        final_summary: hasFinalSummary ? normalizedSummary : null,
        summaryJson: hasFinalSummary ? normalizedSummary : null,
        transcript,
        live_transcript: liveTranscript,
        minute_summaries: minuteSummaries,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Stop transcription error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("connect")) {
      return NextResponse.json(
        { error: `Cannot reach transcription backend (${process.env.FASTAPI_URL || "http://localhost:8000"}). Is the FastAPI server running?` },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}