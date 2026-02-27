import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET all students - Admin and Educator only
 */
export async function GET(request: NextRequest) {
  // Verify user has ADMIN or EDUCATOR role
  const authResult = await requireRole(request, ["ADMIN", "EDUCATOR"]);
  
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }

  try {
    const students = await prisma.student.findMany({
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(students, { status: 200 });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}
