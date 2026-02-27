import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Get educator profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (user.role !== "EDUCATOR") {
      return NextResponse.json(
        { error: "Unauthorized. Educator access only." },
        { status: 403 }
      );
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
      include: {
        department: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!educator) {
      return NextResponse.json(
        { error: "Educator profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ educator }, { status: 200 });
  } catch (error) {
    console.error("Get educator profile error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Update educator profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (user.role !== "EDUCATOR") {
      return NextResponse.json(
        { error: "Unauthorized. Educator access only." },
        { status: 403 }
      );
    }

    const educator = await prisma.educator.findUnique({
      where: { userId: user.userId },
    });

    if (!educator) {
      return NextResponse.json(
        { error: "Educator profile not found" },
        { status: 404 }
      );
    }

    const { fullName, username, gender, birthDate } = await request.json();

    const updatedEducator = await prisma.educator.update({
      where: { id: educator.id },
      data: {
        ...(fullName && { fullName }),
        ...(username && { username }),
        ...(gender && { gender }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
      },
      include: {
        department: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ educator: updatedEducator }, { status: 200 });
  } catch (error) {
    console.error("Update educator profile error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
