import { AchievementProvider } from "@/components/shared/AchievementContext";

/**
 * Student-section layout.
 * Wraps every student page with the global AchievementProvider so that
 * newly earned achievement pop-ups appear regardless of which page the
 * student is currently on.
 */
export default function StudentLayout({ children }) {
  return <AchievementProvider>{children}</AchievementProvider>;
}
