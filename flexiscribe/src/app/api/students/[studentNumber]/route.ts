import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentNumber: string }> }
) {
  try {
    // Require authentication — unauthenticated callers must not probe student records
    const caller = await getCurrentUser();
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { studentNumber } = await params;

    if (!studentNumber) {
      return NextResponse.json(
        { error: "Student number is required" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { studentNumber },
      include: {
        user: {
          select: {
            email: true,
            isGhost: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Ghost students are invisible to non-admin callers
    if (student.user.isGhost && caller.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        email: student.user.email,
        studentNumber: student.studentNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching student data" },
      { status: 500 }
    );
  }
}
