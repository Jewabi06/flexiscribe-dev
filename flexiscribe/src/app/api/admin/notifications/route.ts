import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/notifications - Get admin notifications
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get admin record
    const admin = await prisma.admin.findUnique({
      where: { userId: user.userId },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where: { adminId: admin.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ notifications }, { status: 200 });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching notifications" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/notifications - Mark notifications as read
export async function PATCH(request: Request) {
  try {
    const user = await verifyAuth(request);
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationIds } = body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json(
        { error: "Invalid notification IDs" },
        { status: 400 }
      );
    }

    // Update notifications
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        read: true,
      },
    });

    return NextResponse.json(
      { message: "Notifications marked as read" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json(
      { error: "An error occurred while updating notifications" },
      { status: 500 }
    );
  }
}
