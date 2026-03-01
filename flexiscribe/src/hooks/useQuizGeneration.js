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
let _selectionValues = null;     // raw dropdown values (lessonId, type, difficulty, count)
let _subscribers = new Set();    // all mounted hook instances

function _notify() {
  _subscribers.forEach((fn) => fn());
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
    _selectionValues = apiParams ? { ...apiParams } : null;
    _notify();

    _generationPromise = fetch("/api/quizzes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiParams),
    })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && data.success) {
          _result = { success: true, data };
          // Store quiz info for notification
          localStorage.setItem(
            "quiz-generated",
            JSON.stringify({
              type: data.quiz.type,
              difficulty: data.quiz.difficulty,
              count: data.quiz.totalQuestions,
            })
          );
          // Navigate to the generated quiz (works even if component re-mounted)
          router.push(`/student/quizzes/${data.quiz.id}`);
        } else {
          _result = {
            success: false,
            error: data.error || "Unknown error",
            details: data.details || "",
          };
        }
      })
      .catch((error) => {
        console.error("Error generating quiz:", error);
        _result = {
          success: false,
          error: "Failed to generate quiz. Please ensure Ollama is running and try again.",
          details: "",
        };
      })
      .finally(() => {
        _isGenerating = false;
        _generationPromise = null;
        _selectionValues = null;
        _notify();
      });

    return _generationPromise;
  }, []);

  const clearResult = useCallback(() => {
    _result = null;
    _notify();
  }, []);

  return {
    isGenerating: _isGenerating,
    selectionValues: _selectionValues,
    result: _result,
    generate,
    clearResult,
  };
}
