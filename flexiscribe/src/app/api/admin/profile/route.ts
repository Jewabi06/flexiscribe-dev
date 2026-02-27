import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import bcrypt from "bcrypt";

// GET /api/admin/profile - Get admin profile
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
      include: {
        user: {
          select: {
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        admin: {
          id: admin.id,
          username: admin.username,
          fullName: admin.fullName,
          avatar: admin.avatar,
          email: admin.user.email,
          phoneNumber: admin.user.phoneNumber,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get admin profile error:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/profile - Update admin profile
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
    const { fullName, username, phoneNumber, currentPassword, newPassword } = body;

    const admin = await prisma.admin.findUnique({
      where: { userId: user.userId },
      include: { user: true },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password required" },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        admin.user.password
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: user.userId },
        data: { password: hashedPassword },
      });
    }

    // Update admin profile
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (username !== undefined) updateData.username = username;

    if (Object.keys(updateData).length > 0) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: updateData,
      });
    }

    // Update phone number in user table
    if (phoneNumber !== undefined) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { phoneNumber },
      });
    }

    // Build description of what changed
    const changes: string[] = [];
    if (fullName !== undefined) changes.push("name");
    if (username !== undefined) changes.push("username");
    if (phoneNumber !== undefined) changes.push("phone");
    if (newPassword) changes.push("password");
    const changeDesc = changes.length > 0 ? changes.join(", ") : "profile";

    await prisma.activity.create({
      data: {
        action: "PROFILE_UPDATED",
        description: `Admin updated ${changeDesc}`,
        userRole: "ADMIN",
        userName: admin.fullName,
        userId: user.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "PROFILE_UPDATED",
        details: `Admin updated ${changeDesc}`,
        userRole: "ADMIN",
        userName: admin.fullName,
        userId: user.userId,
      },
    });

    return NextResponse.json(
      { message: "Profile updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update admin profile error:", error);
    return NextResponse.json(
      { error: "An error occurred while updating profile" },
      { status: 500 }
    );
  }
}
