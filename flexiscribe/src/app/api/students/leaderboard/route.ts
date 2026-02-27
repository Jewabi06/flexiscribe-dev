import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Fetch all students ordered by XP descending, include quiz attempt counts
    const students = await prisma.student.findMany({
      select: {
        id: true,
        studentNumber: true,
        username: true,
        fullName: true,
        xp: true,
        avatar: true,
        _count: {
          select: {
            quizAttempts: true,
          },
        },
      },
      orderBy: {
        xp: 'desc',
      },
    });

    // Add rank and quizzesTaken to each student
    const leaderboard = students.map((student, index) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      username: student.username,
      fullName: student.fullName,
      xp: student.xp,
      avatar: student.avatar,
      rank: index + 1,
      quizzesTaken: student._count.quizAttempts,
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
