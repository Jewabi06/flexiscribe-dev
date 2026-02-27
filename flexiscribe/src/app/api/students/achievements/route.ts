import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * Check if a student meets the requirement for a given achievement.
 */
async function checkRequirement(
  achievement: { requirementType: string; requirementValue: number },
  student: { id: string; streakCount: number; downloadCount: number }
): Promise<boolean> {
  switch (achievement.requirementType) {
    case 'STREAK_DAYS':
      return student.streakCount >= achievement.requirementValue;

    case 'QUIZZES_COMPLETED': {
      const quizCount = await prisma.quizAttempt.count({
        where: { studentId: student.id },
      });
      return quizCount >= achievement.requirementValue;
    }

    case 'REVIEWERS_DOWNLOADED':
      return student.downloadCount >= achievement.requirementValue;

    case 'QUIZ_BEFORE_HOUR': {
      // Check if any quiz attempt was completed before the given hour (Philippine Time, UTC+8)
      const earlyAttempts = await prisma.quizAttempt.findMany({
        where: { studentId: student.id },
        select: { completedAt: true },
      });
      return earlyAttempts.some((a) => {
        const phHour = new Date(a.completedAt).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          hour: 'numeric',
          hour12: false,
        });
        return parseInt(phHour, 10) < achievement.requirementValue;
      });
    }

    case 'FIRST_QUIZ': {
      const firstQuizCount = await prisma.quizAttempt.count({
        where: { studentId: student.id },
      });
      return firstQuizCount >= 1;
    }

    case 'LEADERBOARD_TOP': {
      // Get all students ordered by XP to find rank
      const students = await prisma.student.findMany({
        select: { id: true, xp: true },
        orderBy: { xp: 'desc' },
      });
      const rank = students.findIndex((s) => s.id === student.id) + 1;
      return rank > 0 && rank <= achievement.requirementValue;
    }

    case 'PERFECT_SCORE': {
      // Check if any quiz attempt has score == totalQuestions (100%)
      const perfectAttempts = await prisma.quizAttempt.findFirst({
        where: {
          studentId: student.id,
          score: { gt: 0 },
        },
      });
      if (!perfectAttempts) return false;
      // Need to check all attempts for score == totalQuestions
      const allAttempts = await prisma.quizAttempt.findMany({
        where: { studentId: student.id },
        select: { score: true, totalQuestions: true },
      });
      return allAttempts.some((a) => a.score === a.totalQuestions && a.totalQuestions > 0);
    }

    case 'STUDY_AFTER_MIDNIGHT': {
      // Check if any quiz attempt was completed after midnight (0:00-4:59 AM Philippine Time)
      const nightAttempts = await prisma.quizAttempt.findMany({
        where: { studentId: student.id },
        select: { completedAt: true },
      });
      return nightAttempts.some((a) => {
        const phHour = new Date(a.completedAt).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          hour: 'numeric',
          hour12: false,
        });
        const hour = parseInt(phHour, 10);
        return hour >= 0 && hour < 5;
      });
    }

    case 'QUIZ_UNDER_MINUTES': {
      // Check if any quiz attempt was completed within requirementValue minutes of starting
      const timedAttempts = await prisma.quizAttempt.findMany({
        where: {
          studentId: student.id,
          startedAt: { not: null },
        },
        select: { startedAt: true, completedAt: true },
      });
      return timedAttempts.some((a) => {
        if (!a.startedAt) return false;
        const diffMs = new Date(a.completedAt).getTime() - new Date(a.startedAt).getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return diffMinutes > 0 && diffMinutes <= achievement.requirementValue;
      });
    }

    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true, xp: true, streakCount: true, downloadCount: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch all achievements
    const allAchievements = await prisma.achievement.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Fetch student's earned achievements
    const earnedAchievements = await prisma.studentAchievement.findMany({
      where: { studentId: student.id },
      include: { achievement: true },
    });

    const earnedAchievementIds = new Set(
      earnedAchievements.map((sa) => sa.achievementId)
    );

    // Auto-award achievements based on actual requirements if not already earned
    const newlyEarned: string[] = [];
    for (const achievement of allAchievements) {
      if (!earnedAchievementIds.has(achievement.id)) {
        let met = false;
        try {
          met = await checkRequirement(
            { requirementType: achievement.requirementType, requirementValue: achievement.requirementValue },
            student
          );
        } catch (checkError) {
          console.error(`Error checking requirement for "${achievement.title}" (${achievement.requirementType}):`, checkError);
          continue;
        }
        if (met) {
          try {
            await prisma.studentAchievement.create({
              data: {
                studentId: student.id,
                achievementId: achievement.id,
              },
            });
            earnedAchievementIds.add(achievement.id);
            newlyEarned.push(achievement.id);

            // Create notification for newly earned achievement
            await prisma.notification.create({
              data: {
                title: '🏆 Achievement Unlocked!',
                message: `You earned "${achievement.title}" — ${achievement.description}`,
                type: 'achievement',
                studentId: student.id,
              },
            });
          } catch (error) {
            console.log('Achievement already awarded:', achievement.title);
          }
        }
      }
    }

    // Map achievements with earned status
    const achievements = allAchievements.map((achievement) => {
      const earnedAchievement = earnedAchievements.find(
        (sa) => sa.achievementId === achievement.id
      );
      const isEarned = earnedAchievementIds.has(achievement.id);
      return {
        id: achievement.id,
        name: achievement.title,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category.toLowerCase(),
        rarity: achievement.category.toLowerCase(),
        requirementType: achievement.requirementType,
        requirementValue: achievement.requirementValue,
        earned: isEarned,
        earnedDate: earnedAchievement?.earnedAt
          ? new Date(earnedAchievement.earnedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : newlyEarned.includes(achievement.id)
            ? new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : null,
      };
    });

    return NextResponse.json({ achievements, newlyEarned });
  } catch (error) {
    console.error('Error fetching achievements:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}
