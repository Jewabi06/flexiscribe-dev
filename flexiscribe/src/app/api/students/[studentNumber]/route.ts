import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentNumber: string }> }
) {
  try {
    // Authentication is optional — this endpoint is called during the student login
    // flow before the student has a session. Ghost check is applied only when an
    // authenticated non-admin caller is looking up another student.
    const caller = await getCurrentUser();

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

    // Ghost students are invisible to authenticated non-admin callers.
    // Unauthenticated access (login flow) is allowed so ghost students can still log in.
    if (caller && student.user.isGhost && caller.role !== "ADMIN") {
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
