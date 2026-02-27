import prisma from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentNumber: string }> }
) {
  try {
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
