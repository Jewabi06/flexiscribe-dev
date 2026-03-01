"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AchievementModal from "./AchievementModal";

/**
 * AchievementContext — provides a global achievement notification system.
 *
 * Usage:
 *   const { showAchievements, checkAchievements } = useAchievement();
 *
 *   // Manually show achievements:
 *   showAchievements([{ id, name, description, icon, rarity }]);
 *
 *   // Re-check the API for newly earned achievements:
 *   await checkAchievements();
 */

const AchievementContext = createContext({
  showAchievements: () => {},
  checkAchievements: async () => {},
});

export function useAchievement() {
  return useContext(AchievementContext);
}

export function AchievementProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentBatch, setCurrentBatch] = useState([]);
  const hasChecked = useRef(false);

  // Show a batch of achievements immediately.
  const showAchievements = useCallback((achievements) => {
    if (!achievements || achievements.length === 0) return;
    setQueue((prev) => [...prev, achievements]);
  }, []);

  // Flush queue: whenever the modal is closed and there are more batches, show the next one.
  useEffect(() => {
    if (!isOpen && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentBatch(next);
      setQueue(rest);
      setIsOpen(true);
    }
  }, [isOpen, queue]);

  // Check the API for newly earned achievements.
  const checkAchievements = useCallback(async () => {
    try {
      const res = await fetch("/api/students/achievements");
      if (!res.ok) return;
      const data = await res.json();
      if (data.newlyEarned && data.newlyEarned.length > 0) {
        const batch = data.achievements.filter((a) =>
          data.newlyEarned.includes(a.id)
        );
        if (batch.length > 0) {
          showAchievements(batch);
        }
      }
    } catch (err) {
      console.error("[AchievementProvider] Error checking achievements:", err);
    }
  }, [showAchievements]);

  // Auto-check once when the provider first mounts (i.e., on every student page).
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    checkAchievements();
  }, [checkAchievements]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setCurrentBatch([]);
  }, []);

  return (
    <AchievementContext.Provider value={{ showAchievements, checkAchievements }}>
      {children}
      <AchievementModal
        isOpen={isOpen}
        onClose={handleClose}
        achievements={currentBatch}
      />
    </AchievementContext.Provider>
  );
}
