import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

/**
 * GET /api/admin/password-requests
 * Get all password requests for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    const whereClause: Record<string, unknown> = {};
    if (status !== "all") {
      whereClause.status = status;
    }

    const requests = await prisma.passwordRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Enrich with user data
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const reqUser = await prisma.user.findUnique({
          where: { id: req.userId },
          include: { student: true, educator: true },
        });

        let userName = reqUser?.email || "Unknown";
        if (reqUser?.student) userName = reqUser.student.fullName;
        else if (reqUser?.educator) userName = reqUser.educator.fullName;

        return {
          id: req.id,
          userId: req.userId,
          type: req.type,
          status: req.status,
          reason: req.reason,
          adminNote: req.adminNote,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          resolvedAt: req.resolvedAt,
          userName,
          userEmail: reqUser?.email || "Unknown",
          userRole: reqUser?.role || "Unknown",
        };
      })
    );

    return NextResponse.json({ requests: enrichedRequests }, { status: 200 });
  } catch (error) {
    console.error("Get password requests error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching password requests" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/password-requests
 * Approve or deny a password request
 * Body: { requestId, action: "approve" | "deny", adminNote? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, action, adminNote } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "Request ID and action are required" },
        { status: 400 }
      );
    }

    if (!["approve", "deny"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'approve' or 'deny'" },
        { status: 400 }
      );
    }

    // Get the password request
    const passwordRequest = await prisma.passwordRequest.findUnique({
      where: { id: requestId },
    });

    if (!passwordRequest) {
      return NextResponse.json(
        { error: "Password request not found" },
        { status: 404 }
      );
    }

    if (passwordRequest.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been processed" },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { userId: user.userId },
      select: { id: true, fullName: true },
    });

    if (action === "approve") {
      if (passwordRequest.type === "change" || passwordRequest.type === "reset") {
        if (!passwordRequest.newPasswordHash) {
          return NextResponse.json(
            { error: "No new password was provided with this request" },
            { status: 400 }
          );
        }

        // Apply the password change
        await prisma.$transaction([
          prisma.user.update({
            where: { id: passwordRequest.userId },
            data: {
              password: passwordRequest.newPasswordHash,
              token: null,
              tokenExpiry: null,
            },
          }),
          prisma.passwordRequest.update({
            where: { id: requestId },
            data: {
              status: "approved",
              adminNote: adminNote || null,
              resolvedAt: new Date(),
              resolvedBy: admin?.id || null,
            },
          }),
        ]);

        // Create audit log
        const reqUser = await prisma.user.findUnique({
          where: { id: passwordRequest.userId },
          select: { email: true, role: true },
        });

        await prisma.auditLog.create({
          data: {
            action: `Password ${passwordRequest.type === "reset" ? "Reset" : "Change"} Approved`,
            details: `Admin ${admin?.fullName || "Unknown"} approved password ${passwordRequest.type} for ${reqUser?.email}`,
            userRole: reqUser?.role as "ADMIN" | "STUDENT" | "EDUCATOR",
            userName: reqUser?.email || "Unknown",
            adminId: admin?.id || undefined,
            userId: passwordRequest.userId,
          },
        });

        // Notify the user via a notification
        const targetUser = await prisma.user.findUnique({
          where: { id: passwordRequest.userId },
          include: { student: true, educator: true },
        });

        if (targetUser?.student) {
          await prisma.notification.create({
            data: {
              title: "Password Request Approved",
              message: `Your password ${passwordRequest.type} request has been approved. You can now log in with your new password.${adminNote ? ` Admin note: ${adminNote}` : ""}`,
              type: "success",
              studentId: targetUser.student.id,
            },
          });
        } else if (targetUser?.educator) {
          await prisma.notification.create({
            data: {
              title: "Password Request Approved",
              message: `Your password ${passwordRequest.type} request has been approved. You can now log in with your new password.${adminNote ? ` Admin note: ${adminNote}` : ""}`,
              type: "success",
              educatorId: targetUser.educator.id,
            },
          });
        }
      }

      return NextResponse.json(
        { message: "Password request approved and password has been updated" },
        { status: 200 }
      );
    }

    if (action === "deny") {
      await prisma.passwordRequest.update({
        where: { id: requestId },
        data: {
          status: "denied",
          adminNote: adminNote || null,
          resolvedAt: new Date(),
          resolvedBy: admin?.id || null,
        },
      });

      // Notify the user
      const targetUser = await prisma.user.findUnique({
        where: { id: passwordRequest.userId },
        include: { student: true, educator: true },
      });

      if (targetUser?.student) {
        await prisma.notification.create({
          data: {
            title: "Password Request Denied",
            message: `Your password ${passwordRequest.type} request has been denied.${adminNote ? ` Reason: ${adminNote}` : ""} Please contact the admin for more information.`,
            type: "warning",
            studentId: targetUser.student.id,
          },
        });
      } else if (targetUser?.educator) {
        await prisma.notification.create({
          data: {
            title: "Password Request Denied",
            message: `Your password ${passwordRequest.type} request has been denied.${adminNote ? ` Reason: ${adminNote}` : ""} Please contact the admin for more information.`,
            type: "warning",
            educatorId: targetUser.educator.id,
          },
        });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: `Password ${passwordRequest.type === "reset" ? "Reset" : "Change"} Denied`,
          details: `Admin ${admin?.fullName || "Unknown"} denied password ${passwordRequest.type} for ${targetUser?.email || "Unknown"}`,
          userRole: (targetUser?.role || "STUDENT") as "ADMIN" | "STUDENT" | "EDUCATOR",
          userName: targetUser?.email || "Unknown",
          adminId: admin?.id || undefined,
          userId: passwordRequest.userId,
        },
      });

      return NextResponse.json(
        { message: "Password request has been denied" },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Process password request error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing the request" },
      { status: 500 }
    );
  }
}
