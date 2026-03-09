"use client";
import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Module-level singleton state for quiz generation.
 *
 * Because Next.js client components share the same JS module across
 * in-app navigations, these variables survive component unmount/remount.
 * This lets us keep the "generating" state alive when the user switches
 * tabs (Dashboard → Quizzes) and comes back.
 *
 * The in-flight fetch promise is stored here so the `.then/.catch` chain
 * keeps running even while the component is unmounted.
 */
let _isGenerating = false;
let _generationPromise = null;   // the live fetch promise (or null)
let _result = null;              // { success, data } | { success: false, error }
let _progress = null;            // { stage, message, percent } — SSE progress
let _selectionValues = null;     // raw dropdown values (lessonId, type, difficulty, count)
let _subscribers = new Set();    // all mounted hook instances

function _notify() {
  _subscribers.forEach((fn) => fn());
}

/**
 * Parse SSE events from a ReadableStream response body.
 * Calls `onEvent(data)` for each parsed `data:` line.
 */
async function _readSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || ''; // last element may be incomplete

      for (const part of parts) {
        const dataLine = part.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine.slice(6));
          onEvent(data);
        } catch {
          // malformed JSON — skip
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim()) {
      const dataLine = buffer.split('\n').find((l) => l.startsWith('data: '));
      if (dataLine) {
        try {
          onEvent(JSON.parse(dataLine.slice(6)));
        } catch { /* ignore */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * useQuizGeneration – custom hook that exposes persistent quiz generation state.
 *
 * Returns:
 *   isGenerating      – true while the API call is in flight
 *   selectionValues   – raw dropdown values persisted across remounts (or null)
 *   result            – last generation result (null until first generation completes)
 *   generate(apiParams, router) – kicks off generation; navigates on success
 *   clearResult()     – resets the result so the button shows normal text
 */
export default function useQuizGeneration() {
  // Local mirror of the module-level flag so React re-renders on change
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    mountedRef.current = true;
    const rerender = () => {
      if (mountedRef.current) forceUpdate((n) => n + 1);
    };
    _subscribers.add(rerender);
    return () => {
      mountedRef.current = false;
      _subscribers.delete(rerender);
    };
  }, []);

  const generate = useCallback(async (apiParams, router) => {
    // Prevent double-fire
    if (_isGenerating) return;

    _isGenerating = true;
    _result = null;
    _progress = null;
    _selectionValues = apiParams ? { ...apiParams } : null;
    _notify();

    _generationPromise = (async () => {
      try {
        const response = await fetch("/api/quizzes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiParams),
        });

        // Non-200 responses are still plain JSON (validation / auth errors)
        if (!response.ok) {
          const data = await response.json();
          _result = {
            success: false,
            error: data.error || "Unknown error",
            details: data.details || "",
          };
          return;
        }

        // 200 — SSE stream with progress + completion events
        await _readSSE(response, (event) => {
          if (event.type === "progress") {
            _progress = { stage: event.stage, message: event.message, percent: event.percent };
            _notify();
          } else if (event.type === "complete" && event.success) {
            _result = { success: true, data: event };
            // Store quiz info for notification
            localStorage.setItem(
              "quiz-generated",
              JSON.stringify({
                type: event.quiz.type,
                difficulty: event.quiz.difficulty,
                count: event.quiz.totalQuestions,
              })
            );
            // Navigate to the generated quiz
            router.push(`/student/quizzes/${event.quiz.id}`);
          } else if (event.type === "error") {
            _result = {
              success: false,
              error: event.error || "Unknown error",
              details: event.details || "",
            };
          }
        });
      } catch (error) {
        console.error("Error generating quiz:", error);
        _result = {
          success: false,
          error: "Failed to generate quiz. Please ensure Ollama is running and try again.",
          details: "",
        };
      } finally {
        _isGenerating = false;
        _generationPromise = null;
        _progress = null;
        _selectionValues = null;
        _notify();
      }
    })();

    return _generationPromise;
  }, []);

  const clearResult = useCallback(() => {
    _result = null;
    _notify();
  }, []);

  return {
    isGenerating: _isGenerating,
    progress: _progress,
    selectionValues: _selectionValues,
    result: _result,
    generate,
    clearResult,
  };
}
