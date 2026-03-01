import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Force Node.js runtime (needed for streaming responses)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/transcribe/live?sessionId=xxx
 * Proxies the Server-Sent Events stream from the FastAPI backend.
 * Provides real-time 10-second transcript chunks to the frontend.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Proxy SSE stream from FastAPI backend
    const response = await fetch(
      `${FASTAPI_URL}/transcribe/live/${sessionId}`,
      {
        headers: { Accept: "text/event-stream" },
      }
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error:
            errorText.slice(0, 200) ||
            "Failed to connect to transcription live stream",
        }),
        {
          status: response.status || 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Forward the SSE stream directly to the client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Live stream proxy error:", error);
    const message =
      error instanceof Error ? error.message : "Stream proxy failed";

    if (
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("connect")
    ) {
      return new Response(
        JSON.stringify({
          error: `Cannot reach transcription backend (${FASTAPI_URL}). Is the FastAPI server running?`,
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
