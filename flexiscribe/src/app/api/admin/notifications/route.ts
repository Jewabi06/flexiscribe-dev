import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

// GET /api/admin/notifications - Get admin notifications sourced from Activity records
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request);

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { userId: user.userId },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    // Get all notification rows for this admin (including soft-deleted)
    // to know which activity IDs have already been processed
    const existingNotifs = await prisma.notification.findMany({
      where: { adminId: admin.id, activityId: { not: null } },
      select: { activityId: true },
    });

    const processedActivityIds = new Set(
      existingNotifs.map((n) => n.activityId)
    );

    // Fetch recent activities across all roles
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Only create notification rows for activities not yet processed
    const newActivities = activities.filter(
      (a) => !processedActivityIds.has(a.id)
    );

    if (newActivities.length > 0) {
      await prisma.notification.createMany({
        data: newActivities.map((a) => ({
          title: a.action,
          message: a.description || "",
          type: a.userRole.toLowerCase(),
          read: false,
          deleted: false,
          adminId: admin.id,
          activityId: a.id,
        })),
        skipDuplicates: true,
      });
    }

    // Return only non-deleted notifications
    const notifications = await prisma.notification.findMany({
      where: { adminId: admin.id, deleted: false },
      orderBy: { createdAt: "desc" },
      take: 100,
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

    await prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { read: true },
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

// DELETE /api/admin/notifications - Soft-delete a notification (won't come back)
export async function DELETE(request: Request) {
  try {
    const user = await verifyAuth(request);

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

    // Soft-delete: mark as deleted so the activity won't be re-synced
    await prisma.notification.update({
      where: { id },
      data: { deleted: true },
    });

    return NextResponse.json(
      { message: "Notification deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json(
      { error: "An error occurred while deleting the notification" },
      { status: 500 }
    );
  }
}
