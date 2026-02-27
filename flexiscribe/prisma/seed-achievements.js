require('dotenv').config();
const { Pool } = require('pg');

/**
 * Seed achievements with actual requirement-based conditions
 * RequirementType values:
 *   STREAK_DAYS        - streakCount >= requirementValue
 *   QUIZZES_COMPLETED  - total quiz attempts >= requirementValue
 *   REVIEWERS_DOWNLOADED - total reviewer downloads >= requirementValue
 *   QUIZ_BEFORE_HOUR   - completed a quiz before requirementValue (hour, 24h)
 *   FIRST_QUIZ         - completed at least 1 quiz
 *   LEADERBOARD_TOP    - leaderboard rank <= requirementValue
 *   PERFECT_SCORE      - got 100% on any quiz
 *   STUDY_AFTER_MIDNIGHT - had activity after midnight
 *   QUIZ_UNDER_MINUTES - completed a quiz in under requirementValue minutes
 */

const achievements = [
  {
    title: "Consistency is Key",
    description: "Maintained a 7-day study streak",
    icon: "🔥",
    category: "uncommon",
    requirementType: "STREAK_DAYS",
    requirementValue: 7,
  },
  {
    title: "Quiz Master",
    description: "Completed 25 quizzes",
    icon: "📝",
    category: "rare",
    requirementType: "QUIZZES_COMPLETED",
    requirementValue: 25,
  },
  {
    title: "Knowledge Collector",
    description: "Downloaded 10 reviewers",
    icon: "📚",
    category: "uncommon",
    requirementType: "REVIEWERS_DOWNLOADED",
    requirementValue: 10,
  },
  {
    title: "Early Bird",
    description: "Completed a quiz before 8 AM",
    icon: "🌅",
    category: "uncommon",
    requirementType: "QUIZ_BEFORE_HOUR",
    requirementValue: 8,
  },
  {
    title: "First Steps",
    description: "Completed your first quiz",
    icon: "🎯",
    category: "common",
    requirementType: "FIRST_QUIZ",
    requirementValue: 1,
  },
  {
    title: "Top Contender",
    description: "Top 10 on the leaderboard",
    icon: "🏆",
    category: "rare",
    requirementType: "LEADERBOARD_TOP",
    requirementValue: 10,
  },
  {
    title: "Perfectionist",
    description: "Got 100% on any quiz",
    icon: "💯",
    category: "epic",
    requirementType: "PERFECT_SCORE",
    requirementValue: 100,
  },
  {
    title: "Night Owl",
    description: "Studied after midnight",
    icon: "🦉",
    category: "uncommon",
    requirementType: "STUDY_AFTER_MIDNIGHT",
    requirementValue: 0,
  },
  {
    title: "Speed Demon",
    description: "Completed a quiz under 5 minutes",
    icon: "⚡",
    category: "rare",
    requirementType: "QUIZ_UNDER_MINUTES",
    requirementValue: 5,
  },
  {
    title: "Unstoppable",
    description: "Maintained a 30-day study streak",
    icon: "🔥",
    category: "epic",
    requirementType: "STREAK_DAYS",
    requirementValue: 30,
  },
  {
    title: "Library Hoarder",
    description: "Downloaded 50 reviewers",
    icon: "🏛️",
    category: "legendary",
    requirementType: "REVIEWERS_DOWNLOADED",
    requirementValue: 50,
  },
  {
    title: "Champion",
    description: "Reached #1 on the leaderboard",
    icon: "👑",
    category: "legendary",
    requirementType: "LEADERBOARD_TOP",
    requirementValue: 1,
  },
];

async function main() {
  console.log("Starting achievement seed...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    for (const a of achievements) {
      // Upsert: skip if title already exists
      const existing = await pool.query(
        'SELECT id FROM "Achievement" WHERE title = $1',
        [a.title]
      );

      if (existing.rows.length > 0) {
        // Update existing record
        await pool.query(
          `UPDATE "Achievement" SET description = $1, icon = $2, category = $3, "requirementType" = $4, "requirementValue" = $5 WHERE title = $6`,
          [a.description, a.icon, a.category, a.requirementType, a.requirementValue, a.title]
        );
        console.log(`  ✅ Updated: ${a.title}`);
      } else {
        await pool.query(
          `INSERT INTO "Achievement" (id, title, description, icon, category, "requirementType", "requirementValue", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
          [a.title, a.description, a.icon, a.category, a.requirementType, a.requirementValue]
        );
        console.log(`  ✅ Created: ${a.title}`);
      }
    }

    console.log("\n✅ All achievements seeded successfully!");
    await pool.end();
  } catch (error) {
    console.error("❌ Error seeding achievements:", error);
    await pool.end();
    throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
